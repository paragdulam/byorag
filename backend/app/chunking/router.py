import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.chunking import service

router = APIRouter(prefix="/api/chunking", tags=["chunking"])

# The screen only ever runs fixed-size chunking (FR-002) — strategy is no longer a
# client-supplied input, unlike the 005 request body it replaces (research.md §2).
STRATEGY = "fixed-size"


@router.get("/run/stream")
def run_chunking_stream(documentId: str, chunkSize: int) -> StreamingResponse:
    try:
        document_path = service.resolve_run(
            document_id=documentId, chunk_size=chunkSize, strategy=STRATEGY
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    def event_stream():
        try:
            for event_type, payload in service.stream_chunking(document_path, chunkSize, STRATEGY):
                data = payload.model_dump_json() if event_type == "result" else json.dumps(payload)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as exc:  # pragma: no cover - defensive, unexpected mid-stream failure
            yield f"event: error\ndata: {json.dumps({'message': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
