from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking.service import list_saved_chunks
from app.config import settings
from app.db.lookups import (
    get_conversation_turn_owned_by,
    get_corpus_owned_by,
    get_document_owned_by,
)
from app.db.models import Chunk as ChunkRow
from app.db.models import ConversationTurn, ConversationTurnChunk, Document, DocumentCorpus
from app.db.models import Embedding as EmbeddingRow
from app.embeddings.models.base import EMBEDDING_MODELS
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError
from app.playground.schemas import (
    ListTurnsResponse,
    PlaygroundContextResponse,
    TurnChunkOut,
    TurnOut,
)
from app.retrieval.strategies.base import DEFAULT_RETRIEVAL_STRATEGY, RETRIEVAL_STRATEGIES

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


class InvalidScopeError(ValueError):
    """Raised when a caller supplies both or neither of `document_id`/`corpus_id`
    (019-metrics-dashboard contracts/playground-corpus-scope-api.md)."""

    pass


def _require_exactly_one_scope(document_id: str | None, corpus_id: str | None) -> None:
    if (document_id is None) == (corpus_id is None):
        raise InvalidScopeError("Exactly one of documentId or corpusId must be provided")


def get_context(
    db: Session, user_id: str, document_id: str | None, *, corpus_id: str | None = None
) -> PlaygroundContextResponse:
    """Read-only projection over a document's or an entire corpus's saved chunks/embeddings,
    powering the Playground's pre-search display (016-playground-similarity-search spec User
    Story 2; corpus scope added by 019-metrics-dashboard) and telling the caller which
    embedding model a subsequent search should use. `chunkingStrategy`/`embeddingModel` are
    `None` when nothing is saved yet — a normal, expected state (spec FR-010), not an error."""
    _require_exactly_one_scope(document_id, corpus_id)

    if document_id is not None:
        document = get_document_owned_by(db, document_id, user_id)
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
            documentId=document_id, chunkingStrategy=chunking_strategy, embeddingModel=embedding_model
        )

    assert corpus_id is not None
    corpus = get_corpus_owned_by(db, corpus_id, user_id)
    if corpus is None:
        raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")

    chunking_strategy = db.execute(
        select(ChunkRow.strategy)
        .join(Document, Document.id == ChunkRow.document_id)
        .join(DocumentCorpus, DocumentCorpus.document_id == Document.id)
        .where(DocumentCorpus.corpus_id == corpus_id)
        .limit(1)
    ).scalar_one_or_none()
    embedding_model = db.execute(
        select(EmbeddingRow.model)
        .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
        .join(Document, Document.id == ChunkRow.document_id)
        .join(DocumentCorpus, DocumentCorpus.document_id == Document.id)
        .where(DocumentCorpus.corpus_id == corpus_id)
        .order_by(EmbeddingRow.created_at.desc())
        .limit(1)
    ).scalar_one_or_none()
    return PlaygroundContextResponse(
        corpusId=corpus_id, chunkingStrategy=chunking_strategy, embeddingModel=embedding_model
    )


def _turn_chunk_out(row: ConversationTurnChunk) -> TurnChunkOut:
    # Falls back to the snapshot row's own id if the original chunk was later deleted by a
    # re-chunk (017 research.md Decision 1) — content/index/score (the durable record) are
    # unaffected either way.
    return TurnChunkOut(
        chunkId=row.chunk_id or row.id,
        documentId=row.document_id,
        index=row.chunk_index,
        content=row.content,
        score=row.score,
    )


def _to_turn_out(turn: ConversationTurn) -> TurnOut:
    return TurnOut(
        id=turn.id,
        scope=turn.scope,
        documentId=turn.document_id,
        corpusId=turn.corpus_id,
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


def _persist_turn_chunks(
    db: Session, turn: ConversationTurn, results: list[tuple[ChunkRow, str, float]]
) -> None:
    for rank, (chunk, embedding_id, score) in enumerate(results, start=1):
        db.add(
            ConversationTurnChunk(
                turn_id=turn.id,
                chunk_id=chunk.id,
                embedding_id=embedding_id,
                # Always snapshot the source document — needed for a corpus-scoped turn whose
                # chunks may span several documents (019-metrics-dashboard data-model.md); a
                # harmless, always-correct value for a document-scoped turn too.
                document_id=chunk.document_id,
                chunk_index=chunk.index,
                content=chunk.content,
                score=score,
                rank=rank,
            )
        )


def create_turn(
    db: Session,
    user_id: str,
    document_id: str | None,
    model: str,
    query: str,
    *,
    corpus_id: str | None = None,
) -> TurnOut:
    """Embeds `query` with `model` (the same model used for the target's stored chunk
    embeddings — spec FR-003), ranks the target's saved chunks by cosine similarity via the
    registered `cosine-similarity` retrieval strategy, and persists the question plus a
    snapshot of each retrieved chunk as a new `ConversationTurn` (spec FR-016). The target is
    either a single document or an entire corpus (019-metrics-dashboard FR-011) — exactly one
    of `document_id`/`corpus_id` must be given. Validates in the order a user would hit these
    problems: does the target exist, is the model registered, does the target have anything to
    search, is the query itself usable — before any embedding computation or persistence
    happens."""
    _require_exactly_one_scope(document_id, corpus_id)

    if model not in EMBEDDING_MODELS:
        raise UnsupportedModelError(f"Unsupported embedding model: {model!r}")

    if document_id is not None:
        document = get_document_owned_by(db, document_id, user_id)
        if document is None:
            raise FileNotFoundError(f"No document found with id {document_id!r}")

        has_saved_embedding = db.execute(
            select(EmbeddingRow.id)
            .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
            .where(ChunkRow.document_id == document_id, EmbeddingRow.model == model)
            .limit(1)
        ).first()
        if has_saved_embedding is None:
            raise NoSavedEmbeddingsError(f"Document has no saved embeddings for model {model!r}")
    else:
        assert corpus_id is not None
        corpus = get_corpus_owned_by(db, corpus_id, user_id)
        if corpus is None:
            raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")

        has_saved_embedding = db.execute(
            select(EmbeddingRow.id)
            .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
            .join(Document, Document.id == ChunkRow.document_id)
            .join(DocumentCorpus, DocumentCorpus.document_id == Document.id)
            .where(DocumentCorpus.corpus_id == corpus_id, EmbeddingRow.model == model)
            .limit(1)
        ).first()
        if has_saved_embedding is None:
            raise NoSavedEmbeddingsError(f"Corpus has no saved embeddings for model {model!r}")

    if not query.strip():
        raise EmptyQueryError("Query must not be empty")

    strategy = EMBEDDING_MODELS[model]
    if not strategy.fits(query):
        raise QueryTooLongError("Query exceeds the embedding model's maximum input length")

    [(_, query_vector)] = strategy.embed([query])

    retrieval = RETRIEVAL_STRATEGIES[DEFAULT_RETRIEVAL_STRATEGY]
    if document_id is not None:
        results = retrieval.search(db, document_id, model, query_vector, limit=TOP_K)
    else:
        assert corpus_id is not None
        results = retrieval.search_corpus(db, corpus_id, model, query_vector, limit=TOP_K)

    turn = ConversationTurn(
        document_id=document_id,
        corpus_id=corpus_id,
        scope="document" if document_id is not None else "corpus",
        # Snapshot of the top-ranked retrieved chunk's technique, used to group this turn into
        # a metrics "pipeline" (019-metrics-dashboard research.md/data-model.md) — None only
        # when retrieval found nothing, which NoSavedEmbeddingsError above already prevents in
        # the ordinary case.
        chunking_strategy=results[0][0].strategy if results else None,
        question=query,
        embedding_model=model,
        query_embedding=query_vector,
    )
    db.add(turn)
    db.flush()

    _persist_turn_chunks(db, turn, results)

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


def generate_answer(db: Session, user_id: str, turn_id: str) -> TurnOut:
    """Builds the prompt from `turn_id`'s already-persisted question and chunk snapshots (no
    new retrieval — spec FR-014), calls the configured `GenerationProvider`, and persists the
    outcome onto the same turn. Calling this again on a turn whose last attempt failed is the
    retry path (FR-014); it reuses the same chunk snapshots."""
    turn = get_conversation_turn_owned_by(db, turn_id, user_id)
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


def list_turns(
    db: Session, user_id: str, document_id: str | None, *, corpus_id: str | None = None
) -> ListTurnsResponse:
    """A document's or an entire corpus's persisted conversation, oldest first (spec FR-017's
    automatic reload; corpus scope added by 019-metrics-dashboard)."""
    _require_exactly_one_scope(document_id, corpus_id)

    if document_id is not None:
        document = get_document_owned_by(db, document_id, user_id)
        if document is None:
            raise FileNotFoundError(f"No document found with id {document_id!r}")
        turns = db.execute(
            select(ConversationTurn)
            .where(ConversationTurn.document_id == document_id)
            .order_by(ConversationTurn.created_at.asc())
        ).scalars().all()
        return ListTurnsResponse(documentId=document_id, turns=[_to_turn_out(turn) for turn in turns])

    assert corpus_id is not None
    corpus = get_corpus_owned_by(db, corpus_id, user_id)
    if corpus is None:
        raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")
    turns = db.execute(
        select(ConversationTurn)
        .where(ConversationTurn.corpus_id == corpus_id)
        .order_by(ConversationTurn.created_at.asc())
    ).scalars().all()
    return ListTurnsResponse(corpusId=corpus_id, turns=[_to_turn_out(turn) for turn in turns])
