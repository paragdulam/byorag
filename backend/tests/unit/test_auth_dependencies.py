from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.dependencies import require_user
from app.db.base import get_db
from app.db.models import User

_test_app = FastAPI()


@_test_app.get("/whoami")
def _whoami(user: User = Depends(require_user)) -> dict:
    return {"id": user.id, "email": user.email}


def _client(db_session: Session) -> TestClient:
    def _override_get_db():
        yield db_session

    _test_app.dependency_overrides[get_db] = _override_get_db
    return TestClient(_test_app)


def test_require_user_resolves_a_valid_token_from_the_authorization_header(
    db_session: Session,
) -> None:
    user = service.create_user(db_session, "header-auth@example.com", "hunter22")
    token = service.create_session(db_session, user.id)
    client = _client(db_session)

    response = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "header-auth@example.com"


def test_require_user_resolves_a_valid_token_from_the_query_parameter(
    db_session: Session,
) -> None:
    user = service.create_user(db_session, "query-auth@example.com", "hunter22")
    token = service.create_session(db_session, user.id)
    client = _client(db_session)

    response = client.get(f"/whoami?token={token}")

    assert response.status_code == 200
    assert response.json()["email"] == "query-auth@example.com"


def test_require_user_rejects_a_missing_token(db_session: Session) -> None:
    client = _client(db_session)

    response = client.get("/whoami")

    assert response.status_code == 401


def test_require_user_rejects_an_invalid_token_from_either_source(db_session: Session) -> None:
    client = _client(db_session)

    header_response = client.get("/whoami", headers={"Authorization": "Bearer not-a-real-token"})
    assert header_response.status_code == 401

    query_response = client.get("/whoami?token=not-a-real-token")
    assert query_response.status_code == 401


def test_require_user_rejects_a_revoked_token(db_session: Session) -> None:
    user = service.create_user(db_session, "revoked-auth@example.com", "hunter22")
    token = service.create_session(db_session, user.id)
    service.revoke_session(db_session, token)
    client = _client(db_session)

    response = client.get("/whoami", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
