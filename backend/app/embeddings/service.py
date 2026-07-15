from collections.abc import Iterator
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking.service import list_saved_chunks
from app.db.lookups import get_document_or_none
from app.db.models import Chunk as ChunkRow
from app.db.models import Document
from app.db.models import Embedding as EmbeddingRow
from app.embeddings.models.base import EMBEDDING_MODELS
from app.embeddings.schemas import EmbeddingGenerateResult, EmbeddingSaveResult, EmbeddingVectorOut

StreamEventType = Literal["progress", "result", "error"]
StreamEvent = tuple[
    StreamEventType, dict[str, int] | dict[str, str] | EmbeddingGenerateResult | EmbeddingSaveResult
]

_EmbedStepType = Literal["progress", "vectors"]
_EmbedStep = tuple[_EmbedStepType, dict[str, int] | list[EmbeddingVectorOut]]


def resolve_embedding_run(db: Session, document_id: str, model: str) -> tuple[Document, list[ChunkRow]]:
    """Validates model/document/saved-chunks existence and returns the resolved
    `Document` plus its saved `Chunk` rows — everything that can be checked
    synchronously before a streaming response opens (mirrors chunking's `resolve_run`,
    013-bert-pgvector-embeddings contracts/embeddings-api.md)."""
    if model not in EMBEDDING_MODELS:
        raise ValueError(f"Unsupported embedding model: {model!r}")

    document = get_document_or_none(db, document_id)
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
