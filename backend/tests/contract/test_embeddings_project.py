from fastapi.testclient import TestClient


def entry(chunk_id: str, document_id: str, vector: list[float]) -> dict:
    return {"chunkId": chunk_id, "documentId": document_id, "vector": vector}


def five_entries(document_id: str = "doc-1") -> list[dict]:
    return [entry(f"c{i}", document_id, [float(i), float(i) * 2, float(-i), float(i) + 1]) for i in range(5)]


def test_project_pca_returns_one_point_per_entry_in_order(client: TestClient) -> None:
    entries = five_entries()

    response = client.post("/api/embeddings/project", json={"method": "pca", "entries": entries})

    assert response.status_code == 200
    points = response.json()["points"]
    assert [p["chunkId"] for p in points] == [e["chunkId"] for e in entries]
    assert all("x" in p and "y" in p for p in points)


def test_project_umap_returns_one_point_per_entry(client: TestClient) -> None:
    entries = five_entries()

    response = client.post("/api/embeddings/project", json={"method": "umap", "entries": entries})

    assert response.status_code == 200
    assert len(response.json()["points"]) == 5


def test_project_distinguishes_documents_via_echoed_documentId(client: TestClient) -> None:
    entries = five_entries("doc-a")[:3] + five_entries("doc-b")[3:]

    response = client.post("/api/embeddings/project", json={"method": "pca", "entries": entries})

    points = response.json()["points"]
    assert [p["documentId"] for p in points] == [e["documentId"] for e in entries]


def test_project_below_minimum_entries_returns_422(client: TestClient) -> None:
    entries = five_entries()[:4]

    response = client.post("/api/embeddings/project", json={"method": "pca", "entries": entries})

    assert response.status_code == 422
    assert "5" in response.json()["detail"]


def test_project_mixed_dimensions_returns_422(client: TestClient) -> None:
    entries = five_entries()
    entries[0]["vector"] = [1.0, 2.0]  # shorter than the rest

    response = client.post("/api/embeddings/project", json={"method": "pca", "entries": entries})

    assert response.status_code == 422
    assert "dimension" in response.json()["detail"].lower()


def test_project_unknown_method_returns_400(client: TestClient) -> None:
    entries = five_entries()

    response = client.post(
        "/api/embeddings/project", json={"method": "tsne", "entries": entries}
    )

    assert response.status_code == 400
