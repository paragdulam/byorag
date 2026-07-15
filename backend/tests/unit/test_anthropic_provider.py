from dataclasses import dataclass

import pytest

from app.config import settings
from app.generation.providers.anthropic_provider import AnthropicProvider
from app.generation.providers.base import GenerationError


@dataclass
class _FakeTextBlock:
    text: str
    type: str = "text"


@dataclass
class _FakeMessage:
    content: list[_FakeTextBlock]
    model: str


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


def test_generate_returns_text_and_model_from_a_successful_response(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_response = _FakeMessage(content=[_FakeTextBlock(text="Refunds take 5 days.")], model="claude-sonnet-5")
    fake_messages = _FakeMessages(response=fake_response)
    monkeypatch.setattr(
        "app.generation.providers.anthropic_provider.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(fake_messages),
    )

    provider = AnthropicProvider()
    result = provider.generate("Answer using only the context below...\n\nQuestion: refund policy?")

    assert result.answer == "Refunds take 5 days."
    assert result.model == "claude-sonnet-5"
    assert fake_messages.last_call["messages"] == [
        {"role": "user", "content": "Answer using only the context below...\n\nQuestion: refund policy?"}
    ]


def test_generate_raises_generation_error_when_api_key_is_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    provider = AnthropicProvider()
    with pytest.raises(GenerationError):
        provider.generate("some prompt")


def test_generate_raises_generation_error_when_the_api_call_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_messages = _FakeMessages(error=RuntimeError("connection reset"))
    monkeypatch.setattr(
        "app.generation.providers.anthropic_provider.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(fake_messages),
    )

    provider = AnthropicProvider()
    with pytest.raises(GenerationError):
        provider.generate("some prompt")


def test_generate_raises_generation_error_on_an_empty_response(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_response = _FakeMessage(content=[], model="claude-sonnet-5")
    fake_messages = _FakeMessages(response=fake_response)
    monkeypatch.setattr(
        "app.generation.providers.anthropic_provider.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(fake_messages),
    )

    provider = AnthropicProvider()
    with pytest.raises(GenerationError):
        provider.generate("some prompt")
