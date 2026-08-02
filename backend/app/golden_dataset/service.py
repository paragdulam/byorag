from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.lookups import get_corpus_owned_by, get_document_owned_by, get_golden_dataset_entry_owned_by
from app.db.models import Chunk as ChunkRow
from app.db.models import Document, DocumentCorpus, GoldenDatasetEntry, GoldenDatasetEntryChunk
from app.embeddings.models.base import EMBEDDING_MODELS
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError
from app.golden_dataset.schemas import (
    CandidateOut,
    CandidateSearchResponse,
    DraftAnswerChunkIn,
    DraftAnswerResponse,
    EntryChunkIn,
    EntryChunkOut,
    EntryListResponse,
    EntryOut,
    EntrySummaryOut,
)
from app.profile import service as profile_service
from app.retrieval.strategies.base import DEFAULT_RETRIEVAL_STRATEGY, RETRIEVAL_STRATEGIES

# Valid GoldenDatasetEntry.status values and the transitions FR-011/FR-012/FR-013/FR-013a allow
# (data-model.md's state diagram) — every status can move to every other status via the shared
# editor; the only hard rule is "approved" always requires >=1 chunk (checked separately).
VALID_STATUSES = {"approved", "pending_review", "rejected"}

# The only registered EMBEDDING_MODELS key today (research.md §1) — this feature doesn't expose
# a model choice, matching its "cosine-only for now" scope decision (spec Assumptions).
EMBEDDING_MODEL = "bert"

# Reciprocal Rank Fusion constant (research.md §1) — the standard choice for this technique.
RRF_K = 60
# Each side of the merge searches this many candidates before fusing (research.md §4's "top-15
# from question-search + top-15 from answer-search").
SEARCH_LIMIT_PER_SIDE = 15
# Final merged, deduplicated candidate list size shown to the user (spec Assumptions — "roughly
# the top 10").
CANDIDATE_LIMIT = 10


class InvalidScopeError(ValueError):
    """Raised when a caller supplies both or neither of documentId/corpusId."""


class EmptyQuestionError(ValueError):
    pass


class QueryTooLongError(ValueError):
    pass


class EmptyChunksError(ValueError):
    pass


class NoApiKeyError(ValueError):
    pass


class GenerationFailedError(RuntimeError):
    pass


class EntryNotFoundError(ValueError):
    pass


class InvalidStatusTransitionError(ValueError):
    pass


class InsufficientContentError(ValueError):
    pass


def _require_exactly_one_scope(document_id: str | None, corpus_id: str | None) -> None:
    if (document_id is None) == (corpus_id is None):
        raise InvalidScopeError("Exactly one of documentId or corpusId must be provided")


def merge_candidates(
    question_results: list[tuple[Any, str, float]],
    answer_results: list[tuple[Any, str, float]],
) -> list[CandidateOut]:
    """Merges two (chunk, embedding_id, score) result lists — best match first, matching
    `RetrievalStrategy.search`'s contract — via Reciprocal Rank Fusion, and returns the top
    `CANDIDATE_LIMIT` deduplicated candidates labeled with which search(es) each matched
    (research.md §1). Rank-based (not raw-score) fusion, since answer-text queries score
    systematically higher against their source chunks than question-text queries do — merging
    by raw score would bias toward answer-search results."""
    rrf_scores: dict[str, float] = {}
    matched_question: dict[str, bool] = {}
    matched_answer: dict[str, bool] = {}
    chunk_by_id: dict[str, Any] = {}

    for rank, (chunk, _embedding_id, _score) in enumerate(question_results, start=1):
        rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 1.0 / (rank + RRF_K)
        matched_question[chunk.id] = True
        chunk_by_id[chunk.id] = chunk

    for rank, (chunk, _embedding_id, _score) in enumerate(answer_results, start=1):
        rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 1.0 / (rank + RRF_K)
        matched_answer[chunk.id] = True
        chunk_by_id[chunk.id] = chunk

    ordered_ids = sorted(rrf_scores, key=lambda chunk_id: rrf_scores[chunk_id], reverse=True)

    return [
        CandidateOut(
            chunkId=chunk_id,
            documentId=chunk_by_id[chunk_id].document_id,
            chunkIndex=chunk_by_id[chunk_id].index,
            content=chunk_by_id[chunk_id].content,
            matchedQuestion=matched_question.get(chunk_id, False),
            matchedAnswer=matched_answer.get(chunk_id, False),
        )
        for chunk_id in ordered_ids[:CANDIDATE_LIMIT]
    ]


def search_candidates(
    db: Session,
    user_id: str,
    document_id: str | None,
    question: str,
    *,
    corpus_id: str | None = None,
    answer: str | None = None,
) -> CandidateSearchResponse:
    _require_exactly_one_scope(document_id, corpus_id)

    if document_id is not None:
        if get_document_owned_by(db, document_id, user_id) is None:
            raise FileNotFoundError(f"No document found with id {document_id!r}")
    else:
        assert corpus_id is not None
        if get_corpus_owned_by(db, corpus_id, user_id) is None:
            raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")

    if not question.strip():
        raise EmptyQuestionError("Question must not be empty")

    strategy = EMBEDDING_MODELS[EMBEDDING_MODEL]
    if not strategy.fits(question):
        raise QueryTooLongError("Question exceeds the embedding model's maximum input length")

    has_answer = answer is not None and answer.strip() != ""
    if has_answer and not strategy.fits(answer):  # type: ignore[arg-type]
        raise QueryTooLongError("Answer exceeds the embedding model's maximum input length")

    texts = [question] + ([answer] if has_answer else [])  # type: ignore[list-item]
    vectors = {text: vector for (_, vector), text in zip(strategy.embed(texts), texts, strict=True)}

    retrieval = RETRIEVAL_STRATEGIES[DEFAULT_RETRIEVAL_STRATEGY]

    def _search(vector: list[float]) -> list[tuple[ChunkRow, str, float]]:
        if document_id is not None:
            return retrieval.search(db, document_id, EMBEDDING_MODEL, vector, limit=SEARCH_LIMIT_PER_SIDE)
        assert corpus_id is not None
        return retrieval.search_corpus(
            db, corpus_id, EMBEDDING_MODEL, vector, limit=SEARCH_LIMIT_PER_SIDE
        )

    question_results = _search(vectors[question])
    answer_results = _search(vectors[answer]) if has_answer else []  # type: ignore[index]

    return CandidateSearchResponse(candidates=merge_candidates(question_results, answer_results))


def _build_prompt(question: str, chunks: list[DraftAnswerChunkIn]) -> str:
    """Same `[CHUNK n]`-block shape as `playground/service.py::_build_prompt` (research.md §7),
    fed the caller's currently *selected* chunks rather than a fresh retrieval's top-K."""
    context = "\n\n".join(f"[CHUNK {chunk.chunkIndex}]\n{chunk.content}" for chunk in chunks)
    return (
        "Answer the question using only the context below. If the context does not contain "
        "the answer, say so explicitly rather than guessing. Use Markdown formatting.\n\n"
        f"{context}\n\nQuestion: {question}"
    )


def draft_answer(
    db: Session, user_id: str, question: str, chunks: list[DraftAnswerChunkIn]
) -> DraftAnswerResponse:
    if not chunks:
        raise EmptyChunksError("At least one chunk is required to draft an answer")

    api_key = profile_service.resolve_decrypted_key(db, user_id)
    if api_key is None:
        raise NoApiKeyError(
            "No personal Anthropic API key on file — add one in your Profile to draft answers"
        )

    prompt = _build_prompt(question, chunks)
    provider = GENERATION_PROVIDERS.get(settings.generation_provider)
    if provider is None:
        raise GenerationFailedError(f"Unknown generation provider: {settings.generation_provider!r}")

    try:
        result = provider.generate(prompt, api_key)
    except GenerationError as exc:
        raise GenerationFailedError(str(exc)) from exc

    return DraftAnswerResponse(draftAnswer=result.answer)


def _entry_chunk_out(row: GoldenDatasetEntryChunk) -> EntryChunkOut:
    return EntryChunkOut(
        id=row.id,
        chunkId=row.chunk_id,
        documentId=row.document_id,
        chunkIndex=row.chunk_index,
        content=row.content,
    )


def _to_entry_out(entry: GoldenDatasetEntry) -> EntryOut:
    return EntryOut(
        id=entry.id,
        corpusId=entry.corpus_id,
        documentId=entry.document_id,
        question=entry.question,
        preferredAnswer=entry.preferred_answer,
        status=entry.status,
        source=entry.source,
        chunks=[_entry_chunk_out(chunk) for chunk in entry.chunks],
        createdAt=entry.created_at,
        updatedAt=entry.updated_at,
        reviewedAt=entry.reviewed_at,
    )


def _to_entry_summary(entry: GoldenDatasetEntry) -> EntrySummaryOut:
    return EntrySummaryOut(
        id=entry.id,
        corpusId=entry.corpus_id,
        documentId=entry.document_id,
        question=entry.question,
        status=entry.status,
        source=entry.source,
        createdAt=entry.created_at,
    )


def _build_chunk_rows(chunks: list[EntryChunkIn]) -> list[GoldenDatasetEntryChunk]:
    return [
        GoldenDatasetEntryChunk(
            chunk_id=chunk.chunkId,
            document_id=chunk.documentId,
            chunk_index=chunk.chunkIndex,
            content=chunk.content,
            position=position,
        )
        for position, chunk in enumerate(chunks)
    ]


def create_entry(
    db: Session,
    user_id: str,
    corpus_id: str,
    document_id: str | None,
    question: str,
    preferred_answer: str,
    chunks: list[EntryChunkIn],
) -> EntryOut:
    if get_corpus_owned_by(db, corpus_id, user_id) is None:
        raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")
    if document_id is not None and get_document_owned_by(db, document_id, user_id) is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")
    if not chunks:
        raise EmptyChunksError("At least one evidence chunk is required")

    entry = GoldenDatasetEntry(
        user_id=user_id,
        corpus_id=corpus_id,
        document_id=document_id,
        question=question,
        preferred_answer=preferred_answer,
        source="manual",
        status="approved",
    )
    db.add(entry)
    db.flush()

    for row in _build_chunk_rows(chunks):
        row.entry_id = entry.id
        db.add(row)

    db.commit()
    return _to_entry_out(entry)


def list_entries(
    db: Session,
    user_id: str,
    corpus_id: str,
    *,
    statuses: list[str] | None = None,
    sources: list[str] | None = None,
) -> EntryListResponse:
    if get_corpus_owned_by(db, corpus_id, user_id) is None:
        raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")

    query = select(GoldenDatasetEntry).where(GoldenDatasetEntry.corpus_id == corpus_id)
    if statuses:
        query = query.where(GoldenDatasetEntry.status.in_(statuses))
    if sources:
        query = query.where(GoldenDatasetEntry.source.in_(sources))
    query = query.order_by(GoldenDatasetEntry.created_at.desc())

    entries = list(db.execute(query).scalars())
    return EntryListResponse(entries=[_to_entry_summary(entry) for entry in entries])


def _scope_chunk_query(corpus_id: str, document_id: str | None):
    if document_id is not None:
        return select(ChunkRow).where(ChunkRow.document_id == document_id)
    return (
        select(ChunkRow)
        .join(Document, Document.id == ChunkRow.document_id)
        .join(DocumentCorpus, DocumentCorpus.document_id == Document.id)
        .where(DocumentCorpus.corpus_id == corpus_id)
    )


def _select_evidence_chunk(
    db: Session, corpus_id: str, document_id: str | None
) -> ChunkRow | None:
    """Picks one chunk to generate a question/answer from (research.md §5 — evidence-first, not
    question-first). Prefers a chunk no existing `GoldenDatasetEntryChunk` already points at,
    where practical, so repeated batch generations build variety rather than regenerating
    near-duplicate questions about the same passage — falls back to any chunk in scope if every
    chunk already has a golden entry."""
    base_query = _scope_chunk_query(corpus_id, document_id)

    referenced_chunk_ids = select(GoldenDatasetEntryChunk.chunk_id).where(
        GoldenDatasetEntryChunk.chunk_id.isnot(None)
    )
    unreferenced = db.execute(
        base_query.where(ChunkRow.id.not_in(referenced_chunk_ids)).order_by(func.random()).limit(1)
    ).scalar_one_or_none()
    if unreferenced is not None:
        return unreferenced

    return db.execute(base_query.order_by(func.random()).limit(1)).scalar_one_or_none()


def _build_generation_prompt(chunk_content: str) -> str:
    """Evidence-first synthetic QA generation (research.md §5): the chunk is given, the model
    proposes a question that chunk answers plus a grounded answer — never the reverse."""
    return (
        "Given the following passage from a document, write one clear question that this "
        "passage directly answers, and a concise answer to that question grounded only in the "
        "passage. Respond in exactly this format, with no other text:\n"
        "Question: <the question>\n"
        "Answer: <the answer>\n\n"
        f"Passage:\n{chunk_content}"
    )


def _parse_generated_qa(text: str) -> tuple[str, str]:
    question_marker = "Question:"
    answer_marker = "Answer:"
    question_start = text.find(question_marker)
    answer_start = text.find(answer_marker)
    if question_start == -1 or answer_start == -1 or answer_start < question_start:
        raise ValueError(f"Generated text did not match the expected Question/Answer format: {text!r}")

    question = text[question_start + len(question_marker) : answer_start].strip()
    answer = text[answer_start + len(answer_marker) :].strip()
    if not question or not answer:
        raise ValueError(f"Generated question or answer was empty: {text!r}")
    return question, answer


def generate_entry(db: Session, user_id: str, corpus_id: str, document_id: str | None) -> EntryOut:
    if get_corpus_owned_by(db, corpus_id, user_id) is None:
        raise FileNotFoundError(f"No corpus found with id {corpus_id!r}")
    if document_id is not None and get_document_owned_by(db, document_id, user_id) is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    chunk = _select_evidence_chunk(db, corpus_id, document_id)
    if chunk is None:
        raise InsufficientContentError("No chunked content available to generate an entry from")

    api_key = profile_service.resolve_decrypted_key(db, user_id)
    if api_key is None:
        raise NoApiKeyError(
            "No personal Anthropic API key on file — add one in your Profile to generate entries"
        )

    provider = GENERATION_PROVIDERS.get(settings.generation_provider)
    if provider is None:
        raise GenerationFailedError(f"Unknown generation provider: {settings.generation_provider!r}")

    try:
        result = provider.generate(_build_generation_prompt(chunk.content), api_key)
        question, answer = _parse_generated_qa(result.answer)
    except (GenerationError, ValueError) as exc:
        raise GenerationFailedError(str(exc)) from exc

    entry = GoldenDatasetEntry(
        user_id=user_id,
        corpus_id=corpus_id,
        document_id=document_id,
        question=question,
        preferred_answer=answer,
        source="llm_generated",
        status="pending_review",
    )
    db.add(entry)
    db.flush()
    db.add(
        GoldenDatasetEntryChunk(
            entry_id=entry.id,
            chunk_id=chunk.id,
            document_id=chunk.document_id,
            chunk_index=chunk.index,
            content=chunk.content,
            position=0,
        )
    )
    db.commit()
    return _to_entry_out(entry)


def get_entry(db: Session, user_id: str, entry_id: str) -> EntryOut:
    entry = get_golden_dataset_entry_owned_by(db, entry_id, user_id)
    if entry is None:
        raise EntryNotFoundError(f"No golden dataset entry found with id {entry_id!r}")
    return _to_entry_out(entry)


def update_entry(
    db: Session,
    user_id: str,
    entry_id: str,
    *,
    question: str | None = None,
    preferred_answer: str | None = None,
    chunks: list[EntryChunkIn] | None = None,
    status: str | None = None,
) -> EntryOut:
    entry = get_golden_dataset_entry_owned_by(db, entry_id, user_id)
    if entry is None:
        raise EntryNotFoundError(f"No golden dataset entry found with id {entry_id!r}")

    if status is not None and status not in VALID_STATUSES:
        raise InvalidStatusTransitionError(f"Unknown status: {status!r}")

    next_status = status if status is not None else entry.status
    next_chunk_count = len(chunks) if chunks is not None else len(entry.chunks)
    if next_status == "approved" and next_chunk_count == 0:
        raise EmptyChunksError("At least one evidence chunk is required to approve an entry")

    if question is not None:
        entry.question = question
    if preferred_answer is not None:
        entry.preferred_answer = preferred_answer
    if chunks is not None:
        entry.chunks.clear()
        db.flush()
        for row in _build_chunk_rows(chunks):
            row.entry_id = entry.id
            db.add(row)
    if status is not None and status != entry.status:
        entry.status = status
        if status in ("approved", "rejected"):
            entry.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    return _to_entry_out(entry)


def delete_entry(db: Session, user_id: str, entry_id: str) -> None:
    entry = get_golden_dataset_entry_owned_by(db, entry_id, user_id)
    if entry is None:
        raise EntryNotFoundError(f"No golden dataset entry found with id {entry_id!r}")
    db.delete(entry)
    db.commit()
