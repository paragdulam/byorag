import json

from fastapi.testclient import TestClient

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


def test_generate_stream_success_returns_one_vector_per_saved_chunk(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get(
        "/api/embeddings/generate/stream", params={"documentId": document_id, "model": "bert"}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert events[-1][0] == "result"
    assert any(event_type == "progress" for event_type, _ in events[:-1])

    percents = [
        json.loads(data)["percent"] for event_type, data in events if event_type == "progress"
    ]
    assert percents == sorted(percents)

    result = json.loads(events[-1][1] or "")
    assert result["documentId"] == document_id
    assert result["model"] == "bert"
    assert len(result["vectors"]) == 2
    for vector in result["vectors"]:
        assert len(vector["vector"]) == 768
        assert vector["dims"] == 768
        assert vector["model"] == "bert"


def test_generate_stream_unregistered_model(client: TestClient, corpus_id: str) -> None:
    document_id = upload_and_save_chunks(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get(
        "/api/embeddings/generate/stream",
        params={"documentId": document_id, "model": "not-a-model"},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_generate_stream_document_with_no_saved_chunks(
    client: TestClient, corpus_id: str
) -> None:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_words_pdf(10), "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]

    response = client.get(
        "/api/embeddings/generate/stream", params={"documentId": document_id, "model": "bert"}
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_generate_stream_unknown_document(client: TestClient) -> None:
    response = client.get(
        "/api/embeddings/generate/stream",
        params={"documentId": "00000000-0000-0000-0000-000000000000", "model": "bert"},
    )

    assert response.status_code == 404
    assert "detail" in response.json()
