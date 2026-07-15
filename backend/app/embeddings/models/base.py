from collections.abc import Iterator
from typing import Protocol


class EmbeddingModelStrategy(Protocol):
    def embed(self, texts: list[str]) -> Iterator[tuple[int, list[float]]]: ...

    def fits(self, text: str) -> bool: ...


EMBEDDING_MODELS: dict[str, EmbeddingModelStrategy] = {}

# Human-readable labels for the model picker (GET /api/embeddings/models), keyed by the
# same registry id — kept alongside the registry rather than on the strategy objects
# themselves, mirroring how chunking keeps display concerns out of its STRATEGIES values.
EMBEDDING_MODEL_LABELS: dict[str, str] = {}
