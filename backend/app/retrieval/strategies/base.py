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

    def search_corpus(
        self,
        db: Session,
        corpus_id: str,
        model: str,
        query_vector: list[float],
        limit: int,
    ) -> list[tuple[ChunkRow, str, float]]:
        """Same shape as `search`, but ranks chunks across every document currently linked to
        `corpus_id` — one global top-`limit` across the whole corpus, not top-`limit` per
        document (019-metrics-dashboard research.md Decision 4)."""
        ...


RETRIEVAL_STRATEGIES: dict[str, RetrievalStrategy] = {}

# The only registered RETRIEVAL_STRATEGIES key today, shared by `app.playground.service` (which
# actually performs retrieval) and `app.metrics.service` (which reports it on every pipeline —
# 020-metrics-stage-groups research.md §2) so the literal isn't duplicated across packages.
DEFAULT_RETRIEVAL_STRATEGY = "cosine-similarity"
