from collections.abc import Iterator
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking.service import list_saved_chunks
from app.db.lookups import get_document_owned_by
from app.db.models import Chunk as ChunkRow
from app.db.models import Document
from app.db.models import Embedding as EmbeddingRow
from app.embeddings.models.base import EMBEDDING_MODELS
from app.embeddings.projection_methods import PROJECTION_METHODS
from app.embeddings.projections import base as projections_base
from app.embeddings.projections import pca, umap  # noqa: F401  (register "pca"/"umap" on import)
from app.embeddings.schemas import (
    EmbeddingGenerateResult,
    EmbeddingSaveResult,
    EmbeddingVectorOut,
    ProjectionPointOut,
    ProjectionRequestEntry,
)

MIN_PROJECTION_ENTRIES = 5


class UnknownProjectionMethodError(Exception):
    def __init__(self, method: str) -> None:
        super().__init__(f"Unknown or unavailable projection method {method!r}.")


class InsufficientProjectionEntriesError(Exception):
    def __init__(self, count: int) -> None:
        self.count = count
        super().__init__(
            f"At least {MIN_PROJECTION_ENTRIES} embedded chunks are required to compute a "
            f"projection; received {count}."
        )


class MismatchedProjectionDimensionsError(Exception):
    def __init__(self) -> None:
        super().__init__("All vectors must have the same dimension; received mixed dimensions.")


def compute_projection(
    method: str, entries: list[ProjectionRequestEntry]
) -> list[ProjectionPointOut]:
    """Computes a 2D projection (UMAP/PCA) over caller-supplied embedding vectors
    (021-sources-chunking-embeddings-refresh contracts/embeddings-projection-api.md). The
    frontend is expected to keep the projection method disabled below the minimum entry count —
    this is a defensive server-side re-check, not the primary UX gate."""
    method_info = PROJECTION_METHODS.get(method)
    if method_info is None or not method_info.available or method not in projections_base.PROJECTIONS:
        raise UnknownProjectionMethodError(method)

    if len(entries) < MIN_PROJECTION_ENTRIES:
        raise InsufficientProjectionEntriesError(len(entries))

    dims = {len(entry.vector) for entry in entries}
    if len(dims) > 1:
        raise MismatchedProjectionDimensionsError()

    strategy = projections_base.PROJECTIONS[method]
    coordinates = strategy.project([entry.vector for entry in entries])

    return [
        ProjectionPointOut(chunkId=entry.chunkId, documentId=entry.documentId, x=x, y=y)
        for entry, (x, y) in zip(entries, coordinates, strict=True)
    ]

StreamEventType = Literal["progress", "result", "error"]
StreamEvent = tuple[
    StreamEventType, dict[str, int] | dict[str, str] | EmbeddingGenerateResult | EmbeddingSaveResult
]

_EmbedStepType = Literal["progress", "vectors"]
_EmbedStep = tuple[_EmbedStepType, dict[str, int] | list[EmbeddingVectorOut]]


def resolve_embedding_run(
    db: Session, user_id: str, document_id: str, model: str
) -> tuple[Document, list[ChunkRow]]:
    """Validates model/document-ownership/saved-chunks existence and returns the resolved
    `Document` plus its saved `Chunk` rows — everything that can be checked synchronously
    before a streaming response opens (mirrors chunking's `resolve_run`,
    013-bert-pgvector-embeddings contracts/embeddings-api.md). A document owned by a
    different user raises the same `FileNotFoundError` as a nonexistent one
    (024-user-authentication FR-009)."""
    if model not in EMBEDDING_MODELS:
        raise ValueError(f"Unsupported embedding model: {model!r}")

    document = get_document_owned_by(db, document_id, user_id)
    if document is None:
        raise FileNotFoundError(f"No document found with id {document_id!r}")

    chunks = list_saved_chunks(db, document_id)
    if not chunks:
        raise ValueError("Document has no saved chunks to embed")

    return document, chunks


def _stream_embed(chunks: list[ChunkRow], model: str) -> Iterator[_EmbedStep]:
    """Shared embed-and-progress loop used by both `stream_generate` and
    `save_embeddings` (research.md §6 — reuse, don't duplicate). Yields a `"progress"`
    step per chunk embedded, then a final `"vectors"` step with the full list."""
    strategy = EMBEDDING_MODELS[model]
    total_chunks = len(chunks)

    vectors: list[EmbeddingVectorOut] = []
    for index, vector in strategy.embed([c.content for c in chunks]):
        chunk = chunks[index]
        vectors.append(
            EmbeddingVectorOut(chunkId=chunk.id, model=model, dims=len(vector), vector=vector)
        )
        embedded = index + 1
        yield "progress", {
            "percent": round(embedded / total_chunks * 100),
            "chunksEmbedded": embedded,
            "totalChunks": total_chunks,
        }

    yield "vectors", vectors


def stream_generate(chunks: list[ChunkRow], model: str) -> Iterator[StreamEvent]:
    """Yields ("progress", {...}) events as each chunk is embedded, then a terminal
    ("result", EmbeddingGenerateResult) event. Pure preview — never writes to the
    database (research.md §4-5)."""
    vectors: list[EmbeddingVectorOut] = []
    for kind, payload in _stream_embed(chunks, model):
        if kind == "progress":
            yield "progress", payload
        else:
            vectors = payload

    yield "result", EmbeddingGenerateResult(
        documentId=chunks[0].document_id, model=model, vectors=vectors
    )


def save_embeddings(db: Session, chunks: list[ChunkRow], model: str) -> Iterator[StreamEvent]:
    """Same embed-and-progress loop as `stream_generate`, then persists one new
    `Embedding` row per chunk — never deletes or updates any existing row, even for the
    same chunk/model pair (research.md §6: accumulate, never replace)."""
    vectors: list[EmbeddingVectorOut] = []
    for kind, payload in _stream_embed(chunks, model):
        if kind == "progress":
            yield "progress", payload
        else:
            vectors = payload

    db.add_all(
        EmbeddingRow(chunk_id=v.chunkId, model=v.model, vector=v.vector) for v in vectors
    )
    db.commit()

    yield "result", EmbeddingSaveResult(
        documentId=chunks[0].document_id, model=model, savedCount=len(vectors)
    )


def list_saved_embeddings(db: Session, chunk_id: str) -> list[EmbeddingRow]:
    """Returns a chunk's saved `Embedding` rows, newest first (014-vector-view-screen
    research.md §3 — drives the default selection when a chunk has more than one)."""
    return list(
        db.execute(
            select(EmbeddingRow)
            .where(EmbeddingRow.chunk_id == chunk_id)
            .order_by(EmbeddingRow.created_at.desc())
        ).scalars()
    )
