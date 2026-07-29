from typing import Protocol


class ProjectionStrategy(Protocol):
    def project(self, vectors: list[list[float]]) -> list[list[float]]: ...


# Mirrors app.embeddings.models.base's EMBEDDING_MODELS registry shape (constitution
# Principle I — pluggable, registry-driven): new projection methods register themselves here
# on import rather than via hardcoded branching (021-sources-chunking-embeddings-refresh
# research.md §6).
PROJECTIONS: dict[str, ProjectionStrategy] = {}
