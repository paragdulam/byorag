import pytest
from fastapi.testclient import TestClient

from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError, GenerationResult
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


@pytest.fixture
def stub_generation_provider(monkeypatch: pytest.MonkeyPatch) -> GenerationResult:
    result = GenerationResult(model="claude-sonnet-5", answer="Drafted answer text.")

    class _Stub:
        def generate(self, prompt: str, api_key: str) -> GenerationResult:
            return result

    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _Stub())
    return result


@pytest.fixture
def failing_generation_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Failing:
        def generate(self, prompt: str, api_key: str) -> GenerationResult:
            raise GenerationError("upstream timeout")

    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _Failing())


def _prepared_document(client: TestClient, corpus_id: str, name: str = "report.pdf") -> str:
    return upload_save_chunks_and_embeddings(client, corpus_id, name, make_words_pdf(20), 5)


# ---------------------------------------------------------------------------
# POST /api/golden-dataset/candidates
# ---------------------------------------------------------------------------


def test_candidates_question_only_search_returns_results_with_matched_answer_false(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/candidates",
        json={"documentId": document_id, "question": "what is this document about?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["candidates"]) > 0
    assert all(c["matchedAnswer"] is False for c in body["candidates"])
    assert all(c["matchedQuestion"] is True for c in body["candidates"])


def test_candidates_question_and_answer_search_labels_matched_both(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/candidates",
        json={
            "documentId": document_id,
            "question": "what is this document about?",
            "answer": "word word word word word",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["candidates"]) > 0
    assert any(c["matchedQuestion"] and c["matchedAnswer"] for c in body["candidates"])


def test_candidates_rejects_both_document_and_corpus_scope(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/candidates",
        json={"documentId": document_id, "corpusId": corpus_id, "question": "hello"},
    )

    assert response.status_code == 400


def test_candidates_rejects_blank_question(client: TestClient, corpus_id: str) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/candidates", json={"documentId": document_id, "question": "  "}
    )

    assert response.status_code == 400


def test_candidates_returns_404_for_unowned_document(client: TestClient) -> None:
    response = client.post(
        "/api/golden-dataset/candidates",
        json={"documentId": "does-not-exist", "question": "hello"},
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/golden-dataset/draft-answer
# ---------------------------------------------------------------------------


def test_draft_answer_returns_generated_text(
    client: TestClient, stub_generation_provider: GenerationResult
) -> None:
    response = client.post(
        "/api/golden-dataset/draft-answer",
        json={
            "question": "What is the notice period?",
            "chunks": [{"chunkIndex": 0, "content": "30 days written notice is required."}],
        },
    )

    assert response.status_code == 200
    assert response.json()["draftAnswer"] == stub_generation_provider.answer


def test_draft_answer_rejects_empty_chunks(client: TestClient) -> None:
    response = client.post(
        "/api/golden-dataset/draft-answer", json={"question": "What is the notice period?", "chunks": []}
    )

    assert response.status_code == 400


def test_draft_answer_blocked_with_no_api_key(client_without_anthropic_key: TestClient) -> None:
    response = client_without_anthropic_key.post(
        "/api/golden-dataset/draft-answer",
        json={
            "question": "What is the notice period?",
            "chunks": [{"chunkIndex": 0, "content": "30 days written notice is required."}],
        },
    )

    assert response.status_code == 400


def test_draft_answer_returns_502_on_generation_failure(
    client: TestClient, failing_generation_provider: None
) -> None:
    response = client.post(
        "/api/golden-dataset/draft-answer",
        json={
            "question": "What is the notice period?",
            "chunks": [{"chunkIndex": 0, "content": "30 days written notice is required."}],
        },
    )

    assert response.status_code == 502


# ---------------------------------------------------------------------------
# POST /api/golden-dataset/entries
# ---------------------------------------------------------------------------


def test_create_entry_with_a_chunk_succeeds_as_approved_manual(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/entries",
        json={
            "corpusId": corpus_id,
            "documentId": document_id,
            "question": "What is the notice period?",
            "preferredAnswer": "30 days written notice.",
            "chunks": [
                {
                    "chunkId": None,
                    "documentId": document_id,
                    "chunkIndex": 0,
                    "content": "30 days written notice is required.",
                }
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "approved"
    assert body["source"] == "manual"
    assert len(body["chunks"]) == 1
    assert body["chunks"][0]["content"] == "30 days written notice is required."


def test_create_entry_rejects_empty_chunks(client: TestClient, corpus_id: str) -> None:
    response = client.post(
        "/api/golden-dataset/entries",
        json={
            "corpusId": corpus_id,
            "documentId": None,
            "question": "What is the notice period?",
            "preferredAnswer": "30 days.",
            "chunks": [],
        },
    )

    assert response.status_code == 400


def test_create_entry_returns_404_for_unowned_corpus(client: TestClient) -> None:
    response = client.post(
        "/api/golden-dataset/entries",
        json={
            "corpusId": "does-not-exist",
            "documentId": None,
            "question": "What is the notice period?",
            "preferredAnswer": "30 days.",
            "chunks": [{"chunkId": None, "documentId": None, "chunkIndex": 0, "content": "x"}],
        },
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/golden-dataset/entries
# ---------------------------------------------------------------------------


def _create_entry(
    client: TestClient, corpus_id: str, document_id: str, question: str = "Q?"
) -> dict:
    response = client.post(
        "/api/golden-dataset/entries",
        json={
            "corpusId": corpus_id,
            "documentId": document_id,
            "question": question,
            "preferredAnswer": "A.",
            "chunks": [
                {"chunkId": None, "documentId": document_id, "chunkIndex": 0, "content": "evidence"}
            ],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_list_entries_returns_entries_for_the_corpus(client: TestClient, corpus_id: str) -> None:
    document_id = _prepared_document(client, corpus_id)
    _create_entry(client, corpus_id, document_id, "Question one?")
    _create_entry(client, corpus_id, document_id, "Question two?")

    response = client.get("/api/golden-dataset/entries", params={"corpusId": corpus_id})

    assert response.status_code == 200
    questions = {e["question"] for e in response.json()["entries"]}
    assert questions == {"Question one?", "Question two?"}


def test_list_entries_filters_by_status_and_source_combined(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)
    _create_entry(client, corpus_id, document_id, "Manual approved question?")

    response = client.get(
        "/api/golden-dataset/entries",
        params={"corpusId": corpus_id, "status": "approved", "source": "manual"},
    )
    assert response.status_code == 200
    assert len(response.json()["entries"]) == 1

    response_mismatch = client.get(
        "/api/golden-dataset/entries",
        params={"corpusId": corpus_id, "status": "pending_review", "source": "manual"},
    )
    assert response_mismatch.status_code == 200
    assert len(response_mismatch.json()["entries"]) == 0


# ---------------------------------------------------------------------------
# POST /api/golden-dataset/generate
# ---------------------------------------------------------------------------


@pytest.fixture
def stub_qa_generation_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Stub:
        def generate(self, prompt: str, api_key: str) -> GenerationResult:
            return GenerationResult(
                model="claude-sonnet-5",
                answer="Question: What does this passage say?\nAnswer: It says some words.",
            )

    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _Stub())


def test_generate_succeeds_as_pending_review_llm_generated(
    client: TestClient, corpus_id: str, stub_qa_generation_provider: None
) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/generate", json={"corpusId": corpus_id, "documentId": document_id}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending_review"
    assert body["source"] == "llm_generated"
    assert body["question"] == "What does this passage say?"
    assert body["preferredAnswer"] == "It says some words."
    assert len(body["chunks"]) == 1
    assert body["chunks"][0]["content"]


def test_generate_returns_400_when_scope_has_no_chunked_content(
    client: TestClient, corpus_id: str, stub_qa_generation_provider: None
) -> None:
    response = client.post("/api/golden-dataset/generate", json={"corpusId": corpus_id})

    assert response.status_code == 400


def test_generate_blocked_with_no_api_key(
    client_without_anthropic_key: TestClient,
) -> None:
    corpus = client_without_anthropic_key.post("/api/corpora", json={"name": "Keyless Corpus"})
    corpus_id = corpus.json()["id"]
    document_id = upload_save_chunks_and_embeddings(
        client_without_anthropic_key, corpus_id, "report.pdf", make_words_pdf(20), 5
    )

    response = client_without_anthropic_key.post(
        "/api/golden-dataset/generate", json={"corpusId": corpus_id, "documentId": document_id}
    )

    assert response.status_code == 400


def test_generate_returns_502_and_saves_nothing_on_generation_failure(
    client: TestClient, corpus_id: str, failing_generation_provider: None
) -> None:
    document_id = _prepared_document(client, corpus_id)

    response = client.post(
        "/api/golden-dataset/generate", json={"corpusId": corpus_id, "documentId": document_id}
    )

    assert response.status_code == 502

    listed = client.get("/api/golden-dataset/entries", params={"corpusId": corpus_id})
    assert listed.json()["entries"] == []


# ---------------------------------------------------------------------------
# GET /api/golden-dataset/entries/{id}
# ---------------------------------------------------------------------------


def test_get_entry_returns_full_entry_with_chunks(client: TestClient, corpus_id: str) -> None:
    document_id = _prepared_document(client, corpus_id)
    created = _create_entry(client, corpus_id, document_id, "Full fetch question?")

    response = client.get(f"/api/golden-dataset/entries/{created['id']}")

    assert response.status_code == 200
    body = response.json()
    assert body["question"] == "Full fetch question?"
    assert len(body["chunks"]) == 1


def test_get_entry_returns_404_for_unowned_entry(client: TestClient) -> None:
    response = client.get("/api/golden-dataset/entries/does-not-exist")

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /api/golden-dataset/entries/{id}
# ---------------------------------------------------------------------------


def test_patch_entry_edits_fields(client: TestClient, corpus_id: str) -> None:
    document_id = _prepared_document(client, corpus_id)
    created = _create_entry(client, corpus_id, document_id, "Original question?")

    response = client.patch(
        f"/api/golden-dataset/entries/{created['id']}", json={"question": "Edited question?"}
    )

    assert response.status_code == 200
    assert response.json()["question"] == "Edited question?"


def test_patch_entry_approves_a_pending_review_entry(
    client: TestClient, corpus_id: str, stub_qa_generation_provider: None
) -> None:
    document_id = _prepared_document(client, corpus_id)
    generated = client.post(
        "/api/golden-dataset/generate", json={"corpusId": corpus_id, "documentId": document_id}
    ).json()

    response = client.patch(
        f"/api/golden-dataset/entries/{generated['id']}", json={"status": "approved"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"


def test_patch_entry_rejects_a_pending_review_entry(
    client: TestClient, corpus_id: str, stub_qa_generation_provider: None
) -> None:
    document_id = _prepared_document(client, corpus_id)
    generated = client.post(
        "/api/golden-dataset/generate", json={"corpusId": corpus_id, "documentId": document_id}
    ).json()

    response = client.patch(
        f"/api/golden-dataset/entries/{generated['id']}", json={"status": "rejected"}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"


def test_patch_entry_reopens_a_rejected_entry_to_pending_review_or_approved(
    client: TestClient, corpus_id: str, stub_qa_generation_provider: None
) -> None:
    document_id = _prepared_document(client, corpus_id)
    generated = client.post(
        "/api/golden-dataset/generate", json={"corpusId": corpus_id, "documentId": document_id}
    ).json()
    client.patch(f"/api/golden-dataset/entries/{generated['id']}", json={"status": "rejected"})

    back_to_pending = client.patch(
        f"/api/golden-dataset/entries/{generated['id']}", json={"status": "pending_review"}
    )
    assert back_to_pending.status_code == 200
    assert back_to_pending.json()["status"] == "pending_review"

    approved = client.patch(
        f"/api/golden-dataset/entries/{generated['id']}", json={"status": "approved"}
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


def test_patch_entry_rejects_leaving_zero_chunks_on_an_approved_entry(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)
    created = _create_entry(client, corpus_id, document_id, "Chunk removal question?")

    response = client.patch(f"/api/golden-dataset/entries/{created['id']}", json={"chunks": []})

    assert response.status_code == 400


# ---------------------------------------------------------------------------
# DELETE /api/golden-dataset/entries/{id}
# ---------------------------------------------------------------------------


def test_delete_entry_succeeds_and_removes_it_from_the_list(
    client: TestClient, corpus_id: str
) -> None:
    document_id = _prepared_document(client, corpus_id)
    created = _create_entry(client, corpus_id, document_id, "Deletable question?")

    response = client.delete(f"/api/golden-dataset/entries/{created['id']}")

    assert response.status_code == 204
    listed = client.get("/api/golden-dataset/entries", params={"corpusId": corpus_id})
    assert created["id"] not in [e["id"] for e in listed.json()["entries"]]


def test_delete_entry_returns_404_for_unowned_entry(client: TestClient) -> None:
    response = client.delete("/api/golden-dataset/entries/does-not-exist")

    assert response.status_code == 404
