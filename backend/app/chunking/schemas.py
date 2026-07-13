from typing import Literal

from pydantic import BaseModel

ChunkingStrategyName = Literal["fixed-size"]


class Chunk(BaseModel):
    index: int
    content: str


class ChunkingResult(BaseModel):
    chunks: list[Chunk]
    totalChunks: int
    strategy: ChunkingStrategyName
    chunkSize: int


class ChunkRunResponse(BaseModel):
    extractionFailed: bool
    result: ChunkingResult | None = None
