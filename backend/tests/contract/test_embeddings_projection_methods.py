from fastapi.testclient import TestClient


def test_list_projection_methods_vector_first_and_available(client: TestClient) -> None:
    response = client.get("/api/embeddings/projection-methods")

    assert response.status_code == 200
    methods = response.json()["methods"]
    assert methods[0] == {"id": "vector", "label": "Vector", "available": True}
    by_id = {m["id"]: m for m in methods}
    assert by_id["umap"]["available"] is False
    assert by_id["pca"]["available"] is False
