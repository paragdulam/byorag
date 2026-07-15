from fastapi.testclient import TestClient


def test_list_embedding_models_includes_bert_as_default(client: TestClient) -> None:
    response = client.get("/api/embeddings/models")

    assert response.status_code == 200
    body = response.json()
    assert body["models"][0] == {"id": "bert", "label": "BERT (bert-base-uncased)"}
