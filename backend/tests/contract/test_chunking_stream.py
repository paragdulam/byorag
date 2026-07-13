import json
from pathlib import Path

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


def test_run_chunking_stream_success(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(make_words_pdf(20))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": "report.pdf", "chunkSize": 5}
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
    assert [c["index"] for c in result["chunks"]] == [0, 1, 2, 3]


def test_run_chunking_stream_invalid_chunk_size(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(make_words_pdf(20))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": "report.pdf", "chunkSize": 0}
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_run_chunking_stream_unknown_document(client: TestClient) -> None:
    response = client.get(
        "/api/chunking/run/stream", params={"documentId": "does-not-exist.pdf", "chunkSize": 5}
    )

    assert response.status_code == 404
    assert "detail" in response.json()


def test_run_chunking_stream_extraction_failed(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "empty.pdf").write_bytes(make_words_pdf(0))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": "empty.pdf", "chunkSize": 5}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    assert events[-1][0] == "result"
    result_payload = json.loads(events[-1][1] or "")
    assert result_payload["extractionFailed"] is True
    assert result_payload["result"] is None


def test_run_chunking_stream_caps_at_200_chunks(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "long.pdf").write_bytes(make_words_pdf(1000))

    response = client.get(
        "/api/chunking/run/stream", params={"documentId": "long.pdf", "chunkSize": 1}
    )

    assert response.status_code == 200
    events = _parse_sse(response.text)
    result_payload = json.loads(events[-1][1] or "")
    result = result_payload["result"]
    assert result["totalChunks"] == 1000
    assert len(result["chunks"]) == 200
