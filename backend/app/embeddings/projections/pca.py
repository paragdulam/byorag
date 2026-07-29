from sklearn.decomposition import PCA

from app.embeddings.projections.base import PROJECTIONS


class PcaProjection:
    """2-component PCA over the caller-supplied embedding vectors (021-sources-chunking-
    embeddings-refresh research.md §6)."""

    def project(self, vectors: list[list[float]]) -> list[list[float]]:
        reducer = PCA(n_components=2)
        return reducer.fit_transform(vectors).tolist()


PROJECTIONS["pca"] = PcaProjection()
