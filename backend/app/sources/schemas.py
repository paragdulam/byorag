from datetime import datetime
from typing import Literal

from pydantic import BaseModel

SourceDocumentStatus = Literal["processing", "processed"]
UploadRejectionReason = Literal["invalid-type", "too-large", "save-failed"]


class SourceDocument(BaseModel):
    id: str
    name: str
    sizeBytes: int
    uploadedAt: datetime
    status: SourceDocumentStatus = "processed"


class UploadRejection(BaseModel):
    fileName: str
    reason: UploadRejectionReason


class ListSourcesResponse(BaseModel):
    documents: list[SourceDocument]


class UploadSourcesResponse(BaseModel):
    documents: list[SourceDocument]
    rejections: list[UploadRejection]


DeletionStatus = Literal["deleted", "failed"]


class DeletionResult(BaseModel):
    id: str
    status: DeletionStatus
    reason: str | None = None


class DeleteSourcesRequest(BaseModel):
    ids: list[str]


class DeleteSourcesResponse(BaseModel):
    results: list[DeletionResult]
