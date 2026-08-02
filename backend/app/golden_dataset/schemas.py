from datetime import datetime

from pydantic import BaseModel


class CandidateSearchRequest(BaseModel):
    corpusId: str | None = None
    documentId: str | None = None
    question: str
    answer: str | None = None


class CandidateOut(BaseModel):
    chunkId: str
    documentId: str | None = None
    chunkIndex: int
    content: str
    matchedQuestion: bool
    matchedAnswer: bool


class CandidateSearchResponse(BaseModel):
    candidates: list[CandidateOut]


class DraftAnswerChunkIn(BaseModel):
    chunkIndex: int
    content: str


class DraftAnswerRequest(BaseModel):
    question: str
    chunks: list[DraftAnswerChunkIn]


class DraftAnswerResponse(BaseModel):
    draftAnswer: str


class EntryChunkIn(BaseModel):
    chunkId: str | None = None
    documentId: str | None = None
    chunkIndex: int
    content: str


class CreateEntryRequest(BaseModel):
    corpusId: str
    documentId: str | None = None
    question: str
    preferredAnswer: str
    chunks: list[EntryChunkIn]


class GenerateEntryRequest(BaseModel):
    # corpusId is always required (unlike the search-facing endpoints) — a generated entry
    # always needs a home corpus for GoldenDatasetEntry.corpus_id, which is NOT NULL by design
    # (data-model.md — "scoped per corpus, optionally narrowed to one document" is the entry's
    # own scoping model, distinct from the exactly-one-of XOR scope search/retrieval uses).
    # documentId, when given, narrows chunk sampling to that one document within the corpus.
    corpusId: str
    documentId: str | None = None


class UpdateEntryRequest(BaseModel):
    question: str | None = None
    preferredAnswer: str | None = None
    chunks: list[EntryChunkIn] | None = None
    status: str | None = None


class EntryChunkOut(BaseModel):
    id: str
    chunkId: str | None = None
    documentId: str | None = None
    chunkIndex: int
    content: str


class EntryOut(BaseModel):
    id: str
    corpusId: str
    documentId: str | None
    question: str
    preferredAnswer: str
    status: str
    source: str
    chunks: list[EntryChunkOut]
    createdAt: datetime
    updatedAt: datetime
    reviewedAt: datetime | None


class EntrySummaryOut(BaseModel):
    id: str
    corpusId: str
    documentId: str | None
    question: str
    status: str
    source: str
    createdAt: datetime


class EntryListResponse(BaseModel):
    entries: list[EntrySummaryOut]
