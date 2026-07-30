from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_get_file_returns_the_stored_pdf_bytes(client: TestClient, corpus_id: str) -> None:
    content = b"%PDF-1.4 fake pdf contents"
    document_id = upload_pdf(client, corpus_id, "report.pdf", content)

    response = client.get(f"/api/sources/{document_id}/file")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content == content


def test_get_file_unknown_id_returns_404(client: TestClient) -> None:
    response = client.get("/api/sources/00000000-0000-0000-0000-000000000000/file")

    assert response.status_code == 404
    assert "no document found" in response.json()["detail"].lower()
