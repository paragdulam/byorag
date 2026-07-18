from datetime import datetime

from pydantic import BaseModel


class PlaygroundContextResponse(BaseModel):
    documentId: str | None = None
    corpusId: str | None = None
    chunkingStrategy: str | None
    embeddingModel: str | None


class CreateTurnRequest(BaseModel):
    documentId: str | None = None
    corpusId: str | None = None
    model: str
    query: str


class TurnChunkOut(BaseModel):
    chunkId: str
    documentId: str | None = None
    index: int
    content: str
    score: float


class TurnOut(BaseModel):
    id: str
    scope: str
    documentId: str | None
    corpusId: str | None
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
    documentId: str | None = None
    corpusId: str | None = None
    turns: list[TurnOut]
