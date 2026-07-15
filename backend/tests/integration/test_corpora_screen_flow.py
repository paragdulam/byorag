from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_attach_existing_document_discovered_via_list_all_then_remove(
    client: TestClient, corpus_id: str
) -> None:
    corpus_a = corpus_id
    corpus_b = client.post("/api/corpora", json={"name": "Corpus B"}).json()["id"]
    document_id = upload_pdf(client, corpus_a, "handbook.pdf", b"%PDF-1.4 handbook")

    # The Corpora screen discovers this document (from Corpus A) via the
    # unscoped listing while managing Corpus B.
    all_docs = client.get("/api/sources/all").json()["documents"]
    candidate = next(d for d in all_docs if d["id"] == document_id)
    assert candidate["corpusIds"] == [corpus_a]

    # Attach it to Corpus B without re-uploading (FR-006).
    attach = client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": corpus_b})
    assert attach.status_code == 204

    all_docs = client.get("/api/sources/all").json()["documents"]
    candidate = next(d for d in all_docs if d["id"] == document_id)
    assert set(candidate["corpusIds"]) == {corpus_a, corpus_b}

    docs_b = client.get("/api/sources", params={"corpusId": corpus_b}).json()["documents"]
    assert [d["id"] for d in docs_b] == [document_id]

    # Remove it from Corpus A (FR-007); it survives in Corpus B.
    unlink = client.delete(f"/api/sources/{document_id}/corpora/{corpus_a}")
    assert unlink.status_code == 204

    all_docs = client.get("/api/sources/all").json()["documents"]
    candidate = next(d for d in all_docs if d["id"] == document_id)
    assert candidate["corpusIds"] == [corpus_b]


def test_delete_corpus_blocked_then_succeeds_once_empty(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", b"%PDF-1.4 report")

    blocked = client.delete(f"/api/corpora/{corpus_id}")
    assert blocked.status_code == 409

    # Removing the document from its only corpus deletes it entirely (FR-008).
    unlink = client.delete(f"/api/sources/{document_id}/corpora/{corpus_id}")
    assert unlink.status_code == 204

    deleted = client.delete(f"/api/corpora/{corpus_id}")
    assert deleted.status_code == 204
    assert client.get("/api/sources/all").json()["documents"] == []
