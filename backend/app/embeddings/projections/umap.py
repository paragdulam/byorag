import umap

from app.embeddings.projections.base import PROJECTIONS


class UmapProjection:
    """2-component UMAP over the caller-supplied embedding vectors (021-sources-chunking-
    embeddings-refresh research.md §6). `n_neighbors` is clamped below the sample count since
    UMAP requires it to be strictly smaller than the number of points being projected."""

    def project(self, vectors: list[list[float]]) -> list[list[float]]:
        n_neighbors = max(2, min(15, len(vectors) - 1))
        reducer = umap.UMAP(n_components=2, n_neighbors=n_neighbors, random_state=42)
        return reducer.fit_transform(vectors).tolist()


PROJECTIONS["umap"] = UmapProjection()
