import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.chunking import service
from app.chunking.schemas import SavedChunk, SavedChunksResponse
from app.db.base import get_db
from app.db.lookups import get_document_or_none

router = APIRouter(prefix="/api/chunking", tags=["chunking"])

# The screen only ever runs fixed-size chunking (FR-002) — strategy is no longer a
# client-supplied input, unlike the 005 request body it replaces (research.md §2).
STRATEGY = "fixed-size"


@router.get("/run/stream")
def run_chunking_stream(
    documentId: str, chunkSize: int, overlap: int = 0, db: Session = Depends(get_db)
) -> StreamingResponse:
    try:
        document = service.resolve_run(
            db, document_id=documentId, chunk_size=chunkSize, strategy=STRATEGY, overlap=overlap
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def event_stream():
        try:
            for event_type, payload in service.stream_chunking(
                document, chunkSize, STRATEGY, overlap=overlap
            ):
                data = payload.model_dump_json() if event_type == "result" else json.dumps(payload)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as exc:  # pragma: no cover - defensive, unexpected mid-stream failure
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/save/stream")
def save_chunking_stream(
    documentId: str, chunkSize: int, overlap: int = 0, db: Session = Depends(get_db)
) -> StreamingResponse:
    try:
        document = service.resolve_run(
            db, document_id=documentId, chunk_size=chunkSize, strategy=STRATEGY, overlap=overlap
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def event_stream():
        try:
            for event_type, payload in service.save_chunks_stream(
                db, document, chunkSize, STRATEGY, overlap=overlap
            ):
                data = payload.model_dump_json() if event_type == "result" else json.dumps(payload)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as exc:  # pragma: no cover - defensive, unexpected mid-stream failure
            yield f"event: error\ndata: {json.dumps({'message': f'Failed to save chunks: {exc}'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/saved-chunks")
def get_saved_chunks(documentId: str, db: Session = Depends(get_db)) -> SavedChunksResponse:
    if get_document_or_none(db, documentId) is None:
        raise HTTPException(status_code=404, detail=f"No document found with id {documentId!r}")

    chunks = service.list_saved_chunks(db, documentId)
    return SavedChunksResponse(
        chunks=[SavedChunk(id=c.id, index=c.index, content=c.content) for c in chunks]
    )
