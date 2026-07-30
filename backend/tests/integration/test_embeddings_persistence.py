import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import service as auth_service
from app.config import settings
from app.db.base import SessionLocal
from app.db.models import Chunk, Corpus, Document, Embedding
from app.db.models import User
from app.main import app
from tests.pdf_helpers import make_words_pdf


@pytest.fixture
def real_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """Unlike the `client` fixture, this does NOT override `get_db` with a
    rolled-back session — every write here is a real, durable commit against
    `DATABASE_URL`, matching what the running app actually does. The test
    cleans up its own rows at the end. Also creates (and cleans up) a real,
    durably-committed user so requests carry a valid `Authorization` header,
    same as any other authenticated caller (024-user-authentication)."""
    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    with SessionLocal() as setup_session:
        user = auth_service.create_user(
            setup_session, f"real-client-{uuid.uuid4().hex}@example.com", "hunter22"
        )
        token = auth_service.create_session(setup_session, user.id)
        user_id = user.id

    test_client = TestClient(app)
    test_client.headers["Authorization"] = f"Bearer {token}"
    try:
        yield test_client
    finally:
        with SessionLocal() as cleanup_session:
            cleanup_session.execute(User.__table__.delete().where(User.id == user_id))
            cleanup_session.commit()


def test_saved_embeddings_survive_independent_of_the_request_session(
    real_client: TestClient,
) -> None:
    """Mirrors 012-save-chunks-button's test_restart_persistence.py: data committed via
    one request must be readable from a brand-new SessionLocal() connection, not just
    visible within the request that created it (013-bert-pgvector-embeddings US3)."""
    corpus_id: str | None = None
    document_id: str | None = None
    try:
        corpus = real_client.post(
            "/api/corpora", json={"name": "Embeddings Restart Test Corpus"}
        ).json()
        corpus_id = corpus["id"]
        upload = real_client.post(
            "/api/sources",
            data={"corpusId": corpus_id},
            files={"files": ("report.pdf", make_words_pdf(10), "application/pdf")},
        )
        document_id = upload.json()["documents"][0]["id"]

        save_chunks = real_client.get(
            "/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5}
        )
        assert save_chunks.status_code == 200

        save_embeddings = real_client.get(
            "/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"}
        )
        assert save_embeddings.status_code == 200

        with SessionLocal() as fresh_session:
            chunk_ids = (
                fresh_session.execute(select(Chunk.id).where(Chunk.document_id == document_id))
                .scalars()
                .all()
            )
            assert len(chunk_ids) == 2

            embeddings = (
                fresh_session.execute(
                    select(Embedding).where(Embedding.chunk_id.in_(chunk_ids))
                )
                .scalars()
                .all()
            )
            assert len(embeddings) == 2
            assert {e.model for e in embeddings} == {"bert"}
    finally:
        with SessionLocal() as cleanup_session:
            if document_id is not None:
                cleanup_session.execute(
                    Document.__table__.delete().where(Document.id == document_id)
                )
            if corpus_id is not None:
                cleanup_session.execute(Corpus.__table__.delete().where(Corpus.id == corpus_id))
            cleanup_session.commit()
