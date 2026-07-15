from typing import NamedTuple


class ProjectionMethodInfo(NamedTuple):
    label: str
    available: bool


# Mirrors app.embeddings.models.base's EMBEDDING_MODELS registry shape (constitution
# Principle I — pluggable, registry-driven). "vector" is the only functional entry
# today; "umap"/"pca" are visible placeholders for future dimensionality-reduction
# work (014-vector-view-screen research.md §2) — adding real support later means
# implementing the projection and flipping `available` to `True`, not a picker redesign.
PROJECTION_METHODS: dict[str, ProjectionMethodInfo] = {
    "vector": ProjectionMethodInfo(label="Vector", available=True),
    "umap": ProjectionMethodInfo(label="UMAP", available=False),
    "pca": ProjectionMethodInfo(label="PCA", available=False),
}
