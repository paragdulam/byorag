from typing import Protocol


class ChunkingStrategy(Protocol):
    def chunk(self, text: str, chunk_size: int, overlap: int = 0) -> list[str]: ...


STRATEGIES: dict[str, ChunkingStrategy] = {}
