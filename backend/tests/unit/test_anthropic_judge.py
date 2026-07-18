import json
from dataclasses import dataclass

import pytest

from app.config import settings
from app.evaluation.strategies.anthropic_judge import AnthropicJudge, JudgeError


@dataclass
class _FakeTextBlock:
    text: str
    type: str = "text"


@dataclass
class _FakeMessage:
    content: list[_FakeTextBlock]
    model: str = "claude-sonnet-5"


class _FakeMessages:
    def __init__(self, response: _FakeMessage | None = None, error: Exception | None = None) -> None:
        self._response = response
        self._error = error
        self.last_call: dict | None = None

    def create(self, **kwargs):
        self.last_call = kwargs
        if self._error is not None:
            raise self._error
        assert self._response is not None
        return self._response


class _FakeAnthropicClient:
    def __init__(self, messages: _FakeMessages) -> None:
        self.messages = messages


@pytest.fixture(autouse=True)
def _configured_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", "test-key")
    monkeypatch.setattr(settings, "anthropic_model", "claude-sonnet-5")


_VALID_SCORES = {
    "contextPrecision": 0.8,
    "contextRecall": 0.7,
    "responseRelevancy": 0.9,
    "faithfulness": 0.95,
}


def _stub_response(text: str, monkeypatch: pytest.MonkeyPatch) -> _FakeMessages:
    fake_messages = _FakeMessages(response=_FakeMessage(content=[_FakeTextBlock(text=text)]))
    monkeypatch.setattr(
        "app.evaluation.strategies.anthropic_judge.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(fake_messages),
    )
    return fake_messages


def test_score_parses_a_well_formed_json_response(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_messages = _stub_response(json.dumps(_VALID_SCORES), monkeypatch)

    judge = AnthropicJudge()
    result = judge.score("What is the refund policy?", ["Refunds within 5 days."], "5 days.")

    assert result.scores.contextPrecision == 0.8
    assert result.scores.contextRecall == 0.7
    assert result.scores.responseRelevancy == 0.9
    assert result.scores.faithfulness == 0.95
    assert "What is the refund policy?" in fake_messages.last_call["messages"][0]["content"]


def test_score_returns_the_actual_model_name_from_the_response(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_messages = _FakeMessages(
        response=_FakeMessage(content=[_FakeTextBlock(text=json.dumps(_VALID_SCORES))], model="claude-opus-4-8")
    )
    monkeypatch.setattr(
        "app.evaluation.strategies.anthropic_judge.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(fake_messages),
    )

    judge = AnthropicJudge()
    result = judge.score("q", ["c"], "a")

    assert result.model == "claude-opus-4-8"


def test_score_extracts_json_embedded_in_surrounding_prose(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_response(f"Here are the scores:\n{json.dumps(_VALID_SCORES)}\nHope that helps!", monkeypatch)

    judge = AnthropicJudge()
    result = judge.score("q", ["c"], "a")

    assert result.scores.faithfulness == 0.95


def test_score_raises_judge_error_on_non_json_response(monkeypatch: pytest.MonkeyPatch) -> None:
    _stub_response("I cannot compute that.", monkeypatch)

    judge = AnthropicJudge()
    with pytest.raises(JudgeError):
        judge.score("q", ["c"], "a")


def test_score_raises_judge_error_when_a_field_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    incomplete = dict(_VALID_SCORES)
    del incomplete["faithfulness"]
    _stub_response(json.dumps(incomplete), monkeypatch)

    judge = AnthropicJudge()
    with pytest.raises(JudgeError):
        judge.score("q", ["c"], "a")


def test_score_raises_judge_error_when_a_value_is_out_of_range(monkeypatch: pytest.MonkeyPatch) -> None:
    out_of_range = dict(_VALID_SCORES, contextPrecision=1.5)
    _stub_response(json.dumps(out_of_range), monkeypatch)

    judge = AnthropicJudge()
    with pytest.raises(JudgeError):
        judge.score("q", ["c"], "a")


def test_score_raises_judge_error_when_api_key_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    judge = AnthropicJudge()
    with pytest.raises(JudgeError):
        judge.score("q", ["c"], "a")


def test_score_raises_judge_error_when_the_api_call_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_messages = _FakeMessages(error=RuntimeError("connection reset"))
    monkeypatch.setattr(
        "app.evaluation.strategies.anthropic_judge.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(fake_messages),
    )

    judge = AnthropicJudge()
    with pytest.raises(JudgeError):
        judge.score("q", ["c"], "a")
