from datetime import datetime

from pydantic import BaseModel


class CorpusResponse(BaseModel):
    id: str
    name: str
    createdAt: datetime


class ListCorporaResponse(BaseModel):
    corpora: list[CorpusResponse]


class CreateCorpusRequest(BaseModel):
    name: str


class RenameCorpusRequest(BaseModel):
    name: str
