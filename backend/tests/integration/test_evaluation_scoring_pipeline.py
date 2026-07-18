import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import TurnQualityScore
from app.evaluation.schemas import JudgeResult, QualityScores
from app.evaluation.strategies.base import JUDGES
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationResult
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


class _StubGenerationProvider:
    def generate(self, prompt: str) -> GenerationResult:
        return GenerationResult(model="claude-sonnet-5", answer="This is a test document.")


class _StubJudge:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str], str]] = []

    def score(self, question: str, chunks: list[str], answer: str) -> JudgeResult:
        self.calls.append((question, chunks, answer))
        return JudgeResult(
            model="claude-sonnet-5",
            scores=QualityScores(
                contextPrecision=0.8, contextRecall=0.7, responseRelevancy=0.9, faithfulness=0.6
            ),
        )


class _FailingJudge:
    def score(self, question: str, chunks: list[str], answer: str) -> JudgeResult:
        raise RuntimeError("judge unavailable")


@pytest.fixture
def stub_generation(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _StubGenerationProvider())


def _ask_and_generate(client: TestClient, corpus_id: str) -> str:
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    created = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "what is this about?"},
    )
    turn_id = created.json()["id"]
    client.post(f"/api/playground/turns/{turn_id}/generate")
    return turn_id


def test_generating_an_answer_scores_the_turn_in_the_background(
    client: TestClient, corpus_id: str, db_session: Session, stub_generation: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stub_judge = _StubJudge()
    monkeypatch.setitem(JUDGES, "anthropic", stub_judge)

    turn_id = _ask_and_generate(client, corpus_id)

    score = db_session.execute(
        select(TurnQualityScore).where(TurnQualityScore.turn_id == turn_id)
    ).scalar_one_or_none()
    assert score is not None
    assert score.context_precision == 0.8
    assert score.context_recall == 0.7
    assert score.response_relevancy == 0.9
    assert score.faithfulness == 0.6
    assert score.judge == "anthropic"
    assert score.judge_model == "claude-sonnet-5"
    assert len(stub_judge.calls) == 1
    question, chunks, answer = stub_judge.calls[0]
    assert question == "what is this about?"
    assert answer == "This is a test document."
    assert len(chunks) > 0


def test_a_failing_judge_leaves_the_turn_unscored_without_failing_the_request(
    client: TestClient, corpus_id: str, db_session: Session, stub_generation: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setitem(JUDGES, "anthropic", _FailingJudge())

    turn_id = _ask_and_generate(client, corpus_id)

    score = db_session.execute(
        select(TurnQualityScore).where(TurnQualityScore.turn_id == turn_id)
    ).scalar_one_or_none()
    assert score is None
