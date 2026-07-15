from typing import Protocol

from sqlalchemy.orm import Session

from app.db.models import Chunk as ChunkRow


class RetrievalStrategy(Protocol):
    def search(
        self,
        db: Session,
        document_id: str,
        model: str,
        query_vector: list[float],
        limit: int,
    ) -> list[tuple[ChunkRow, str, float]]:
        """Returns (chunk, matched embedding id, similarity score) tuples, best match first.
        The embedding id lets callers persist which specific saved embedding matched
        (017 spec FR-016), on top of the chunk's already-deduplicated best score."""
        ...


RETRIEVAL_STRATEGIES: dict[str, RetrievalStrategy] = {}
