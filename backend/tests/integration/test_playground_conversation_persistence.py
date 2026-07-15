import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.generation.providers.base import GENERATION_PROVIDERS, GenerationResult
from tests.pdf_helpers import make_words_pdf


class _StubProvider:
    def generate(self, prompt: str) -> GenerationResult:
        return GenerationResult(model="claude-sonnet-5", answer="The persisted answer.")


@pytest.fixture
def stub_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _StubProvider())


def _upload_save_chunks_and_embeddings(
    client: TestClient, corpus_id: str, name: str, content: bytes, chunk_size: int
) -> str:
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]
    client.post("/api/chunking/save", json={"documentId": document_id, "chunkSize": chunk_size})
    client.get("/api/embeddings/save/stream", params={"documentId": document_id, "model": "bert"})
    return document_id


def test_full_cycle_create_generate_list_and_survives_rechunk(
    client: TestClient, corpus_id: str, db_session: Session, stub_provider: None
) -> None:
    document_id = _upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )

    created = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "what is this about?"},
    ).json()
    turn_id = created["id"]
    original_chunks = created["chunks"]

    generated = client.post(f"/api/playground/turns/{turn_id}/generate").json()
    assert generated["answer"] == "The persisted answer."

    # Reload via GET /turns and confirm it matches exactly what was persisted.
    listed = client.get("/api/playground/turns", params={"documentId": document_id}).json()
    assert len(listed["turns"]) == 1
    reloaded = listed["turns"][0]
    assert reloaded["id"] == turn_id
    assert reloaded["question"] == "what is this about?"
    assert reloaded["answer"] == "The persisted answer."
    assert reloaded["chunks"] == original_chunks

    # Re-chunk the document (deletes and replaces its Chunk/Embedding rows —
    # 012-save-chunks-button / 016 data-model.md assumption) with a different chunk size so
    # the new Chunk rows are genuinely different from the ones the turn originally matched.
    client.post("/api/chunking/save", json={"documentId": document_id, "chunkSize": 3})

    # The turn's chunk snapshots survive: content/index/score — the durable record
    # (research.md Decision 1) — are unchanged, even though the original Chunk/Embedding
    # rows they best-effort-linked to are now gone. `chunkId` is allowed to change: with the
    # live chunk gone, the service falls back to the snapshot row's own stable id.
    after_rechunk = client.get("/api/playground/turns", params={"documentId": document_id}).json()
    assert len(after_rechunk["turns"]) == 1
    surviving_chunks = after_rechunk["turns"][0]["chunks"]
    assert [{"index": c["index"], "content": c["content"], "score": c["score"]} for c in surviving_chunks] == [
        {"index": c["index"], "content": c["content"], "score": c["score"]} for c in original_chunks
    ]
    assert all(c["chunkId"] for c in surviving_chunks)
    assert after_rechunk["turns"][0]["answer"] == "The persisted answer."
