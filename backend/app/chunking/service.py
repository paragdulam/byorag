from pathlib import Path

from pypdf import PdfReader

from app.chunking import strategies  # noqa: F401  (registers "fixed-size" on import)
from app.chunking.schemas import Chunk, ChunkingResult, ChunkRunResponse
from app.chunking.strategies.base import STRATEGIES
from app.config import settings

MAX_CHUNKS = 200


def extract_text(pdf_path: Path) -> str:
    try:
        reader = PdfReader(str(pdf_path))
        return "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    except Exception:
        return ""


def _is_safe_document_id(document_id: str, directory: Path) -> bool:
    if not document_id or "/" in document_id or "\\" in document_id:
        return False

    candidate = (directory / document_id).resolve()
    try:
        candidate.relative_to(directory.resolve())
    except ValueError:
        return False
    return True


def run_chunking(
    document_id: str, chunk_size: int, strategy: str, pdfs_dir: Path | None = None
) -> ChunkRunResponse:
    if chunk_size <= 0:
        raise ValueError("chunkSize must be a positive integer")

    strategy_impl = STRATEGIES.get(strategy)
    if strategy_impl is None:
        raise ValueError(f"Unsupported strategy: {strategy!r}")

    directory = pdfs_dir if pdfs_dir is not None else settings.pdfs_dir

    if not _is_safe_document_id(document_id, directory):
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    document_path = directory / document_id
    if not document_path.is_file():
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    text = extract_text(document_path)
    if not text:
        return ChunkRunResponse(extractionFailed=True, result=None)

    pieces = strategy_impl.chunk(text, chunk_size)
    total_chunks = len(pieces)
    capped_pieces = pieces[:MAX_CHUNKS]
    chunks = [Chunk(index=i, content=content) for i, content in enumerate(capped_pieces)]

    return ChunkRunResponse(
        extractionFailed=False,
        result=ChunkingResult(
            chunks=chunks,
            totalChunks=total_chunks,
            strategy=strategy,
            chunkSize=chunk_size,
        ),
    )
