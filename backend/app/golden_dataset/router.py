from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.db.base import get_db
from app.db.models import User
from app.golden_dataset import service
from app.golden_dataset.schemas import (
    CandidateSearchRequest,
    CandidateSearchResponse,
    CreateEntryRequest,
    DraftAnswerRequest,
    DraftAnswerResponse,
    EntryListResponse,
    EntryOut,
    GenerateEntryRequest,
    UpdateEntryRequest,
)

router = APIRouter(prefix="/api/golden-dataset", tags=["golden-dataset"])


@router.post("/candidates")
def search_candidates(
    request: CandidateSearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> CandidateSearchResponse:
    try:
        return service.search_candidates(
            db,
            user.id,
            request.documentId,
            request.question,
            corpus_id=request.corpusId,
            answer=request.answer,
        )
    except service.InvalidScopeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.EmptyQuestionError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.QueryTooLongError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/draft-answer")
def draft_answer(
    request: DraftAnswerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> DraftAnswerResponse:
    try:
        return service.draft_answer(db, user.id, request.question, request.chunks)
    except service.EmptyChunksError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.NoApiKeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.GenerationFailedError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/entries", status_code=201)
def create_entry(
    request: CreateEntryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> EntryOut:
    try:
        return service.create_entry(
            db,
            user.id,
            request.corpusId,
            request.documentId,
            request.question,
            request.preferredAnswer,
            request.chunks,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.EmptyChunksError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/entries")
def list_entries(
    corpusId: str,
    status: list[str] = Query(default=[]),
    source: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> EntryListResponse:
    try:
        return service.list_entries(db, user.id, corpusId, statuses=status, sources=source)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/generate", status_code=201)
def generate_entry(
    request: GenerateEntryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> EntryOut:
    try:
        return service.generate_entry(db, user.id, request.corpusId, request.documentId)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.InsufficientContentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.NoApiKeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.GenerationFailedError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/entries/{entryId}")
def get_entry(
    entryId: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> EntryOut:
    try:
        return service.get_entry(db, user.id, entryId)
    except service.EntryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/entries/{entryId}")
def update_entry(
    entryId: str,
    request: UpdateEntryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> EntryOut:
    try:
        return service.update_entry(
            db,
            user.id,
            entryId,
            question=request.question,
            preferred_answer=request.preferredAnswer,
            chunks=request.chunks,
            status=request.status,
        )
    except service.EntryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (service.EmptyChunksError, service.InvalidStatusTransitionError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/entries/{entryId}", status_code=204)
def delete_entry(
    entryId: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> None:
    try:
        service.delete_entry(db, user.id, entryId)
    except service.EntryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
