from pathlib import Path

from fastapi.testclient import TestClient


def test_list_sources_empty(client: TestClient) -> None:
    response = client.get("/api/sources")

    assert response.status_code == 200
    assert response.json() == {"documents": []}


def test_list_sources_returns_saved_file(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(b"%PDF-1.4 fake pdf contents")

    response = client.get("/api/sources")

    assert response.status_code == 200
    body = response.json()
    assert len(body["documents"]) == 1
    doc = body["documents"][0]
    assert doc["name"] == "report.pdf"
    assert doc["id"] == "report.pdf"
    assert doc["sizeBytes"] == len(b"%PDF-1.4 fake pdf contents")
    assert doc["status"] == "processed"
    assert "uploadedAt" in doc
