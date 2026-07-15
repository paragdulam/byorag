from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str = "report.pdf") -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, b"%PDF-1.4 contents", "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_attach_document_to_another_corpus(client: TestClient, corpus_id: str) -> None:
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()
    document_id = upload_pdf(client, corpus_id)

    response = client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": other_corpus["id"]})

    assert response.status_code == 204
    docs = client.get("/api/sources", params={"corpusId": other_corpus["id"]}).json()["documents"]
    assert [d["id"] for d in docs] == [document_id]


def test_attach_document_is_idempotent(client: TestClient, corpus_id: str) -> None:
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()
    document_id = upload_pdf(client, corpus_id)

    first = client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": other_corpus["id"]})
    second = client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": other_corpus["id"]})

    assert first.status_code == 204
    assert second.status_code == 204
    docs = client.get("/api/sources", params={"corpusId": other_corpus["id"]}).json()["documents"]
    assert len(docs) == 1


def test_attach_unknown_document_returns_404(client: TestClient, corpus_id: str) -> None:
    response = client.post(
        "/api/sources/00000000-0000-0000-0000-000000000000/corpora",
        json={"corpusId": corpus_id},
    )

    assert response.status_code == 404


def test_attach_unknown_corpus_returns_404(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id)

    response = client.post(
        f"/api/sources/{document_id}/corpora",
        json={"corpusId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404


def test_unlink_from_one_of_two_corpora_keeps_document(client: TestClient, corpus_id: str) -> None:
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()
    document_id = upload_pdf(client, corpus_id)
    client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": other_corpus["id"]})

    response = client.delete(f"/api/sources/{document_id}/corpora/{corpus_id}")

    assert response.status_code == 204
    assert client.get("/api/sources", params={"corpusId": corpus_id}).json()["documents"] == []
    docs = client.get("/api/sources", params={"corpusId": other_corpus["id"]}).json()["documents"]
    assert [d["id"] for d in docs] == [document_id]


def test_unlink_from_last_corpus_deletes_document(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id)

    response = client.delete(f"/api/sources/{document_id}/corpora/{corpus_id}")

    assert response.status_code == 204
    assert client.get("/api/sources", params={"corpusId": corpus_id}).json()["documents"] == []


def test_unlink_document_not_in_corpus_returns_404(client: TestClient, corpus_id: str) -> None:
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()
    document_id = upload_pdf(client, corpus_id)

    response = client.delete(f"/api/sources/{document_id}/corpora/{other_corpus['id']}")

    assert response.status_code == 404


def test_unlink_unknown_document_returns_404(client: TestClient, corpus_id: str) -> None:
    response = client.delete(
        f"/api/sources/00000000-0000-0000-0000-000000000000/corpora/{corpus_id}"
    )

    assert response.status_code == 404
