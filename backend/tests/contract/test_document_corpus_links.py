from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str = "report.pdf") -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, b"%PDF-1.4 contents", "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_attach_document_to_corpus_endpoint_no_longer_exists(
    client: TestClient, corpus_id: str
) -> None:
    """033-ui-ux-polish: a document belongs to exactly one corpus now, set at upload time —
    there is no longer a way to attach an existing document to another corpus."""
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()
    document_id = upload_pdf(client, corpus_id)

    response = client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": other_corpus["id"]})

    assert response.status_code == 404


def test_unlink_document_from_corpus_endpoint_no_longer_exists(
    client: TestClient, corpus_id: str
) -> None:
    """033-ui-ux-polish: removing a document from its corpus means deleting it outright via
    `POST /api/sources/delete`, not unlinking it from one of several corpora."""
    document_id = upload_pdf(client, corpus_id)

    response = client.delete(f"/api/sources/{document_id}/corpora/{corpus_id}")

    assert response.status_code == 404
