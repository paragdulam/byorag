from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user
from app.corpora import service
from app.corpora.schemas import (
    CorpusResponse,
    CreateCorpusRequest,
    ListCorporaResponse,
    RenameCorpusRequest,
)
from app.db.base import get_db
from app.db.models import Corpus, User

router = APIRouter(prefix="/api/corpora", tags=["corpora"])


def _to_response(corpus: Corpus) -> CorpusResponse:
    return CorpusResponse(id=corpus.id, name=corpus.name, createdAt=corpus.created_at)


@router.get("", response_model=ListCorporaResponse)
def list_corpora(
    db: Session = Depends(get_db), user: User = Depends(require_user)
) -> ListCorporaResponse:
    corpora = service.list_corpora(db, user.id)
    return ListCorporaResponse(corpora=[_to_response(corpus) for corpus in corpora])


@router.post("", response_model=CorpusResponse, status_code=201)
def create_corpus(
    request: CreateCorpusRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> CorpusResponse:
    try:
        corpus = service.create_corpus(db, user.id, request.name)
    except service.EmptyCorpusNameError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.DuplicateCorpusNameError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _to_response(corpus)


@router.patch("/{corpus_id}", response_model=CorpusResponse)
def rename_corpus(
    corpus_id: str,
    request: RenameCorpusRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> CorpusResponse:
    try:
        corpus = service.rename_corpus(db, user.id, corpus_id, request.name)
    except service.EmptyCorpusNameError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except service.DuplicateCorpusNameError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _to_response(corpus)


@router.delete("/{corpus_id}", status_code=204)
def delete_corpus(
    corpus_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)
) -> None:
    try:
        service.delete_corpus(db, user.id, corpus_id)
    except service.CorpusNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.CorpusNotEmptyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
