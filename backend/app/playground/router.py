from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.evaluation import service as evaluation_service
from app.playground import service
from app.playground.schemas import (
    CreateTurnRequest,
    ListTurnsResponse,
    PlaygroundContextResponse,
    TurnOut,
)
from app.db.base import get_db
from app.db.models import User

router = APIRouter(prefix="/api/playground", tags=["playground"])


@router.get("/context")
def get_context(
    documentId: str | None = None,
    corpusId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> PlaygroundContextResponse:
    try:
        return service.get_context(db, user.id, documentId, corpus_id=corpusId)
    except service.InvalidScopeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/turns")
def list_turns(
    documentId: str | None = None,
    corpusId: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> ListTurnsResponse:
    try:
        return service.list_turns(db, user.id, documentId, corpus_id=corpusId)
    except service.InvalidScopeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/turns", status_code=201)
def create_turn(
    request: CreateTurnRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> TurnOut:
    try:
        return service.create_turn(
            db, user.id, request.documentId, request.model, request.query, corpus_id=request.corpusId
        )
    except service.InvalidScopeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (service.EmptyQueryError, service.QueryTooLongError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (service.UnsupportedModelError, service.NoSavedEmbeddingsError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/turns/{turnId}/generate")
def generate_answer(
    turnId: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> TurnOut:
    try:
        result = service.generate_answer(db, user.id, turnId)
    except service.TurnNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.NoRetrievedChunksError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.NoApiKeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.GenerationFailedError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Scored in the background so the judge's own LLM call never adds latency to the answer
    # response itself (019-metrics-dashboard research.md Decision 2).
    background_tasks.add_task(evaluation_service.score_turn, db, turnId)
    return result
