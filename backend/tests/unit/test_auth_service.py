import pytest
from sqlalchemy.orm import Session

from app.auth import service


def test_hash_password_round_trips_and_never_equals_plaintext() -> None:
    hashed = service.hash_password("hunter22")

    assert hashed != "hunter22"
    assert service.verify_password("hunter22", hashed) is True
    assert service.verify_password("wrong-password", hashed) is False


def test_create_user_persists_a_hashed_password(db_session: Session) -> None:
    user = service.create_user(db_session, "person@example.com", "hunter22")

    assert user.email == "person@example.com"
    assert user.password_hash != "hunter22"


def test_create_user_duplicate_email_raises(db_session: Session) -> None:
    service.create_user(db_session, "dup@example.com", "hunter22")

    with pytest.raises(service.EmailAlreadyRegisteredError):
        service.create_user(db_session, "dup@example.com", "different")


def test_authenticate_accepts_correct_and_rejects_incorrect_credentials(db_session: Session) -> None:
    service.create_user(db_session, "auth-check@example.com", "hunter22")

    user = service.authenticate(db_session, "auth-check@example.com", "hunter22")
    assert user is not None
    assert user.email == "auth-check@example.com"

    assert service.authenticate(db_session, "auth-check@example.com", "wrong") is None
    assert service.authenticate(db_session, "no-such-user@example.com", "hunter22") is None


def test_session_lifecycle_create_resolve_revoke(db_session: Session) -> None:
    user = service.create_user(db_session, "session-check@example.com", "hunter22")

    token = service.create_session(db_session, user.id)
    resolved = service.resolve_session(db_session, token)
    assert resolved is not None
    assert resolved.id == user.id

    service.revoke_session(db_session, token)
    assert service.resolve_session(db_session, token) is None


def test_resolve_session_rejects_unknown_token(db_session: Session) -> None:
    assert service.resolve_session(db_session, "not-a-real-token") is None


def test_revoke_session_is_idempotent(db_session: Session) -> None:
    user = service.create_user(db_session, "revoke-twice@example.com", "hunter22")
    token = service.create_session(db_session, user.id)

    service.revoke_session(db_session, token)
    service.revoke_session(db_session, token)  # must not raise

    assert service.resolve_session(db_session, token) is None
