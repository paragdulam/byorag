from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Chunk as ChunkRow
from app.db.models import Embedding as EmbeddingRow
from app.retrieval.strategies.base import RETRIEVAL_STRATEGIES


class CosineSimilarityStrategy:
    """Ranks a document's saved chunks by cosine similarity to a query vector, scoped to
    one embedding model, deduplicated to each chunk's single best-scoring saved embedding
    (016-playground-similarity-search research.md Decisions 1-2 — a chunk with more than
    one saved embedding for the same model, from repeated saves, must not appear more than
    once)."""

    def search(
        self,
        db: Session,
        document_id: str,
        model: str,
        query_vector: list[float],
        limit: int,
    ) -> list[tuple[ChunkRow, str, float]]:
        distance = EmbeddingRow.vector.cosine_distance(query_vector)

        best_per_chunk = (
            select(EmbeddingRow.chunk_id, EmbeddingRow.id.label("embedding_id"), distance.label("distance"))
            .join(ChunkRow, ChunkRow.id == EmbeddingRow.chunk_id)
            .where(ChunkRow.document_id == document_id, EmbeddingRow.model == model)
            .distinct(EmbeddingRow.chunk_id)
            .order_by(EmbeddingRow.chunk_id, distance.asc())
            .subquery()
        )

        rows = db.execute(
            select(ChunkRow, best_per_chunk.c.embedding_id, best_per_chunk.c.distance)
            .join(best_per_chunk, ChunkRow.id == best_per_chunk.c.chunk_id)
            .order_by(best_per_chunk.c.distance.asc())
            .limit(limit)
        ).all()

        return [(chunk, embedding_id, 1 - dist) for chunk, embedding_id, dist in rows]


RETRIEVAL_STRATEGIES["cosine-similarity"] = CosineSimilarityStrategy()
