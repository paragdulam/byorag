from fastapi.testclient import TestClient


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_list_all_sources_empty(client: TestClient) -> None:
    response = client.get("/api/sources/all")

    assert response.status_code == 200
    assert response.json() == {"documents": []}


def test_list_all_sources_returns_document_with_its_corpus_id(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", b"%PDF-1.4 contents")

    response = client.get("/api/sources/all")

    assert response.status_code == 200
    documents = response.json()["documents"]
    assert len(documents) == 1
    assert documents[0]["id"] == document_id
    assert documents[0]["name"] == "report.pdf"
    assert documents[0]["corpusIds"] == [corpus_id]


def test_list_all_sources_document_in_two_corpora_reports_both_no_duplicates(
    client: TestClient, corpus_id: str
) -> None:
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()["id"]
    document_id = upload_pdf(client, corpus_id, "shared.pdf", b"%PDF-1.4 shared")
    client.post(f"/api/sources/{document_id}/corpora", json={"corpusId": other_corpus})

    response = client.get("/api/sources/all")

    documents = response.json()["documents"]
    assert len(documents) == 1
    assert set(documents[0]["corpusIds"]) == {corpus_id, other_corpus}


def test_list_all_sources_includes_documents_from_every_corpus(
    client: TestClient, corpus_id: str
) -> None:
    other_corpus = client.post("/api/corpora", json={"name": "Other"}).json()["id"]
    upload_pdf(client, corpus_id, "a.pdf", b"%PDF-1.4 a")
    upload_pdf(client, other_corpus, "b.pdf", b"%PDF-1.4 b")

    response = client.get("/api/sources/all")

    names = {d["name"] for d in response.json()["documents"]}
    assert names == {"a.pdf", "b.pdf"}
