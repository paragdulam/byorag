from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_delete_corpus_blocked_then_succeeds_once_empty(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", b"%PDF-1.4 report")

    blocked = client.delete(f"/api/corpora/{corpus_id}")
    assert blocked.status_code == 409

    # Deleting the corpus's only document (033-ui-ux-polish: a document belongs to
    # exactly one corpus now, so deleting it leaves the corpus empty) unblocks
    # corpus deletion (FR-008).
    delete_response = client.post("/api/sources/delete", json={"ids": [document_id]})
    assert delete_response.status_code == 200

    deleted = client.delete(f"/api/corpora/{corpus_id}")
    assert deleted.status_code == 204
    assert client.get("/api/sources", params={"corpusId": corpus_id}).status_code == 404
