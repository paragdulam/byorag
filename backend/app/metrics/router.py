from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.metrics import service
from app.metrics.schemas import ListCorporaResponse, ListPipelinesResponse

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/corpora")
def list_corpora(db: Session = Depends(get_db)) -> ListCorporaResponse:
    return service.list_corpora_summary(db)


@router.get("/corpora/{corpusId}/pipelines")
def list_pipelines(corpusId: str, db: Session = Depends(get_db)) -> ListPipelinesResponse:
    try:
        return service.list_pipelines(db, corpusId)
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/corpora/{corpusId}/compare")
def compare_pipelines(corpusId: str, db: Session = Depends(get_db)) -> ListPipelinesResponse:
    try:
        result = service.list_pipelines(db, corpusId)
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if len(result.pipelines) < 2:
        raise HTTPException(
            status_code=400, detail=str(service.NotEnoughPipelinesError(corpusId))
        )
    return result
