from datetime import datetime

from pydantic import BaseModel


class PlaygroundContextResponse(BaseModel):
    documentId: str
    chunkingStrategy: str | None
    embeddingModel: str | None


class CreateTurnRequest(BaseModel):
    documentId: str
    model: str
    query: str


class TurnChunkOut(BaseModel):
    chunkId: str
    index: int
    content: str
    score: float


class TurnOut(BaseModel):
    id: str
    question: str
    queryEmbedding: list[float]
    chunks: list[TurnChunkOut]
    llmProvider: str | None
    llmModel: str | None
    prompt: str | None
    answer: str | None
    error: str | None
    createdAt: datetime
    answeredAt: datetime | None


class ListTurnsResponse(BaseModel):
    documentId: str
    turns: list[TurnOut]
