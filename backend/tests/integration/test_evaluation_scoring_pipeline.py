import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db.models import TurnQualityScore
from app.evaluation.schemas import JudgeResult, QualityScores
from app.evaluation.strategies.base import JUDGES
from app.generation.providers.base import GENERATION_PROVIDERS, GenerationResult
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


class _StubGenerationProvider:
    def generate(self, prompt: str, api_key: str) -> GenerationResult:
        return GenerationResult(model="claude-sonnet-5", answer="This is a test document.")


class _StubJudge:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[str], str, str]] = []

    def score(self, question: str, chunks: list[str], answer: str, api_key: str) -> JudgeResult:
        self.calls.append((question, chunks, answer, api_key))
        return JudgeResult(
            model="claude-sonnet-5",
            scores=QualityScores(
                contextPrecision=0.8, contextRecall=0.7, responseRelevancy=0.9, faithfulness=0.6
            ),
        )


class _FailingJudge:
    def score(self, question: str, chunks: list[str], answer: str, api_key: str) -> JudgeResult:
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
    question, chunks, answer, api_key = stub_judge.calls[0]
    assert question == "what is this about?"
    assert answer == "This is a test document."
    assert len(chunks) > 0
    # 025-user-profile-anthropic-key FR-016 — the acting user's own key, not a shared one.
    assert api_key == "test-anthropic-key"


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


def test_scoring_is_skipped_when_the_turn_owners_key_is_removed_before_scoring_runs(
    client: TestClient, corpus_id: str, db_session: Session, stub_generation: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """025-user-profile-anthropic-key FR-017, Edge Cases — a user who deletes their key
    right after generating (before the background scoring task runs) gets an unscored
    turn, not a failed/blocked answer (the answer was already returned). Calls
    `playground.service.generate_answer` and `evaluation.service.score_turn` directly
    (bypassing the `/generate` HTTP route, which schedules scoring as an immediately-run
    `BackgroundTask` under `TestClient`, leaving no real window to delete the key in
    between) to isolate that timing window."""
    from app.evaluation import service as evaluation_service
    from app.playground import service as playground_service

    monkeypatch.setitem(JUDGES, "anthropic", _StubJudge())
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    created = client.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "what is this about?"},
    )
    turn_id = created.json()["id"]
    user_id = client.get("/api/auth/me").json()["id"]
    playground_service.generate_answer(db_session, user_id, turn_id)  # key still exists

    db_session.execute(text("DELETE FROM user_anthropic_keys WHERE user_id = :user_id"), {"user_id": user_id})
    db_session.commit()

    evaluation_service.score_turn(db_session, turn_id)

    score = db_session.execute(
        select(TurnQualityScore).where(TurnQualityScore.turn_id == turn_id)
    ).scalar_one_or_none()
    assert score is None


def test_a_user_with_no_anthropic_key_never_reaches_the_judge(
    client_without_anthropic_key: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """025-user-profile-anthropic-key FR-013 blocks Generation itself first when there's no
    key at all, so there's never an answered turn for the judge to be asked about."""
    monkeypatch.setitem(GENERATION_PROVIDERS, "anthropic", _StubGenerationProvider())
    stub_judge = _StubJudge()
    monkeypatch.setitem(JUDGES, "anthropic", stub_judge)
    corpus = client_without_anthropic_key.post("/api/corpora", json={"name": "Keyless Corpus"})
    corpus_id = corpus.json()["id"]

    _ask_and_generate(client_without_anthropic_key, corpus_id)

    assert stub_judge.calls == []
