import io
import re
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Literal

from pypdf import PdfReader
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.chunking import strategies  # noqa: F401  (registers "fixed-size" on import)
from app.chunking.schemas import (
    Chunk,
    ChunkingResult,
    ChunkRange,
    ChunkRunResponse,
    PagePosition,
    PreviewSegment,
)
from app.chunking.strategies.base import STRATEGIES
from app.db.lookups import get_document_owned_by
from app.db.models import Chunk as ChunkRow
from app.db.models import Document

MAX_CHUNKS = 200


class NoSavedChunksError(Exception):
    def __init__(self, document_id: str) -> None:
        self.document_id = document_id
        super().__init__(f"No saved chunks for document '{document_id}'")


class DocumentFileUnavailableError(Exception):
    def __init__(self, document_id: str) -> None:
        self.document_id = document_id
        super().__init__(f"Stored file is missing or unreadable for document '{document_id}'")

StreamEventType = Literal["progress", "result", "error"]
StreamEvent = tuple[StreamEventType, dict[str, int] | dict[str, str] | ChunkRunResponse]

_ChunkComputationStepType = Literal["progress", "computed"]


@dataclass
class _ChunkComputation:
    extraction_failed: bool
    chunks: list[Chunk]
    total_chunks: int


_ChunkComputationStep = tuple[_ChunkComputationStepType, dict[str, int] | _ChunkComputation]


def extract_text_pages(pdf_content: bytes) -> tuple[int, Iterator[str]]:
    """Returns (total_pages, iterator of per-page extracted text). `total_pages` is `0`
    when the PDF cannot be read at all (mirrors the previous `extract_text()`'s
    broad-except "no text" behavior, research.md §1). Reads directly from the document's
    database-stored bytes rather than a filesystem path (024-user-authentication
    research.md §8)."""
    try:
        reader = PdfReader(io.BytesIO(pdf_content))
        total_pages = len(reader.pages)
    except Exception:
        return 0, iter(())

    def _pages() -> Iterator[str]:
        for page in reader.pages:
            try:
                yield page.extract_text() or ""
            except Exception:
                yield ""

    return total_pages, _pages()


def resolve_run(
    db: Session,
    user_id: str,
    document_id: str,
    chunk_size: int,
    strategy: str,
    overlap: int = 0,
) -> Document:
    """Validates chunk_size/overlap/strategy/document existence-and-ownership and returns
    the resolved `Document` row — everything that can be checked synchronously before a
    streaming response opens (research.md §3). Raises ValueError/FileNotFoundError exactly
    as the previous single-shot `run_chunking()` did — a document owned by a different user
    raises the same `FileNotFoundError` as a nonexistent one (024-user-authentication
    FR-009). `overlap` must stay below `chunk_size` so the fixed-size stride
    (`chunk_size - overlap`) never reaches zero or negative (007-chunking-overlap-controls
    research.md §2). `document_id` is now the server-generated `Document` UUID
    (008-corpora-management), not an on-disk filename."""
    if chunk_size <= 0:
        raise ValueError("chunkSize must be a positive integer")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be a non-negative integer smaller than chunkSize")

    if strategy not in STRATEGIES:
        raise ValueError(f"Unsupported strategy: {strategy!r}")

    document = get_document_owned_by(db, document_id, user_id)
    if document is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    return document


def _persist_chunks(
    db: Session,
    document_id: str,
    chunks: list[Chunk],
    strategy: str,
    chunk_size: int,
    overlap: int,
) -> None:
    """Replace any previously persisted chunks for this document with the new run's
    result (research.md §9) — a re-run is a full replace, not versioned history."""
    db.execute(delete(ChunkRow).where(ChunkRow.document_id == document_id))
    db.add_all(
        ChunkRow(
            document_id=document_id,
            index=chunk.index,
            content=chunk.content,
            strategy=strategy,
            chunk_size=chunk_size,
            overlap=overlap,
        )
        for chunk in chunks
    )
    db.commit()


def _stream_chunk_computation(
    document: Document, chunk_size: int, strategy: str, overlap: int = 0
) -> Iterator[_ChunkComputationStep]:
    """Shared extraction-and-chunk-and-progress loop used by both `stream_chunking` (preview)
    and `save_chunks_stream` (persist) — mirrors `app/embeddings/service.py`'s `_stream_embed`
    reuse pattern (018-ui-polish-batch research.md §4). Yields `("progress", {"percent": int})`
    events as pages are extracted (0-90, real per-page progress — research.md §1 from `012`),
    then a final `("computed", _ChunkComputation)` step."""
    strategy_impl = STRATEGIES[strategy]
    total_pages, pages = extract_text_pages(document.content)

    page_texts: list[str] = []
    if total_pages > 0:
        for index, page_text in enumerate(pages, start=1):
            page_texts.append(page_text)
            yield "progress", {"percent": min(90, (index * 90) // total_pages)}
    else:
        yield "progress", {"percent": 100}

    text = "\n".join(page_texts).strip()
    if not text:
        yield "computed", _ChunkComputation(extraction_failed=True, chunks=[], total_chunks=0)
        return

    pieces = strategy_impl.chunk(text, chunk_size, overlap)
    total_chunks = len(pieces)
    capped_pieces = pieces[:MAX_CHUNKS]
    chunks = [Chunk(index=i, content=content) for i, content in enumerate(capped_pieces)]
    yield "computed", _ChunkComputation(
        extraction_failed=False, chunks=chunks, total_chunks=total_chunks
    )


def stream_chunking(
    document: Document, chunk_size: int, strategy: str, overlap: int = 0
) -> Iterator[StreamEvent]:
    """Yields ("progress", {"percent": int}) events as pages are extracted, then a terminal
    ("result", ChunkRunResponse) event. This is a pure preview — it never writes to the
    database; persisting a result requires a separate explicit call to `save_chunks_stream`
    (012-save-chunks-button research.md §1, §3; streamed since 018-ui-polish-batch)."""
    computation: _ChunkComputation | None = None
    for kind, payload in _stream_chunk_computation(document, chunk_size, strategy, overlap):
        if kind == "progress":
            yield "progress", payload
        else:
            computation = payload

    assert computation is not None
    if computation.extraction_failed:
        yield "result", ChunkRunResponse(extractionFailed=True, result=None)
        return

    yield "result", ChunkRunResponse(
        extractionFailed=False,
        result=ChunkingResult(
            chunks=computation.chunks,
            totalChunks=computation.total_chunks,
            strategy=strategy,
            chunkSize=chunk_size,
            overlap=overlap,
        ),
    )


def list_saved_chunks(db: Session, document_id: str) -> list[ChunkRow]:
    """Returns a document's currently saved `Chunk` rows, in `index` order — an empty
    list is a normal result for a document with nothing saved yet, not an error
    (013-bert-pgvector-embeddings data-model.md)."""
    return list(
        db.execute(
            select(ChunkRow).where(ChunkRow.document_id == document_id).order_by(ChunkRow.index)
        ).scalars()
    )


def save_chunks_stream(
    db: Session, document: Document, chunk_size: int, strategy: str, overlap: int = 0
) -> Iterator[StreamEvent]:
    """Same extraction-and-chunk-and-progress loop as `stream_chunking` (real page-by-page
    progress, not a simulated animation — 018-ui-polish-batch research.md §4), then persists
    the result, fully replacing any previously saved chunks for the document
    (012-save-chunks-button research.md §1)."""
    computation: _ChunkComputation | None = None
    for kind, payload in _stream_chunk_computation(document, chunk_size, strategy, overlap):
        if kind == "progress":
            yield "progress", payload
        else:
            computation = payload

    assert computation is not None
    if computation.extraction_failed:
        yield "result", ChunkRunResponse(extractionFailed=True, result=None)
        return

    _persist_chunks(db, document.id, computation.chunks, strategy, chunk_size, overlap)

    yield "result", ChunkRunResponse(
        extractionFailed=False,
        result=ChunkingResult(
            chunks=computation.chunks,
            totalChunks=computation.total_chunks,
            strategy=strategy,
            chunkSize=chunk_size,
            overlap=overlap,
        ),
    )


def _compute_page_positions(page_texts: list[str], raw: str, full_text: str) -> list[PagePosition]:
    """Maps each PDF page's extracted text to its character range within `full_text`
    (023-pdf-fullscreen-chunk-view research.md §3). `raw` is `"\\n".join(page_texts)` — `full_text`
    is `raw.strip()`. Page boundaries are first computed in `raw`'s offset space, then shifted by
    however much `.strip()` removed from the start, clipped to `full_text`'s bounds (dropping any
    page that collapses to zero width — e.g. a blank page), and finally re-stitched so surviving
    pages fully partition `full_text` with no gaps (each surviving page's `end` extends to the next
    surviving page's `start`, absorbing any joiner/dropped-page gap between them)."""
    raw_positions: list[tuple[int, int, int]] = []
    cursor = 0
    for page_number, text in enumerate(page_texts, start=1):
        start = cursor
        end = start + len(text)
        raw_positions.append((page_number, start, end))
        cursor = end + 1  # +1 for the "\n" joiner before the next page

    lstrip_len = len(raw) - len(raw.lstrip())
    final_len = len(full_text)

    survivors: list[tuple[int, int, int]] = []
    for page_number, start, end in raw_positions:
        shifted_start = max(0, min(start - lstrip_len, final_len))
        shifted_end = max(0, min(end - lstrip_len, final_len))
        if shifted_end > shifted_start:
            survivors.append((page_number, shifted_start, shifted_end))

    pages_out: list[PagePosition] = []
    for i, (page_number, start, _end) in enumerate(survivors):
        end = survivors[i + 1][1] if i + 1 < len(survivors) else final_len
        pages_out.append(PagePosition(pageNumber=page_number, start=start, end=end))
    return pages_out


def compute_structured_preview(
    db: Session, document: Document
) -> tuple[str, list[PreviewSegment], list[PagePosition], list[ChunkRange]]:
    """Recomputes, on demand, the document's structure-preserving extracted text plus a
    character-offset segment map of which saved chunk (or chunk-overlap) owns each range —
    for Chunked Preview v2's continuous, background-only-highlighted rendering
    (022-chunk-preview-ui-fixes research.md §1–§2) — and, additionally, per-page character
    boundaries and each saved chunk's own character range, letting a page-scoped "chunk in
    context" view be sliced from this same payload without a second endpoint
    (023-pdf-fullscreen-chunk-view research.md §2–§4). Nothing here is persisted: `chunk_size`,
    `overlap`, and `strategy` are already saved per `Chunk` row (shared across a document's
    whole current save), so the same windowing math the chunking strategy used can be re-run
    against a position-tracked word tokenization of a fresh re-extraction, without needing to
    store any new column.
    """
    saved_chunks = list_saved_chunks(db, document.id)
    if not saved_chunks:
        raise NoSavedChunksError(document.id)

    total_pages, pages = extract_text_pages(document.content)
    if total_pages == 0:
        raise DocumentFileUnavailableError(document.id)

    page_texts = list(pages)
    raw = "\n".join(page_texts)
    full_text = raw.strip()
    pages_out = _compute_page_positions(page_texts, raw, full_text)

    word_tokens = list(re.finditer(r"\S+", full_text))
    n_words = len(word_tokens)

    # For each word, the set of saved-chunk indexes whose window covers it — 2+ entries means
    # an overlap span (research.md §2: ownership only ever resolves to "exactly one chunk" or
    # "shared", regardless of how many chunks actually overlap there).
    ownership: list[set[int]] = [set() for _ in range(n_words)]
    chunk_ranges: list[ChunkRange] = []
    for chunk in saved_chunks:
        stride = chunk.chunk_size - chunk.overlap
        start_word = chunk.index * stride
        end_word = min(start_word + chunk.chunk_size, n_words)
        clamped_start = max(start_word, 0)
        for word_index in range(clamped_start, end_word):
            ownership[word_index].add(chunk.index)
        # Independent of the ownership merge above — a chunk's own true extent must stay
        # recoverable even where it overlaps a neighbor (research.md §4).
        if end_word > clamped_start:
            chunk_ranges.append(
                ChunkRange(
                    chunkIndex=chunk.index,
                    start=word_tokens[clamped_start].start(),
                    end=word_tokens[end_word - 1].end(),
                )
            )

    def _classify(owners: set[int]) -> tuple[Literal["chunk", "overlap"], int | None]:
        if len(owners) > 1:
            return "overlap", None
        return "chunk", next(iter(owners))

    # Segments must fully partition the covered range of `full_text` — including the
    # inter-word whitespace between two chunks, which belongs to neither chunk's own word
    # tokens but still has to render as part of the continuous flow. Each run's `end` is
    # therefore the *next* word's start (absorbing the whitespace between them), not this
    # run's own last word's end.
    segments: list[PreviewSegment] = []
    word_index = 0
    while word_index < n_words:
        owners = ownership[word_index]
        if not owners:
            word_index += 1
            continue

        kind, chunk_index = _classify(owners)
        run_start_index = word_index
        while (
            word_index < n_words
            and ownership[word_index]
            and _classify(ownership[word_index]) == (kind, chunk_index)
        ):
            word_index += 1
        # run covers word_tokens[run_start_index:word_index]

        start_char = word_tokens[run_start_index].start()
        end_char = word_tokens[word_index].start() if word_index < n_words else len(full_text)

        segments.append(
            PreviewSegment(start=start_char, end=end_char, kind=kind, chunkIndex=chunk_index)
        )

    return full_text, segments, pages_out, chunk_ranges
