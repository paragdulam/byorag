import json

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Chunk as ChunkRow
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


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_save_stream_success_persists_and_returns_result(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert events[-1][0] == "result"
    assert any(event_type == "progress" for event_type, _ in events[:-1])

    body = json.loads(events[-1][1] or "")
    assert body["extractionFailed"] is False
    result = body["result"]
    assert result["totalChunks"] == 4
    assert result["strategy"] == "fixed-size"
    assert result["chunkSize"] == 5
    assert result["overlap"] == 0

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document_id))
        .scalars()
        .all()
    )
    assert len(rows) == 4
    assert {r.chunk_size for r in rows} == {5}


def test_save_stream_resave_replaces_previous_saved_chunks(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    client.get("/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5})
    client.get(
        "/api/chunking/save/stream",
        params={"documentId": document_id, "chunkSize": 10, "overlap": 2},
    )

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document_id))
        .scalars()
        .all()
    )
    assert {r.chunk_size for r in rows} == {10}
    assert {r.overlap for r in rows} == {2}


def test_save_stream_extraction_failed_persists_nothing(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    document_id = upload_pdf(client, corpus_id, "empty.pdf", make_words_pdf(0))

    response = client.get(
        "/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert events[-1][0] == "result"
    body = json.loads(events[-1][1] or "")
    assert body["extractionFailed"] is True
    assert body["result"] is None

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document_id))
        .scalars()
        .all()
    )
    assert rows == []


def test_save_stream_invalid_chunk_size(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 0}
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_save_stream_overlap_equal_to_chunk_size_is_rejected(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/save/stream",
        params={"documentId": document_id, "chunkSize": 5, "overlap": 5},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_save_stream_unknown_document(client: TestClient) -> None:
    response = client.get(
        "/api/chunking/save/stream",
        params={"documentId": "00000000-0000-0000-0000-000000000000", "chunkSize": 5},
    )

    assert response.status_code == 404
    assert "detail" in response.json()
