from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.pdf_helpers import make_words_pdf


def upload_save_chunks_and_embeddings(
    client: TestClient,
    corpus_id: str,
    name: str,
    content: bytes,
    chunk_size: int,
    model: str = "bert",
) -> str:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]
    client.get("/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": chunk_size})
    client.get("/api/embeddings/save/stream", params={"documentId": document_id, "model": model})
    return document_id


def test_create_turn_success_persists_and_returns_ranked_chunks(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )

    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "what is this about?"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["question"] == "what is this about?"
    assert len(body["queryEmbedding"]) == 768
    assert len(body["chunks"]) == 2
    assert body["llmProvider"] is None
    assert body["llmModel"] is None
    assert body["prompt"] is None
    assert body["answer"] is None
    assert body["error"] is None
    assert body["answeredAt"] is None
    for chunk in body["chunks"]:
        assert set(chunk.keys()) == {"chunkId", "documentId", "index", "content", "score"}


def test_create_turn_unknown_document_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/playground/turns",
        json={"documentId": "does-not-exist", "model": "bert", "query": "hello"},
    )

    assert response.status_code == 404


def test_create_turn_unregistered_model_returns_400(client: TestClient, corpus_id: str) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )

    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "not-a-model", "query": "hello"},
    )

    assert response.status_code == 400


def test_create_turn_no_saved_embeddings_returns_400(client: TestClient, corpus_id: str) -> None:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_words_pdf(10), "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]
    client.get("/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5})

    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "hello"},
    )

    assert response.status_code == 400


def test_create_turn_empty_query_returns_422(client: TestClient, corpus_id: str) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )

    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "   "},
    )

    assert response.status_code == 422


def test_create_turn_query_too_long_returns_422(client: TestClient, corpus_id: str) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )

    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "word " * 2000},
    )

    assert response.status_code == 422


def test_list_turns_returns_turns_in_chronological_order(client: TestClient, corpus_id: str) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "first question"},
    )
    client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "second question"},
    )

    response = client.get("/api/playground/turns", params={"documentId": document_id})

    assert response.status_code == 200
    body = response.json()
    assert body["documentId"] == document_id
    assert [turn["question"] for turn in body["turns"]] == ["first question", "second question"]


def test_list_turns_empty_conversation_returns_empty_list(client: TestClient, corpus_id: str) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )

    response = client.get("/api/playground/turns", params={"documentId": document_id})

    assert response.status_code == 200
    assert response.json()["turns"] == []


def test_list_turns_unknown_document_returns_404(client: TestClient) -> None:
    response = client.get("/api/playground/turns", params={"documentId": "does-not-exist"})

    assert response.status_code == 404
