from fastapi.testclient import TestClient

from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


def test_list_corpora_reports_chunking_strategies_and_has_pipelines(
    client: TestClient, corpus_id: str
) -> None:
    upload_save_chunks_and_embeddings(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get("/api/metrics/corpora")

    assert response.status_code == 200
    body = response.json()
    entry = next(c for c in body["corpora"] if c["corpusId"] == corpus_id)
    assert entry["chunkingStrategies"] == ["fixed-size"]
    assert entry["hasPipelines"] is True


def test_list_corpora_reports_no_pipelines_for_an_empty_corpus(
    client: TestClient, corpus_id: str
) -> None:
    response = client.get("/api/metrics/corpora")

    assert response.status_code == 200
    body = response.json()
    entry = next(c for c in body["corpora"] if c["corpusId"] == corpus_id)
    assert entry["chunkingStrategies"] == []
    assert entry["hasPipelines"] is False
