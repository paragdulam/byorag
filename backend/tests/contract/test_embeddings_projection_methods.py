from fastapi.testclient import TestClient


def test_list_projection_methods_vector_first_and_available(client: TestClient) -> None:
    response = client.get("/api/embeddings/projection-methods")

    assert response.status_code == 200
    methods = response.json()["methods"]
    assert methods[0] == {"id": "vector", "label": "Vector", "available": True}


def test_umap_and_pca_are_now_available(client: TestClient) -> None:
    # 021-sources-chunking-embeddings-refresh: UMAP/PCA are implemented, no longer placeholders.
    response = client.get("/api/embeddings/projection-methods")

    by_id = {m["id"]: m for m in response.json()["methods"]}
    assert by_id["umap"]["available"] is True
    assert by_id["pca"]["available"] is True
