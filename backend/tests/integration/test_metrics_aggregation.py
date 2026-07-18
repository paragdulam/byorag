from fastapi.testclient import TestClient

from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


def test_metrics_scope_breakdown_reflects_both_entire_corpus_and_document_questions(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "a.pdf", make_words_pdf(10, "alpha"), 5
    )
    upload_save_chunks_and_embeddings(client, corpus_id, "b.pdf", make_words_pdf(10, "beta"), 5)

    client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "a document question"},
    )
    client.post(
        "/api/playground/turns",
        json={"corpusId": corpus_id, "model": "bert", "query": "an entire-corpus question"},
    )
    client.post(
        "/api/playground/turns",
        json={"corpusId": corpus_id, "model": "bert", "query": "another entire-corpus question"},
    )

    response = client.get(f"/api/metrics/corpora/{corpus_id}/pipelines")

    assert response.status_code == 200
    pipeline = response.json()["pipelines"][0]
    assert pipeline["questionCount"] == 3
    assert pipeline["scopeBreakdown"] == {"corpus": 2, "document": 1}
