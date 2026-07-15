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
    overlap: int


class ChunkRunResponse(BaseModel):
    extractionFailed: bool
    result: ChunkingResult | None = None


class ChunkSaveRequest(BaseModel):
    documentId: str
    chunkSize: int
    overlap: int = 0


class SavedChunk(BaseModel):
    id: str
    index: int
    content: str


class SavedChunksResponse(BaseModel):
    chunks: list[SavedChunk]
