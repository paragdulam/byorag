from datetime import datetime

from pydantic import BaseModel


class EmbeddingModelOption(BaseModel):
    id: str
    label: str


class ListModelsResponse(BaseModel):
    models: list[EmbeddingModelOption]


class EmbeddingVectorOut(BaseModel):
    chunkId: str
    model: str
    dims: int
    vector: list[float]


class EmbeddingGenerateResult(BaseModel):
    documentId: str
    model: str
    vectors: list[EmbeddingVectorOut]


class EmbeddingSaveResult(BaseModel):
    documentId: str
    model: str
    savedCount: int


class SavedEmbeddingOut(BaseModel):
    id: str
    model: str
    createdAt: datetime
    dims: int
    vector: list[float]


class ListSavedEmbeddingsResponse(BaseModel):
    embeddings: list[SavedEmbeddingOut]


class ProjectionMethodOption(BaseModel):
    id: str
    label: str
    available: bool


class ListProjectionMethodsResponse(BaseModel):
    methods: list[ProjectionMethodOption]
