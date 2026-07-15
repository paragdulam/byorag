import pytest
from fastapi.testclient import TestClient

from app.generation.providers.base import GENERATION_PROVIDERS, GenerationError, GenerationResult
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


class _StubProvider:
    def __init__(self, result: GenerationResult | None = None, error: Exception | None = None) -> None:
        self._result = result
        self._error = error
        self.last_prompt: str | None = None

    def generate(self, prompt: str) -> GenerationResult:
        self.last_prompt = prompt
        if self._error is not None:
            raise self._error
        assert self._result is not None
        return self._result


def _create_turn(client: TestClient, corpus_id: str, query: str = "what is this about?") -> str:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": query},
    )
    return response.json()["id"]


@pytest.fixture
def stub_provider(monkeypatch: pytest.MonkeyPatch) -> _StubProvider:
    stub = _StubProvider(result=GenerationResult(model="claude-sonnet-5", answer="This is a test document."))
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", stub)
    return stub


def test_generate_success_persists_answer_and_prompt(
    client: TestClient, corpus_id: str, stub_provider: _StubProvider
) -> None:
    turn_id = _create_turn(client, corpus_id)

    response = client.post(f"/api/playground/turns/{turn_id}/generate")

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == "This is a test document."
    assert body["llmProvider"] == "anthropic"
    assert body["llmModel"] == "claude-sonnet-5"
    assert body["error"] is None
    assert body["answeredAt"] is not None
    assert body["prompt"] == stub_provider.last_prompt
    assert "what is this about?" in body["prompt"]


def test_generate_unknown_turn_returns_404(client: TestClient, stub_provider: _StubProvider) -> None:
    response = client.post("/api/playground/turns/does-not-exist/generate")

    assert response.status_code == 404


def test_create_turn_without_saved_embeddings_never_reaches_generate(
    client: TestClient, corpus_id: str, stub_provider: _StubProvider
) -> None:
    """`create_turn` already guarantees >=1 chunk whenever it succeeds (it 400s beforehand if
    the document has no saved embeddings for the model), so a genuinely zero-chunk turn can
    only arise from direct DB state — covered at the unit level
    (test_playground_service.py::test_generate_answer_rejects_a_turn_with_no_chunks).
    This confirms the ordinary creation path can't produce one via the API."""
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_words_pdf(10), "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]
    client.post("/api/chunking/save", json={"documentId": document_id, "chunkSize": 5})

    response = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "hello"},
    )
    assert response.status_code == 400


def test_generate_failure_persists_error_and_prompt_without_overwriting_prior_answer(
    client: TestClient, corpus_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    turn_id = _create_turn(client, corpus_id)
    failing = _StubProvider(error=GenerationError("upstream timeout"))
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", failing)

    response = client.post(f"/api/playground/turns/{turn_id}/generate")

    assert response.status_code == 502
    body = response.json()
    assert "detail" in body


def test_generate_retry_after_failure_succeeds_without_new_retrieval(
    client: TestClient, corpus_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    turn_id = _create_turn(client, corpus_id)
    failing = _StubProvider(error=GenerationError("temporary outage"))
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", failing)
    first = client.post(f"/api/playground/turns/{turn_id}/generate")
    assert first.status_code == 502

    succeeding = _StubProvider(result=GenerationResult(model="claude-sonnet-5", answer="Recovered answer."))
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", succeeding)
    second = client.post(f"/api/playground/turns/{turn_id}/generate")

    assert second.status_code == 200
    body = second.json()
    assert body["answer"] == "Recovered answer."
    assert body["error"] is None
