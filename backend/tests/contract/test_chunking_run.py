from pathlib import Path

from fastapi.testclient import TestClient

from tests.pdf_helpers import make_words_pdf


def test_run_chunking_success(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(make_words_pdf(20))

    response = client.post(
        "/api/chunking/run",
        json={"documentId": "report.pdf", "chunkSize": 5, "strategy": "fixed-size"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["extractionFailed"] is False
    result = body["result"]
    assert result["totalChunks"] == 4
    assert len(result["chunks"]) == 4
    assert result["strategy"] == "fixed-size"
    assert result["chunkSize"] == 5
    assert [c["index"] for c in result["chunks"]] == [0, 1, 2, 3]


def test_run_chunking_invalid_chunk_size(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(make_words_pdf(20))

    response = client.post(
        "/api/chunking/run",
        json={"documentId": "report.pdf", "chunkSize": 0, "strategy": "fixed-size"},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_run_chunking_unsupported_strategy(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(make_words_pdf(20))

    response = client.post(
        "/api/chunking/run",
        json={"documentId": "report.pdf", "chunkSize": 5, "strategy": "semantic"},
    )

    assert response.status_code == 400
    assert "detail" in response.json()


def test_run_chunking_unknown_document(client: TestClient) -> None:
    response = client.post(
        "/api/chunking/run",
        json={"documentId": "does-not-exist.pdf", "chunkSize": 5, "strategy": "fixed-size"},
    )

    assert response.status_code == 404
    assert "detail" in response.json()


def test_run_chunking_extraction_failed(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "empty.pdf").write_bytes(make_words_pdf(0))

    response = client.post(
        "/api/chunking/run",
        json={"documentId": "empty.pdf", "chunkSize": 5, "strategy": "fixed-size"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["extractionFailed"] is True
    assert body["result"] is None


def test_run_chunking_caps_at_200_chunks(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "long.pdf").write_bytes(make_words_pdf(1000))

    response = client.post(
        "/api/chunking/run",
        json={"documentId": "long.pdf", "chunkSize": 1, "strategy": "fixed-size"},
    )

    assert response.status_code == 200
    body = response.json()
    result = body["result"]
    assert result["totalChunks"] == 1000
    assert len(result["chunks"]) == 200
