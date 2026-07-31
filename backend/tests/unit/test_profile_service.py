import httpx
import anthropic
import pytest

from app.config import settings
from app.profile import service


@pytest.fixture(autouse=True)
def _encryption_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "key_encryption_secret", "test-secret")


def test_encrypt_decrypt_round_trips_the_plaintext_key() -> None:
    ciphertext = service.encrypt("sk-ant-abc123wxyz")

    assert ciphertext != "sk-ant-abc123wxyz"
    assert service.decrypt(ciphertext) == "sk-ant-abc123wxyz"


def test_masked_status_shows_only_the_last_four_characters() -> None:
    assert service._masked("wxyz") == "...wxyz"


class _FakeModels:
    def __init__(self, error: Exception | None = None) -> None:
        self._error = error

    def list(self, **kwargs):
        if self._error is not None:
            raise self._error


class _FakeAnthropicClient:
    def __init__(self, error: Exception | None = None) -> None:
        self.models = _FakeModels(error)


def _fake_request() -> httpx.Request:
    return httpx.Request("GET", "https://api.anthropic.com/v1/models")


def test_validate_key_raises_invalid_key_error_on_authentication_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    request = _fake_request()
    response = httpx.Response(401, request=request)
    auth_error = anthropic.AuthenticationError("invalid x-api-key", response=response, body=None)
    monkeypatch.setattr(
        "app.profile.service.anthropic.Anthropic", lambda **kwargs: _FakeAnthropicClient(auth_error)
    )

    with pytest.raises(service.InvalidKeyError):
        service.validate_key("bad-key")


def test_validate_key_raises_unavailable_error_on_connection_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connection_error = anthropic.APIConnectionError(request=_fake_request())
    monkeypatch.setattr(
        "app.profile.service.anthropic.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(connection_error),
    )

    with pytest.raises(service.KeyValidationUnavailableError):
        service.validate_key("some-key")


def test_validate_key_succeeds_silently_when_anthropic_accepts_the_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "app.profile.service.anthropic.Anthropic", lambda **kwargs: _FakeAnthropicClient()
    )

    service.validate_key("good-key")
