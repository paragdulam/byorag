from datetime import datetime
from typing import Literal

from pydantic import BaseModel

SourceDocumentStatus = Literal["processing", "processed"]
UploadRejectionReason = Literal["invalid-type", "too-large", "save-failed"]


class SourceDocument(BaseModel):
    """`id` is the server-generated Document UUID (008-corpora-management) —
    no longer the on-disk filename, since dedup'd re-uploads mean a filename
    is not guaranteed unique."""

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


class AttachDocumentRequest(BaseModel):
    corpusId: str


class AllSourceDocument(SourceDocument):
    """A document annotated with every corpus it's currently associated with
    (009-corpora-screen) — used by the Corpora screen's "add existing
    document" picker to exclude documents already in the corpus being
    managed."""

    corpusIds: list[str]


class ListAllSourcesResponse(BaseModel):
    documents: list[AllSourceDocument]
