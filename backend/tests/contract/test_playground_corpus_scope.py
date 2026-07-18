from fastapi.testclient import TestClient

from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


def _corpus_with_two_documents(client: TestClient, corpus_id: str) -> None:
    # Distinct word content so the two uploads don't collide on content-hash dedup and become
    # a single Document (app/sources/service.py).
    upload_save_chunks_and_embeddings(client, corpus_id, "a.pdf", make_words_pdf(10, "alpha"), 5)
    upload_save_chunks_and_embeddings(client, corpus_id, "b.pdf", make_words_pdf(10, "beta"), 5)


# --- GET /api/playground/context ---------------------------------------------------------


def test_get_context_by_corpus_id_reports_technique_and_model(client: TestClient, corpus_id: str) -> None:
    _corpus_with_two_documents(client, corpus_id)

    response = client.get("/api/playground/context", params={"corpusId": corpus_id})

    assert response.status_code == 200
    body = response.json()
    assert body["corpusId"] == corpus_id
    assert body["documentId"] is None
    assert body["chunkingStrategy"] == "fixed-size"
    assert body["embeddingModel"] == "bert"


def test_get_context_without_documentid_or_corpusid_returns_400(client: TestClient) -> None:
    response = client.get("/api/playground/context")

    assert response.status_code == 400


def test_get_context_with_both_documentid_and_corpusid_returns_400(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "a.pdf", make_words_pdf(10), 5
    )

    response = client.get(
        "/api/playground/context", params={"documentId": document_id, "corpusId": corpus_id}
    )

    assert response.status_code == 400


def test_get_context_unknown_corpus_returns_404(client: TestClient) -> None:
    response = client.get("/api/playground/context", params={"corpusId": "does-not-exist"})

    assert response.status_code == 404


# --- POST /api/playground/turns (corpus scope) --------------------------------------------


def test_create_turn_by_corpus_id_succeeds(client: TestClient, corpus_id: str) -> None:
    _corpus_with_two_documents(client, corpus_id)

    response = client.post(
        "/api/playground/turns",
        json={"corpusId": corpus_id, "model": "bert", "query": "what is this about?"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["scope"] == "corpus"
    assert body["corpusId"] == corpus_id
    assert body["documentId"] is None
    assert len(body["chunks"]) > 0


def test_create_turn_with_both_documentid_and_corpusid_returns_400(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "a.pdf", make_words_pdf(10), 5
    )

    response = client.post(
        "/api/playground/turns",
        json={
            "documentId": document_id, "corpusId": corpus_id, "model": "bert", "query": "hello",
        },
    )

    assert response.status_code == 400


def test_create_turn_with_neither_documentid_nor_corpusid_returns_400(client: TestClient) -> None:
    response = client.post(
        "/api/playground/turns", json={"model": "bert", "query": "hello"}
    )

    assert response.status_code == 400


def test_create_turn_by_corpus_id_unknown_corpus_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/playground/turns",
        json={"corpusId": "does-not-exist", "model": "bert", "query": "hello"},
    )

    assert response.status_code == 404


def test_create_turn_by_corpus_id_no_saved_embeddings_returns_400(
    client: TestClient, corpus_id: str
) -> None:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_words_pdf(10), "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]
    client.get("/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5})

    response = client.post(
        "/api/playground/turns",
        json={"corpusId": corpus_id, "model": "bert", "query": "hello"},
    )

    assert response.status_code == 400


# --- GET /api/playground/turns (corpus scope) ----------------------------------------------


def test_list_turns_by_corpus_id_returns_scope_and_corpus_fields(
    client: TestClient, corpus_id: str
) -> None:
    _corpus_with_two_documents(client, corpus_id)
    client.post(
        "/api/playground/turns",
        json={"corpusId": corpus_id, "model": "bert", "query": "a corpus-wide question"},
    )

    response = client.get("/api/playground/turns", params={"corpusId": corpus_id})

    assert response.status_code == 200
    body = response.json()
    assert body["corpusId"] == corpus_id
    assert body["documentId"] is None
    assert len(body["turns"]) == 1
    turn = body["turns"][0]
    assert turn["scope"] == "corpus"
    assert turn["corpusId"] == corpus_id
    for chunk in turn["chunks"]:
        assert chunk["documentId"] is not None


def test_list_turns_unknown_corpus_returns_404(client: TestClient) -> None:
    response = client.get("/api/playground/turns", params={"corpusId": "does-not-exist"})

    assert response.status_code == 404
