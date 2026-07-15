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


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_run_chunking_stream_success(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": document_id, "chunkSize": 5}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)

    assert events[-1][0] == "result"
    assert any(event_type == "progress" for event_type, _ in events[:-1])

    result_payload = json.loads(events[-1][1] or "")
    assert result_payload["extractionFailed"] is False
    result = result_payload["result"]
    assert result["totalChunks"] == 4
    assert len(result["chunks"]) == 4
    assert result["strategy"] == "fixed-size"
    assert result["chunkSize"] == 5
    assert result["overlap"] == 0
    assert [c["index"] for c in result["chunks"]] == [0, 1, 2, 3]


def test_run_chunking_stream_invalid_chunk_size(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": document_id, "chunkSize": 0}
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_run_chunking_stream_unknown_document(client: TestClient) -> None:
    response = client.get(
        "/api/chunking/run/stream",
        params={"documentId": "00000000-0000-0000-0000-000000000000", "chunkSize": 5},
    )

    assert response.status_code == 404
    assert "detail" in response.json()


def test_run_chunking_stream_extraction_failed(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "empty.pdf", make_words_pdf(0))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": document_id, "chunkSize": 5}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert events[-1][0] == "result"
    result_payload = json.loads(events[-1][1] or "")
    assert result_payload["extractionFailed"] is True
    assert result_payload["result"] is None


def test_run_chunking_stream_caps_at_200_chunks(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "long.pdf", make_words_pdf(1000))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": document_id, "chunkSize": 1}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    result_payload = json.loads(events[-1][1] or "")
    result = result_payload["result"]
    assert result["totalChunks"] == 1000
    assert len(result["chunks"]) == 200


def test_run_chunking_stream_with_overlap_echoes_overlap_and_increases_total(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "long.pdf", make_words_pdf(100))

    baseline = client.get(
        "/api/chunking/run/stream",
        params={"documentId": document_id, "chunkSize": 10},
    )
    with_overlap = client.get(
        "/api/chunking/run/stream",
        params={"documentId": document_id, "chunkSize": 10, "overlap": 5},
    )

    baseline_result = json.loads(_parse_sse(baseline.text)[-1][1] or "")["result"]
    overlap_result = json.loads(_parse_sse(with_overlap.text)[-1][1] or "")["result"]

    assert overlap_result["overlap"] == 5
    assert overlap_result["totalChunks"] > baseline_result["totalChunks"]


def test_run_chunking_stream_overlap_equal_to_chunk_size_is_rejected(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/run/stream",
        params={"documentId": document_id, "chunkSize": 5, "overlap": 5},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_run_chunking_stream_negative_overlap_is_rejected(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/run/stream",
        params={"documentId": document_id, "chunkSize": 5, "overlap": -1},
    )

    assert response.status_code == 400
    assert "detail" in response.json()
