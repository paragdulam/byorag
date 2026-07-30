import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import require_user

# Importing app.embeddings.models runs its __init__.py, which registers "bert"
# (mirrors app.chunking.strategies's registration-on-import pattern).
from app.embeddings import service
from app.embeddings.models.base import EMBEDDING_MODEL_LABELS, EMBEDDING_MODELS
from app.embeddings.projection_methods import PROJECTION_METHODS
from app.embeddings.schemas import (
    EmbeddingModelOption,
    ListModelsResponse,
    ListProjectionMethodsResponse,
    ListSavedEmbeddingsResponse,
    ProjectionMethodOption,
    ProjectionRequest,
    ProjectionResponse,
    SavedEmbeddingOut,
)
from app.db.base import get_db
from app.db.lookups import get_chunk_owned_by
from app.db.models import User

router = APIRouter(prefix="/api/embeddings", tags=["embeddings"])


@router.get("/models")
def list_models(user: User = Depends(require_user)) -> ListModelsResponse:
    return ListModelsResponse(
        models=[
            EmbeddingModelOption(id=key, label=EMBEDDING_MODEL_LABELS[key])
            for key in EMBEDDING_MODELS
        ]
    )


@router.get("/generate/stream")
def generate_embeddings_stream(
    documentId: str,
    model: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> StreamingResponse:
    try:
        _, chunks = service.resolve_embedding_run(db, user.id, documentId, model)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def event_stream():
        try:
            for event_type, payload in service.stream_generate(chunks, model):
                data = payload.model_dump_json() if event_type == "result" else json.dumps(payload)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as exc:  # pragma: no cover - defensive, unexpected mid-stream failure
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/projection-methods")
def list_projection_methods(user: User = Depends(require_user)) -> ListProjectionMethodsResponse:
    return ListProjectionMethodsResponse(
        methods=[
            ProjectionMethodOption(id=key, label=info.label, available=info.available)
            for key, info in PROJECTION_METHODS.items()
        ]
    )


@router.post("/project")
def project_embeddings(
    request: ProjectionRequest, user: User = Depends(require_user)
) -> ProjectionResponse:
    try:
        points = service.compute_projection(request.method, request.entries)
    except service.UnknownProjectionMethodError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (
        service.InsufficientProjectionEntriesError,
        service.MismatchedProjectionDimensionsError,
    ) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ProjectionResponse(points=points)


@router.get("/saved")
def get_saved_embeddings(
    chunkId: str, db: Session = Depends(get_db), user: User = Depends(require_user)
) -> ListSavedEmbeddingsResponse:
    if get_chunk_owned_by(db, chunkId, user.id) is None:
        raise HTTPException(status_code=404, detail=f"No chunk found with id {chunkId!r}")

    embeddings = service.list_saved_embeddings(db, chunkId)
    return ListSavedEmbeddingsResponse(
        embeddings=[
            SavedEmbeddingOut(
                id=e.id, model=e.model, createdAt=e.created_at, dims=len(e.vector), vector=e.vector
            )
            for e in embeddings
        ]
    )


@router.get("/save/stream")
def save_embeddings_stream(
    documentId: str,
    model: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
) -> StreamingResponse:
    try:
        _, chunks = service.resolve_embedding_run(db, user.id, documentId, model)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def event_stream():
        try:
            for event_type, payload in service.save_embeddings(db, chunks, model):
                data = payload.model_dump_json() if event_type == "result" else json.dumps(payload)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as exc:  # pragma: no cover - defensive, unexpected mid-stream failure
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
