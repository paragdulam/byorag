from typing import Protocol


class ChunkingStrategy(Protocol):
    def chunk(self, text: str, chunk_size: int) -> list[str]: ...


STRATEGIES: dict[str, ChunkingStrategy] = {}
