from fastapi import APIRouter, UploadFile

from app.sources import service
from app.sources.schemas import (
    DeleteSourcesRequest,
    DeleteSourcesResponse,
    ListSourcesResponse,
    UploadRejection,
    UploadSourcesResponse,
)

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("", response_model=ListSourcesResponse)
def list_sources() -> ListSourcesResponse:
    return ListSourcesResponse(documents=service.list_documents())


@router.post("", response_model=UploadSourcesResponse)
async def upload_sources(files: list[UploadFile]) -> UploadSourcesResponse:
    documents = []
    rejections = []

    for upload in files:
        result = service.save_file(upload)
        if isinstance(result, UploadRejection):
            rejections.append(result)
        else:
            documents.append(result)

    return UploadSourcesResponse(documents=documents, rejections=rejections)


@router.post("/delete", response_model=DeleteSourcesResponse)
def delete_sources(request: DeleteSourcesRequest) -> DeleteSourcesResponse:
    return DeleteSourcesResponse(results=service.delete_documents(request.ids))
