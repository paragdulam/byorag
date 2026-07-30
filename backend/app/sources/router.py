from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db.base import get_db
from app.db.lookups import get_corpus_owned_by, get_document_owned_by
from app.db.models import User
from app.sources import service
from app.sources.schemas import (
    AttachDocumentRequest,
    DeleteSourcesRequest,
    DeleteSourcesResponse,
    ListAllSourcesResponse,
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


@router.get("/all", response_model=ListAllSourcesResponse)
def list_all_sources(
    db: Session = Depends(get_db), user: User = Depends(require_user)
) -> ListAllSourcesResponse:
    return ListAllSourcesResponse(documents=service.list_all_documents(db, user.id))


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


@router.post("/{document_id}/corpora", status_code=204)
def attach_document_to_corpus(
    document_id: str,
    request: AttachDocumentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> None:
    try:
        service.attach_document_to_corpus(db, user.id, document_id, request.corpusId)
    except service.DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{document_id}/corpora/{corpus_id}", status_code=204)
def unlink_document_from_corpus(
    document_id: str,
    corpus_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> None:
    try:
        service.unlink_document_from_corpus(db, user.id, document_id, corpus_id)
    except service.DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.DocumentNotInCorpusError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
