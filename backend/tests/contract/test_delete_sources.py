from pathlib import Path

from fastapi.testclient import TestClient


def test_delete_sources_removes_existing_file(client: TestClient, pdfs_dir: Path) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "report.pdf").write_bytes(b"%PDF-1.4 fake pdf contents")

    response = client.post("/api/sources/delete", json={"ids": ["report.pdf"]})

    assert response.status_code == 200
    body = response.json()
    assert body["results"] == [{"id": "report.pdf", "status": "deleted", "reason": None}]
    assert not (pdfs_dir / "report.pdf").exists()


def test_delete_sources_already_absent_is_reported_as_deleted(client: TestClient) -> None:
    response = client.post("/api/sources/delete", json={"ids": ["does-not-exist.pdf"]})

    assert response.status_code == 200
    body = response.json()
    assert body["results"] == [
        {"id": "does-not-exist.pdf", "status": "deleted", "reason": None}
    ]


def test_delete_sources_returns_one_result_per_id_in_order(
    client: TestClient, pdfs_dir: Path
) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    (pdfs_dir / "a.pdf").write_bytes(b"a")
    (pdfs_dir / "b.pdf").write_bytes(b"b")

    response = client.post("/api/sources/delete", json={"ids": ["b.pdf", "a.pdf"]})

    assert response.status_code == 200
    body = response.json()
    assert [r["id"] for r in body["results"]] == ["b.pdf", "a.pdf"]
    assert all(r["status"] == "deleted" for r in body["results"])


def test_delete_sources_empty_ids_returns_empty_results(client: TestClient) -> None:
    response = client.post("/api/sources/delete", json={"ids": []})

    assert response.status_code == 200
    assert response.json() == {"results": []}
