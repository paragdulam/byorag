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


class SavedChunk(BaseModel):
    id: str
    index: int
    content: str


class SavedChunksResponse(BaseModel):
    chunks: list[SavedChunk]


class PreviewSegment(BaseModel):
    start: int
    end: int
    kind: Literal["chunk", "overlap"]
    chunkIndex: int | None


class PagePosition(BaseModel):
    pageNumber: int
    start: int
    end: int


class ChunkRange(BaseModel):
    chunkIndex: int
    start: int
    end: int


class StructuredPreviewResponse(BaseModel):
    fullText: str
    segments: list[PreviewSegment]
    pages: list[PagePosition]
    chunkRanges: list[ChunkRange]
