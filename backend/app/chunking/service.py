from collections.abc import Iterator
from pathlib import Path
from typing import Literal

from pypdf import PdfReader

from app.chunking import strategies  # noqa: F401  (registers "fixed-size" on import)
from app.chunking.schemas import Chunk, ChunkingResult, ChunkRunResponse
from app.chunking.strategies.base import STRATEGIES
from app.config import settings

MAX_CHUNKS = 200

StreamEventType = Literal["progress", "result"]
StreamEvent = tuple[StreamEventType, dict[str, int] | ChunkRunResponse]


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


def _is_safe_document_id(document_id: str, directory: Path) -> bool:
    if not document_id or "/" in document_id or "\\" in document_id:
        return False

    candidate = (directory / document_id).resolve()
    try:
        candidate.relative_to(directory.resolve())
    except ValueError:
        return False
    return True


def resolve_run(
    document_id: str, chunk_size: int, strategy: str, pdfs_dir: Path | None = None
) -> Path:
    """Validates chunk_size/strategy/document existence and returns the resolved document
    path — everything that can be checked synchronously before a streaming response opens
    (research.md §3). Raises ValueError/FileNotFoundError exactly as the previous
    single-shot `run_chunking()` did."""
    if chunk_size <= 0:
        raise ValueError("chunkSize must be a positive integer")

    if strategy not in STRATEGIES:
        raise ValueError(f"Unsupported strategy: {strategy!r}")

    directory = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir

    if not _is_safe_document_id(document_id, directory):
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    document_path = directory / document_id
    if not document_path.is_file():
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    return document_path


def stream_chunking(document_path: Path, chunk_size: int, strategy: str) -> Iterator[StreamEvent]:
    """Yields ("progress", {"percent": int}) events as pages are extracted (0-90, real
    per-page progress — research.md §1), then a terminal ("result", ChunkRunResponse)
    event. `document_path`/`chunk_size`/`strategy` must already be validated via
    `resolve_run()`."""
    strategy_impl = STRATEGIES[strategy]
    total_pages, pages = extract_text_pages(document_path)

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

    pieces = strategy_impl.chunk(text, chunk_size)
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
        ),
    )
