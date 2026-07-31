import pytest
from fastapi.testclient import TestClient

from app.evaluation.schemas import JudgeResult, QualityScores
from app.evaluation.strategies.base import JUDGES
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationResult
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


class _StubGenerationProvider:
    def generate(self, prompt: str, api_key: str) -> GenerationResult:
        return GenerationResult(model="claude-sonnet-5", answer="This is a test document.")


class _StubJudge:
    def score(self, question: str, chunks: list[str], answer: str, api_key: str) -> JudgeResult:
        return JudgeResult(
            model="claude-sonnet-5",
            scores=QualityScores(
                contextPrecision=0.8, contextRecall=0.7, responseRelevancy=0.9, faithfulness=0.6
            ),
        )


def test_pipelines_empty_for_a_corpus_with_no_saved_chunks(client: TestClient, corpus_id: str) -> None:
    response = client.get(f"/api/metrics/corpora/{corpus_id}/pipelines")

    assert response.status_code == 200
    assert response.json() == {"corpusId": corpus_id, "pipelines": []}


def test_pipelines_unknown_corpus_returns_404(client: TestClient) -> None:
    response = client.get("/api/metrics/corpora/does-not-exist/pipelines")

    assert response.status_code == 404


def test_pipeline_with_chunks_but_no_questions_has_zero_counts_and_null_scores(
    client: TestClient, corpus_id: str
) -> None:
    upload_save_chunks_and_embeddings(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get(f"/api/metrics/corpora/{corpus_id}/pipelines")

    assert response.status_code == 200
    pipelines = response.json()["pipelines"]
    assert len(pipelines) == 1
    pipeline = pipelines[0]
    assert pipeline["chunkingStrategy"] == "fixed-size"
    assert pipeline["embeddingModel"] == "bert"
    assert pipeline["retrievalStrategy"] == "cosine-similarity"
    assert pipeline["chunkCount"] == 2
    assert pipeline["questionCount"] == 0
    assert pipeline["answerCount"] == 0
    assert pipeline["scopeBreakdown"] == {"corpus": 0, "document": 0}
    assert pipeline["generationLlm"] is None
    assert pipeline["judgeLlm"] is None
    assert pipeline["scores"] is None


def test_pipeline_reports_question_and_answer_counts(client: TestClient, corpus_id: str) -> None:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "what is this about?"},
    )

    response = client.get(f"/api/metrics/corpora/{corpus_id}/pipelines")

    pipeline = response.json()["pipelines"][0]
    assert pipeline["questionCount"] == 1
    assert pipeline["answerCount"] == 0
    assert pipeline["scopeBreakdown"] == {"corpus": 0, "document": 1}


def test_pipeline_reports_generation_and_judge_llm_after_an_answered_scored_question(
    client: TestClient, corpus_id: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _StubGenerationProvider())
    monkeypatch.setitem(JUDGES, "anthropic", _StubJudge())
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    created = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "what is this about?"},
    )
    client.post(f"/api/playground/turns/{created.json()['id']}/generate")

    response = client.get(f"/api/metrics/corpora/{corpus_id}/pipelines")

    pipeline = response.json()["pipelines"][0]
    assert pipeline["generationLlm"] == "claude-sonnet-5"
    assert pipeline["judgeLlm"] == "claude-sonnet-5"
    assert pipeline["retrievalStrategy"] == "cosine-similarity"
