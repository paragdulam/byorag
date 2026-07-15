from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.orm import Session

from app.config import settings
from app.db.base import Base, engine, get_db
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
def client(pdfs_dir: Path, db_session: Session) -> Iterator[TestClient]:
    def _override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def corpus_id(client: TestClient) -> str:
    """A freshly created corpus's id, for tests that only need *a* valid
    corpus to scope sources requests to."""
    response = client.post("/api/corpora", json={"name": "Test Corpus"})
    return response.json()["id"]
