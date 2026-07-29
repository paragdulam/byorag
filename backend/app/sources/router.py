from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.lookups import get_corpus_or_none
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
def list_sources(corpusId: str | None = None, db: Session = Depends(get_db)) -> ListSourcesResponse:
    if not corpusId:
        raise HTTPException(status_code=400, detail="corpusId is required")
    if get_corpus_or_none(db, corpusId) is None:
        raise HTTPException(status_code=404, detail=f"No corpus found with id '{corpusId}'")
    return ListSourcesResponse(documents=service.list_documents(db, corpusId))


@router.get("/all", response_model=ListAllSourcesResponse)
def list_all_sources(db: Session = Depends(get_db)) -> ListAllSourcesResponse:
    return ListAllSourcesResponse(documents=service.list_all_documents(db))


@router.post("", response_model=UploadSourcesResponse)
async def upload_sources(
    files: list[UploadFile],
    corpusId: str | None = Form(None),
    db: Session = Depends(get_db),
) -> UploadSourcesResponse:
    if not corpusId:
        raise HTTPException(status_code=400, detail="corpusId is required")
    if get_corpus_or_none(db, corpusId) is None:
        raise HTTPException(status_code=404, detail=f"No corpus found with id '{corpusId}'")

    documents = []
    rejections = []

    for upload in files:
        result = service.save_file(upload, db, corpusId)
        if isinstance(result, UploadRejection):
            rejections.append(result)
        else:
            documents.append(result)

    return UploadSourcesResponse(documents=documents, rejections=rejections)


@router.get("/{document_id}/file")
def get_source_file(document_id: str, db: Session = Depends(get_db)) -> FileResponse:
    try:
        path = service.get_document_file_path(db, document_id)
    except service.DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Stored file is missing or unreadable for document '{document_id}'",
        ) from exc

    return FileResponse(path, media_type="application/pdf")


@router.post("/delete", response_model=DeleteSourcesResponse)
def delete_sources(
    request: DeleteSourcesRequest, db: Session = Depends(get_db)
) -> DeleteSourcesResponse:
    return DeleteSourcesResponse(results=service.delete_documents(db, request.ids))


@router.post("/{document_id}/corpora", status_code=204)
def attach_document_to_corpus(
    document_id: str, request: AttachDocumentRequest, db: Session = Depends(get_db)
) -> None:
    try:
        service.attach_document_to_corpus(db, document_id, request.corpusId)
    except service.DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{document_id}/corpora/{corpus_id}", status_code=204)
def unlink_document_from_corpus(
    document_id: str, corpus_id: str, db: Session = Depends(get_db)
) -> None:
    try:
        service.unlink_document_from_corpus(db, document_id, corpus_id)
    except service.DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.DocumentNotInCorpusError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
