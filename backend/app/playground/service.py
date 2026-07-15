from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking.service import list_saved_chunks
from app.config import settings
from app.db.lookups import get_conversation_turn_or_none, get_document_or_none
from app.db.models import Chunk as ChunkRow
from app.db.models import ConversationTurn, ConversationTurnChunk
from app.db.models import Embedding as EmbeddingRow
from app.embeddings.models.base import EMBEDDING_MODELS
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError
from app.playground.schemas import (
    ListTurnsResponse,
    PlaygroundContextResponse,
    TurnChunkOut,
    TurnOut,
)
from app.retrieval.strategies.base import RETRIEVAL_STRATEGIES

TOP_K = 5


class UnsupportedModelError(ValueError):
    pass


class NoSavedEmbeddingsError(ValueError):
    pass


class EmptyQueryError(ValueError):
    pass


class QueryTooLongError(ValueError):
    pass


class TurnNotFoundError(ValueError):
    pass


class NoRetrievedChunksError(ValueError):
    pass


class GenerationFailedError(RuntimeError):
    pass


def get_context(db: Session, document_id: str) -> PlaygroundContextResponse:
    """Read-only projection over a document's saved chunks/embeddings, powering the
    Playground's pre-search display (016-playground-similarity-search spec User Story 2)
    and telling the caller which embedding model a subsequent search should use.
    `chunkingStrategy`/`embeddingModel` are `None` when nothing is saved yet — a normal,
    expected state (spec FR-010), not an error."""
    document = get_document_or_none(db, document_id)
    if document is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    chunks = list_saved_chunks(db, document_id)
    chunking_strategy = chunks[0].strategy if chunks else None

    embedding_model = db.execute(
        select(EmbeddingRow.model)
        .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
        .where(ChunkRow.document_id == document_id)
        .order_by(EmbeddingRow.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    return PlaygroundContextResponse(
        documentId=document_id,
        chunkingStrategy=chunking_strategy,
        embeddingModel=embedding_model,
    )


def _turn_chunk_out(row: ConversationTurnChunk) -> TurnChunkOut:
    # Falls back to the snapshot row's own id if the original chunk was later deleted by a
    # re-chunk (017 research.md Decision 1) — content/index/score (the durable record) are
    # unaffected either way.
    return TurnChunkOut(
        chunkId=row.chunk_id or row.id, index=row.chunk_index, content=row.content, score=row.score
    )


def _to_turn_out(turn: ConversationTurn) -> TurnOut:
    return TurnOut(
        id=turn.id,
        question=turn.question,
        queryEmbedding=turn.query_embedding,
        chunks=[_turn_chunk_out(chunk) for chunk in turn.chunks],
        llmProvider=turn.llm_provider,
        llmModel=turn.llm_model,
        prompt=turn.prompt,
        answer=turn.answer,
        error=turn.error,
        createdAt=turn.created_at,
        answeredAt=turn.answered_at,
    )


def create_turn(db: Session, document_id: str, model: str, query: str) -> TurnOut:
    """Embeds `query` with `model` (the same model used for the document's stored chunk
    embeddings — spec FR-003), ranks that document's saved chunks by cosine similarity via
    the registered `cosine-similarity` retrieval strategy, and persists the question plus a
    snapshot of each retrieved chunk as a new `ConversationTurn` (spec FR-016). Validates in
    the order a user would hit these problems: does the document exist, is the model
    registered, does the document have anything to search, is the query itself usable —
    before any embedding computation or persistence happens."""
    document = get_document_or_none(db, document_id)
    if document is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    if model not in EMBEDDING_MODELS:
        raise UnsupportedModelError(f"Unsupported embedding model: {model!r}")

    has_saved_embedding = db.execute(
        select(EmbeddingRow.id)
        .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
        .where(ChunkRow.document_id == document_id, EmbeddingRow.model == model)
        .limit(1)
    ).first()
    if has_saved_embedding is None:
        raise NoSavedEmbeddingsError(f"Document has no saved embeddings for model {model!r}")

    if not query.strip():
        raise EmptyQueryError("Query must not be empty")

    strategy = EMBEDDING_MODELS[model]
    if not strategy.fits(query):
        raise QueryTooLongError("Query exceeds the embedding model's maximum input length")

    [(_, query_vector)] = strategy.embed([query])

    retrieval = RETRIEVAL_STRATEGIES["cosine-similarity"]
    results = retrieval.search(db, document_id, model, query_vector, limit=TOP_K)

    turn = ConversationTurn(
        document_id=document_id,
        question=query,
        embedding_model=model,
        query_embedding=query_vector,
    )
    db.add(turn)
    db.flush()

    for rank, (chunk, embedding_id, score) in enumerate(results, start=1):
        db.add(
            ConversationTurnChunk(
                turn_id=turn.id,
                chunk_id=chunk.id,
                embedding_id=embedding_id,
                chunk_index=chunk.index,
                content=chunk.content,
                score=score,
                rank=rank,
            )
        )

    db.commit()
    return _to_turn_out(turn)


def _build_prompt(question: str, chunks: list[ConversationTurnChunk]) -> str:
    """Assembled once, server-side, and persisted verbatim as `Turn.prompt` (017 research.md
    Decision 5) — the same deterministic template regardless of which provider is
    configured, so answers stay comparable across models."""
    context = "\n\n".join(f"[CHUNK {chunk.chunk_index}]\n{chunk.content}" for chunk in chunks)
    return (
        "Answer the question using only the context below. If the context does not contain "
        "the answer, say so explicitly rather than guessing. Use Markdown formatting.\n\n"
        f"{context}\n\nQuestion: {question}"
    )


def generate_answer(db: Session, turn_id: str) -> TurnOut:
    """Builds the prompt from `turn_id`'s already-persisted question and chunk snapshots (no
    new retrieval — spec FR-014), calls the configured `GenerationProvider`, and persists the
    outcome onto the same turn. Calling this again on a turn whose last attempt failed is the
    retry path (FR-014); it reuses the same chunk snapshots."""
    turn = get_conversation_turn_or_none(db, turn_id)
    if turn is None:
        raise TurnNotFoundError(f"No conversation turn found with id {turn_id!r}")

    if not turn.chunks:
        raise NoRetrievedChunksError("No retrieved chunks to generate an answer from")

    prompt = _build_prompt(turn.question, turn.chunks)
    provider_key = settings.generation_provider
    provider = GENERATION_PROVIDERS.get(provider_key)

    turn.prompt = prompt
    turn.llm_provider = provider_key

    if provider is None:
        turn.llm_model = None
        turn.error = f"Unknown generation provider: {provider_key!r}"
        db.commit()
        raise GenerationFailedError(turn.error)

    try:
        result = provider.generate(prompt)
    except GenerationError as exc:
        turn.error = str(exc)
        db.commit()
        raise GenerationFailedError(str(exc)) from exc

    turn.llm_model = result.model
    turn.answer = result.answer
    turn.error = None
    turn.answered_at = datetime.now(timezone.utc)
    db.commit()
    return _to_turn_out(turn)


def list_turns(db: Session, document_id: str) -> ListTurnsResponse:
    """A document's persisted conversation, oldest first (spec FR-017's auto-reload)."""
    document = get_document_or_none(db, document_id)
    if document is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    turns = db.execute(
        select(ConversationTurn)
        .where(ConversationTurn.document_id == document_id)
        .order_by(ConversationTurn.created_at.asc())
    ).scalars().all()

    return ListTurnsResponse(documentId=document_id, turns=[_to_turn_out(turn) for turn in turns])
