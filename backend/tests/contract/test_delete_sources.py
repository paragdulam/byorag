from pathlib import Path

from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_delete_sources_removes_existing_file(
    client: TestClient, pdfs_dir: Path, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", b"%PDF-1.4 fake pdf contents")

    response = client.post("/api/sources/delete", json={"ids": [document_id]})

    assert response.status_code == 200
    body = response.json()
    assert body["results"] == [{"id": document_id, "status": "deleted", "reason": None}]
    assert client.get("/api/sources", params={"corpusId": corpus_id}).json()["documents"] == []


def test_delete_sources_unknown_id_is_reported_as_deleted(client: TestClient) -> None:
    response = client.post(
        "/api/sources/delete", json={"ids": ["00000000-0000-0000-0000-000000000000"]}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["results"] == [
        {"id": "00000000-0000-0000-0000-000000000000", "status": "deleted", "reason": None}
    ]


def test_delete_sources_returns_one_result_per_id_in_order(
    client: TestClient, corpus_id: str
) -> None:
    id_a = upload_pdf(client, corpus_id, "a.pdf", b"aaaaaaaaaaaaaaaaaaaa")
    id_b = upload_pdf(client, corpus_id, "b.pdf", b"bbbbbbbbbbbbbbbbbbbb")

    response = client.post("/api/sources/delete", json={"ids": [id_b, id_a]})

    assert response.status_code == 200
    body = response.json()
    assert [r["id"] for r in body["results"]] == [id_b, id_a]
    assert all(r["status"] == "deleted" for r in body["results"])


def test_delete_sources_empty_ids_returns_empty_results(client: TestClient) -> None:
    response = client.post("/api/sources/delete", json={"ids": []})

    assert response.status_code == 200
    assert response.json() == {"results": []}
