from typing import Literal

from pydantic import BaseModel

ChunkingStrategyName = Literal["fixed-size"]


class ChunkRunRequest(BaseModel):
    documentId: str
    chunkSize: int
    # Not constrained to ChunkingStrategyName here: an unsupported value must be
    # rejected by the service/router as a controlled 400 (contracts/chunking-api.md),
    # not Pydantic/FastAPI's default 422 validation-error shape.
    strategy: str = "fixed-size"


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
