import json

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Chunk as ChunkRow
from app.db.models import Embedding as EmbeddingRow
from tests.pdf_helpers import make_words_pdf


def _parse_sse(text: str) -> list[tuple[str | None, str | None]]:
    events: list[tuple[str | None, str | None]] = []
    for block in text.strip("\n").split("\n\n"):
        if not block:
            continue
        event_type = None
        data = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data = line[len("data:") :].strip()
        events.append((event_type, data))
    return events


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


def _embedding_count_for_document(db_session: Session, document_id: str) -> int:
    chunk_ids = (
        db_session.execute(select(ChunkRow.id).where(ChunkRow.document_id == document_id))
        .scalars()
        .all()
    )
    return (
        db_session.execute(select(EmbeddingRow).where(EmbeddingRow.chunk_id.in_(chunk_ids)))
        .scalars()
        .all()
        .__len__()
    )


def test_save_stream_success_persists_and_returns_saved_count(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get(
        "/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert events[-1][0] == "result"
    assert any(event_type == "progress" for event_type, _ in events[:-1])

    result = json.loads(events[-1][1] or "")
    assert result["documentId"] == document_id
    assert result["model"] == "bert"
    assert result["savedCount"] == 2

    assert _embedding_count_for_document(db_session, document_id) == 2


def test_save_stream_second_save_accumulates_not_replaces(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    client.get("/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"})
    client.get("/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"})

    assert _embedding_count_for_document(db_session, document_id) == 4


def test_save_stream_invalid_model(client: TestClient, corpus_id: str) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get(
        "/api/embeddings/save/stream",
        params={"documentId": document_id, "model": "not-a-model"},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_save_stream_document_with_no_saved_chunks(client: TestClient, corpus_id: str) -> None:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_words_pdf(10), "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]

    response = client.get(
        "/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"}
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_save_stream_unknown_document(client: TestClient) -> None:
    response = client.get(
        "/api/embeddings/save/stream",
        params={"documentId": "00000000-0000-0000-0000-000000000000", "model": "bert"},
    )

    assert response.status_code == 404
    assert "detail" in response.json()
