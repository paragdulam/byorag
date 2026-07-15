from fastapi.testclient import TestClient


def test_list_sources_requires_corpus_id(client: TestClient) -> None:
    response = client.get("/api/sources")

    assert response.status_code == 400


def test_list_sources_unknown_corpus_id_returns_404(client: TestClient) -> None:
    response = client.get("/api/sources", params={"corpusId": "00000000-0000-0000-0000-000000000000"})

    assert response.status_code == 404


def test_list_sources_empty_for_new_corpus(client: TestClient) -> None:
    corpus = client.post("/api/corpora", json={"name": "Empty Corpus"}).json()

    response = client.get("/api/sources", params={"corpusId": corpus["id"]})

    assert response.status_code == 200
    assert response.json() == {"documents": []}
