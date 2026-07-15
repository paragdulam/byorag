from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.config import settings
from app.db.base import SessionLocal
from app.db.models import Chunk, Corpus, Document, DocumentCorpus
from app.main import app
from tests.pdf_helpers import make_words_pdf


@pytest.fixture
def real_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Unlike the `client` fixture, this does NOT override `get_db` with a
    rolled-back session — every write here is a real, durable commit against
    `DATABASE_URL`, matching what the running app actually does. The test
    cleans up its own rows at the end."""
    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    return TestClient(app)


def test_data_survives_independent_of_the_request_session(real_client: TestClient) -> None:
    """Simulates "the app restarts": data committed via one request must be
    readable from a brand-new SessionLocal() connection, not just visible
    within the request that created it (spec User Story 3, Acceptance
    Scenario 1)."""
    corpus_id: str | None = None
    document_id: str | None = None
    try:
        # Everything from corpus creation onward is inside this try/finally so a
        # failed assertion never leaves durably-committed rows behind for the next
        # run to collide with (this test uses `real_client`, which commits for real).
        corpus = real_client.post("/api/corpora", json={"name": "Restart Test Corpus"}).json()
        corpus_id = corpus["id"]
        upload = real_client.post(
            "/api/sources",
            data={"corpusId": corpus_id},
            files={"files": ("report.pdf", make_words_pdf(20), "application/pdf")},
        )
        document_id = upload.json()["documents"][0]["id"]

        save = real_client.post(
            "/api/chunking/save", json={"documentId": document_id, "chunkSize": 5}
        )
        assert save.status_code == 200

        # A fresh session/connection, independent of anything the requests above
        # used — the only way this sees data is if it was truly committed.
        with SessionLocal() as fresh_session:
            persisted_corpus = fresh_session.get(Corpus, corpus_id)
            assert persisted_corpus is not None
            assert persisted_corpus.name == "Restart Test Corpus"

            persisted_document = fresh_session.get(Document, document_id)
            assert persisted_document is not None

            link = fresh_session.get(
                DocumentCorpus, {"document_id": document_id, "corpus_id": corpus_id}
            )
            assert link is not None

            chunks = (
                fresh_session.execute(select(Chunk).where(Chunk.document_id == document_id))
                .scalars()
                .all()
            )
            assert len(chunks) == 4
    finally:
        with SessionLocal() as cleanup_session:
            if document_id is not None:
                cleanup_session.execute(
                    Document.__table__.delete().where(Document.id == document_id)
                )
            if corpus_id is not None:
                cleanup_session.execute(Corpus.__table__.delete().where(Corpus.id == corpus_id))
            cleanup_session.commit()
