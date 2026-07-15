from collections.abc import Iterator
from pathlib import Path
from typing import Literal

from pypdf import PdfReader
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.chunking import strategies  # noqa: F401  (registers "fixed-size" on import)
from app.chunking.schemas import Chunk, ChunkingResult, ChunkRunResponse
from app.chunking.strategies.base import STRATEGIES
from app.db.lookups import get_document_or_none
from app.db.models import Chunk as ChunkRow
from app.db.models import Document

MAX_CHUNKS = 200

StreamEventType = Literal["progress", "result", "error"]
StreamEvent = tuple[StreamEventType, dict[str, int] | dict[str, str] | ChunkRunResponse]


def extract_text_pages(pdf_path: Path) -> tuple[int, Iterator[str]]:
    """Returns (total_pages, iterator of per-page extracted text). `total_pages` is `0`
    when the PDF cannot be read at all (mirrors the previous `extract_text()`'s
    broad-except "no text" behavior, research.md §1)."""
    try:
        reader = PdfReader(str(pdf_path))
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
    document_id: str,
    chunk_size: int,
    strategy: str,
    overlap: int = 0,
) -> Document:
    """Validates chunk_size/overlap/strategy/document existence and returns the resolved
    `Document` row — everything that can be checked synchronously before a streaming
    response opens (research.md §3). Raises ValueError/FileNotFoundError exactly as the
    previous single-shot `run_chunking()` did. `overlap` must stay below `chunk_size` so
    the fixed-size stride (`chunk_size - overlap`) never reaches zero or negative
    (007-chunking-overlap-controls research.md §2). `document_id` is now the
    server-generated `Document` UUID (008-corpora-management), not an on-disk filename."""
    if chunk_size <= 0:
        raise ValueError("chunkSize must be a positive integer")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be a non-negative integer smaller than chunkSize")

    if strategy not in STRATEGIES:
        raise ValueError(f"Unsupported strategy: {strategy!r}")

    document = get_document_or_none(db, document_id)
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


def stream_chunking(
    document: Document, chunk_size: int, strategy: str, overlap: int = 0
) -> Iterator[StreamEvent]:
    """Yields ("progress", {"percent": int}) events as pages are extracted (0-90, real
    per-page progress — research.md §1), then a terminal ("result", ChunkRunResponse)
    event. This is a pure preview — it never writes to the database; persisting a
    result requires a separate explicit call to `save_chunks` (012-save-chunks-button
    research.md §1, §3)."""
    strategy_impl = STRATEGIES[strategy]
    total_pages, pages = extract_text_pages(Path(document.storage_path))

    page_texts: list[str] = []
    if total_pages > 0:
        for index, page_text in enumerate(pages, start=1):
            page_texts.append(page_text)
            yield "progress", {"percent": min(90, (index * 90) // total_pages)}
    else:
        yield "progress", {"percent": 100}

    text = "\n".join(page_texts).strip()
    if not text:
        yield "result", ChunkRunResponse(extractionFailed=True, result=None)
        return

    pieces = strategy_impl.chunk(text, chunk_size, overlap)
    total_chunks = len(pieces)
    capped_pieces = pieces[:MAX_CHUNKS]
    chunks = [Chunk(index=i, content=content) for i, content in enumerate(capped_pieces)]

    yield "result", ChunkRunResponse(
        extractionFailed=False,
        result=ChunkingResult(
            chunks=chunks,
            totalChunks=total_chunks,
            strategy=strategy,
            chunkSize=chunk_size,
            overlap=overlap,
        ),
    )


def save_chunks(
    db: Session, document: Document, chunk_size: int, strategy: str, overlap: int = 0
) -> ChunkRunResponse:
    """Recomputes the chunking result for `document` (deterministic given the same
    inputs — 012-save-chunks-button research.md §1) and persists it, fully replacing
    any previously saved chunks for that document. No progress reporting — this is a
    single-shot call, unlike `stream_chunking`'s preview path."""
    strategy_impl = STRATEGIES[strategy]
    _, pages = extract_text_pages(Path(document.storage_path))
    text = "\n".join(pages).strip()

    if not text:
        return ChunkRunResponse(extractionFailed=True, result=None)

    pieces = strategy_impl.chunk(text, chunk_size, overlap)
    total_chunks = len(pieces)
    capped_pieces = pieces[:MAX_CHUNKS]
    chunks = [Chunk(index=i, content=content) for i, content in enumerate(capped_pieces)]

    _persist_chunks(db, document.id, chunks, strategy, chunk_size, overlap)

    return ChunkRunResponse(
        extractionFailed=False,
        result=ChunkingResult(
            chunks=chunks,
            totalChunks=total_chunks,
            strategy=strategy,
            chunkSize=chunk_size,
            overlap=overlap,
        ),
    )
