from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Chunk as ChunkRow
from tests.pdf_helpers import make_words_pdf


def upload_and_save_chunks(
    client: TestClient, corpus_id: str, name: str, content: bytes, chunk_size: int
) -> str:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]
    client.get("/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": chunk_size})
    return document_id


def _first_chunk_id(db_session: Session, document_id: str) -> str:
    return db_session.execute(
        select(ChunkRow.id).where(ChunkRow.document_id == document_id).order_by(ChunkRow.index)
    ).scalars().first()


def test_saved_embeddings_returns_newest_first_with_full_vectors(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)
    chunk_id = _first_chunk_id(db_session, document_id)

    client.get("/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"})
    client.get("/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"})

    response = client.get("/api/embeddings/saved", params={"chunkId": chunk_id})

    assert response.status_code == 200
    embeddings = response.json()["embeddings"]
    assert len(embeddings) == 2
    assert all(len(e["vector"]) == 768 for e in embeddings)
    assert all(e["dims"] == 768 for e in embeddings)
    assert all(e["model"] == "bert" for e in embeddings)
    # newest first
    assert embeddings[0]["createdAt"] >= embeddings[1]["createdAt"]
    assert embeddings[0]["id"] != embeddings[1]["id"]


def test_saved_embeddings_empty_list_when_nothing_saved(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)
    chunk_id = _first_chunk_id(db_session, document_id)

    response = client.get("/api/embeddings/saved", params={"chunkId": chunk_id})

    assert response.status_code == 200
    assert response.json() == {"embeddings": []}


def test_saved_embeddings_unknown_chunk(client: TestClient) -> None:
    response = client.get(
        "/api/embeddings/saved",
        params={"chunkId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    assert "detail" in response.json()
