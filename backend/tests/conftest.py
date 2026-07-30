import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.config import settings
from app.db.base import Base, engine, ensure_vector_extension, get_db
from app.main import app


@pytest.fixture
def pdfs_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    directory = tmp_path / "pdfs"
    monkeypatch.setattr(settings, "pdfs_dir", directory)
    return directory


@pytest.fixture(scope="session", autouse=True)
def _db_schema() -> None:
    """Ensure the schema exists once per test session (app lifespan doesn't run
    under a bare TestClient() — see research.md §10)."""
    ensure_vector_extension(engine)
    Base.metadata.create_all(engine)


@pytest.fixture
def db_session() -> Iterator[Session]:
    """A DB session bound to a connection whose outer transaction is rolled back
    after the test, so no test ever commits visible data (research.md §10).

    Application code may call `session.commit()`; that's handled by joining the
    session to the outer transaction via a SAVEPOINT that's automatically
    restarted after each commit (SQLAlchemy's standard "join a Session into an
    external transaction" recipe).
    """
    connection = engine.connect()
    outer_transaction = connection.begin()
    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess: Session, trans) -> None:
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        event.remove(session, "after_transaction_end", _restart_savepoint)
        session.close()
        outer_transaction.rollback()
        connection.close()


@pytest.fixture
def anonymous_client(pdfs_dir: Path, db_session: Session) -> Iterator[TestClient]:
    """A plain, unauthenticated `TestClient` — for the handful of tests that specifically
    assert `401`-without-auth behavior (024-user-authentication). Every other test should
    use the `client` fixture, which is authenticated by default. A separate `TestClient`
    instance from `client`'s (even though both wrap the same `app`), so setting an auth
    header on one can never leak onto the other."""

    def _override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client(pdfs_dir: Path, db_session: Session) -> Iterator[TestClient]:
    """Authenticated by default: creates a test user directly against `db_session`
    (bypassing a live HTTP round-trip) and attaches its session token to every request, so
    the large majority of existing tests keep passing unchanged now that every endpoint
    requires a signed-in user (024-user-authentication research.md §9)."""

    def _override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        test_client = TestClient(app)
        user = auth_service.create_user(
            db_session, f"test-{uuid.uuid4().hex}@example.com", "hunter22"
        )
        token = auth_service.create_session(db_session, user.id)
        test_client.headers["Authorization"] = f"Bearer {token}"
        yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def corpus_id(client: TestClient) -> str:
    """A freshly created corpus's id, for tests that only need *a* valid
    corpus to scope sources requests to."""
    response = client.post("/api/corpora", json={"name": "Test Corpus"})
    return response.json()["id"]
