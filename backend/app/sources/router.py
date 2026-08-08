from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db.base import get_db
from app.db.lookups import get_corpus_owned_by, get_document_owned_by
from app.db.models import User
from app.sources import service
from app.sources.schemas import (
    DeleteSourcesRequest,
    DeleteSourcesResponse,
    ListSourcesResponse,
    UploadRejection,
    UploadSourcesResponse,
)

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("", response_model=ListSourcesResponse)
def list_sources(
    corpusId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> ListSourcesResponse:
    if not corpusId:
        raise HTTPException(status_code=400, detail="corpusId is required")
    if get_corpus_owned_by(db, corpusId, user.id) is None:
        raise HTTPException(status_code=404, detail=f"No corpus found with id '{corpusId}'")
    return ListSourcesResponse(documents=service.list_documents(db, corpusId))


@router.post("", response_model=UploadSourcesResponse)
async def upload_sources(
    files: list[UploadFile],
    corpusId: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> UploadSourcesResponse:
    if not corpusId:
        raise HTTPException(status_code=400, detail="corpusId is required")
    if get_corpus_owned_by(db, corpusId, user.id) is None:
        raise HTTPException(status_code=404, detail=f"No corpus found with id '{corpusId}'")

    documents = []
    rejections = []

    for upload in files:
        result = service.save_file(upload, db, corpusId, user.id)
        if isinstance(result, UploadRejection):
            rejections.append(result)
        else:
            documents.append(result)

    return UploadSourcesResponse(documents=documents, rejections=rejections)


@router.get("/{document_id}/file")
def get_source_file(
    document_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)
) -> Response:
    if get_document_owned_by(db, document_id, user.id) is None:
        raise HTTPException(
            status_code=404, detail=f"No document found with id '{document_id}'"
        )

    content = service.get_document_content(db, document_id)
    return Response(content=content, media_type="application/pdf")


@router.post("/delete", response_model=DeleteSourcesResponse)
def delete_sources(
    request: DeleteSourcesRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> DeleteSourcesResponse:
    return DeleteSourcesResponse(results=service.delete_documents(db, user.id, request.ids))
