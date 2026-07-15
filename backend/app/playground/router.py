from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.playground import service
from app.playground.schemas import (
    CreateTurnRequest,
    ListTurnsResponse,
    PlaygroundContextResponse,
    TurnOut,
)
from app.db.base import get_db

router = APIRouter(prefix="/api/playground", tags=["playground"])


@router.get("/context")
def get_context(documentId: str, db: Session = Depends(get_db)) -> PlaygroundContextResponse:
    try:
        return service.get_context(db, documentId)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/turns")
def list_turns(documentId: str, db: Session = Depends(get_db)) -> ListTurnsResponse:
    try:
        return service.list_turns(db, documentId)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/turns", status_code=201)
def create_turn(request: CreateTurnRequest, db: Session = Depends(get_db)) -> TurnOut:
    try:
        return service.create_turn(db, request.documentId, request.model, request.query)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (service.EmptyQueryError, service.QueryTooLongError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (service.UnsupportedModelError, service.NoSavedEmbeddingsError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/turns/{turnId}/generate")
def generate_answer(turnId: str, db: Session = Depends(get_db)) -> TurnOut:
    try:
        return service.generate_answer(db, turnId)
    except service.TurnNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.NoRetrievedChunksError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.GenerationFailedError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
