from fastapi import APIRouter, HTTPException

from app.chunking import service
from app.chunking.schemas import ChunkRunRequest, ChunkRunResponse

router = APIRouter(prefix="/api/chunking", tags=["chunking"])


@router.post("/run", response_model=ChunkRunResponse)
def run_chunking(request: ChunkRunRequest) -> ChunkRunResponse:
    try:
        return service.run_chunking(
            document_id=request.documentId,
            chunk_size=request.chunkSize,
            strategy=request.strategy,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
