from typing import NamedTuple


class ProjectionMethodInfo(NamedTuple):
    label: str
    available: bool


# Mirrors app.embeddings.models.base's EMBEDDING_MODELS registry shape (constitution
# Principle I — pluggable, registry-driven). "umap"/"pca" were visible-but-disabled
# placeholders (014-vector-view-screen research.md §2); both are now backed by real
# implementations in app.embeddings.projections (021-sources-chunking-embeddings-refresh).
PROJECTION_METHODS: dict[str, ProjectionMethodInfo] = {
    "vector": ProjectionMethodInfo(label="Vector", available=True),
    "umap": ProjectionMethodInfo(label="UMAP", available=True),
    "pca": ProjectionMethodInfo(label="PCA", available=True),
}
