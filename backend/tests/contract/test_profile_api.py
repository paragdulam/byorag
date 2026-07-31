import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient


class _FakeModels:
    def __init__(self, error: Exception | None = None) -> None:
        self._error = error

    def list(self, **kwargs):
        if self._error is not None:
            raise self._error


class _FakeAnthropicClient:
    def __init__(self, error: Exception | None = None) -> None:
        self.models = _FakeModels(error)


def _invalid_key_error() -> anthropic.AuthenticationError:
    request = httpx.Request("GET", "https://api.anthropic.com/v1/models")
    response = httpx.Response(401, request=request)
    return anthropic.AuthenticationError("invalid x-api-key", response=response, body=None)


@pytest.fixture
def stub_anthropic(monkeypatch: pytest.MonkeyPatch):
    """Patches `Anthropic` so `models.list` either succeeds or raises whatever error is
    passed to `set_error` — mutable across calls within one test, so a test can flip
    between "accepted" and "rejected" for successive `PUT`s against the same client."""
    state: dict[str, Exception | None] = {"error": None}
    monkeypatch.setattr(
        "app.profile.service.anthropic.Anthropic",
        lambda **kwargs: _FakeAnthropicClient(state["error"]),
    )

    def set_error(error: Exception | None) -> None:
        state["error"] = error

    return set_error


@pytest.fixture
def accept_any_key(stub_anthropic):
    stub_anthropic(None)


def test_get_status_with_no_key_on_file(client_without_anthropic_key: TestClient) -> None:
    response = client_without_anthropic_key.get("/api/profile/anthropic-key")

    assert response.status_code == 200
    assert response.json() == {"hasKey": False, "maskedKey": None}


def test_put_valid_key_is_stored_and_masked(client_without_anthropic_key: TestClient, accept_any_key) -> None:
    response = client_without_anthropic_key.put("/api/profile/anthropic-key", json={"apiKey": "sk-ant-testwxyz"})

    assert response.status_code == 200
    body = response.json()
    assert body["hasKey"] is True
    assert body["maskedKey"] == "...wxyz"
    assert "sk-ant-testwxyz" not in response.text

    status = client_without_anthropic_key.get("/api/profile/anthropic-key")
    assert status.json() == {"hasKey": True, "maskedKey": "...wxyz"}


def test_put_empty_key_is_rejected_before_any_anthropic_call(client_without_anthropic_key: TestClient) -> None:
    response = client_without_anthropic_key.put("/api/profile/anthropic-key", json={"apiKey": "   "})

    assert response.status_code == 422
    assert client_without_anthropic_key.get("/api/profile/anthropic-key").json()["hasKey"] is False


def test_put_invalid_key_is_rejected_and_prior_key_is_unchanged(
    client_without_anthropic_key: TestClient, stub_anthropic
) -> None:
    stub_anthropic(None)
    good = client_without_anthropic_key.put("/api/profile/anthropic-key", json={"apiKey": "sk-ant-goodwxyz"})
    assert good.status_code == 200

    stub_anthropic(_invalid_key_error())
    bad = client_without_anthropic_key.put("/api/profile/anthropic-key", json={"apiKey": "sk-ant-bad0000"})
    assert bad.status_code == 400

    status = client_without_anthropic_key.get("/api/profile/anthropic-key")
    assert status.json() == {"hasKey": True, "maskedKey": "...wxyz"}


def test_put_key_returns_502_when_anthropic_is_unreachable(
    client_without_anthropic_key: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def _raise_connection_error(**kwargs):
        request = httpx.Request("GET", "https://api.anthropic.com/v1/models")
        raise anthropic.APIConnectionError(request=request)

    class _UnreachableModels:
        list = staticmethod(lambda **kwargs: _raise_connection_error())

    class _UnreachableClient:
        def __init__(self, **kwargs) -> None:
            self.models = _UnreachableModels()

    monkeypatch.setattr("app.profile.service.anthropic.Anthropic", _UnreachableClient)

    response = client_without_anthropic_key.put("/api/profile/anthropic-key", json={"apiKey": "sk-ant-testwxyz"})

    assert response.status_code == 502


def test_delete_removes_a_saved_key(client_without_anthropic_key: TestClient, accept_any_key) -> None:
    client_without_anthropic_key.put("/api/profile/anthropic-key", json={"apiKey": "sk-ant-testwxyz"})

    response = client_without_anthropic_key.delete("/api/profile/anthropic-key")

    assert response.status_code == 204
    status = client_without_anthropic_key.get("/api/profile/anthropic-key")
    assert status.json() == {"hasKey": False, "maskedKey": None}


def test_delete_is_idempotent_when_no_key_exists(client_without_anthropic_key: TestClient) -> None:
    response = client_without_anthropic_key.delete("/api/profile/anthropic-key")

    assert response.status_code == 204
