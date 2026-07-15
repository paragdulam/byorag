from fastapi.testclient import TestClient


def test_list_corpora_empty(client: TestClient) -> None:
    response = client.get("/api/corpora")

    assert response.status_code == 200
    assert response.json() == {"corpora": []}


def test_create_corpus_returns_201_with_corpus(client: TestClient) -> None:
    response = client.post("/api/corpora", json={"name": "Research Notes"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Research Notes"
    assert "id" in body
    assert "createdAt" in body


def test_create_corpus_appears_in_list(client: TestClient) -> None:
    client.post("/api/corpora", json={"name": "Research Notes"})

    response = client.get("/api/corpora")

    assert response.status_code == 200
    names = [c["name"] for c in response.json()["corpora"]]
    assert names == ["Research Notes"]


def test_create_corpus_rejects_empty_name(client: TestClient) -> None:
    response = client.post("/api/corpora", json={"name": "   "})

    assert response.status_code == 400


def test_create_corpus_rejects_duplicate_name(client: TestClient) -> None:
    client.post("/api/corpora", json={"name": "Research Notes"})

    response = client.post("/api/corpora", json={"name": "Research Notes"})

    assert response.status_code == 409


def test_rename_corpus(client: TestClient) -> None:
    created = client.post("/api/corpora", json={"name": "Old Name"}).json()

    response = client.patch(f"/api/corpora/{created['id']}", json={"name": "New Name"})

    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_rename_corpus_not_found(client: TestClient) -> None:
    response = client.patch("/api/corpora/00000000-0000-0000-0000-000000000000", json={"name": "X"})

    assert response.status_code == 404


def test_delete_empty_corpus_succeeds(client: TestClient) -> None:
    created = client.post("/api/corpora", json={"name": "Temp"}).json()

    response = client.delete(f"/api/corpora/{created['id']}")

    assert response.status_code == 204
    assert client.get("/api/corpora").json()["corpora"] == []


def test_delete_corpus_not_found(client: TestClient) -> None:
    response = client.delete("/api/corpora/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
