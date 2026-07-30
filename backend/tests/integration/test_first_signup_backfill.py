import uuid
from collections.abc import Iterator

import psycopg
import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.auth import service
from app.db.base import Base, ensure_vector_extension
from app.db.models import Corpus, Document

_ADMIN_DSN = "postgresql://byorag:byorag@localhost:5432/byorag"


@pytest.fixture
def isolated_session() -> Iterator[Session]:
    """"Is this the very first user ever" (FR-013) is a whole-database fact, not something a
    rollback-isolated transaction against the shared dev database can fake once a real
    account exists there — so this test gets its own throwaway, genuinely-empty database
    instead (mirrors test_schema_migrations.py's `isolated_engine`)."""
    db_name = f"pytest_first_signup_{uuid.uuid4().hex[:12]}"

    admin_conn = psycopg.connect(_ADMIN_DSN, autocommit=True)
    try:
        admin_conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        admin_conn.close()

    engine = create_engine(f"postgresql+psycopg://byorag:byorag@localhost:5432/{db_name}")
    try:
        ensure_vector_extension(engine)
        Base.metadata.create_all(engine)
        session = Session(bind=engine)
        try:
            yield session
        finally:
            session.close()
    finally:
        engine.dispose()
        admin_conn = psycopg.connect(_ADMIN_DSN, autocommit=True)
        try:
            admin_conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
        finally:
            admin_conn.close()


def _make_ownerless_corpus(db_session: Session, name: str) -> Corpus:
    corpus = Corpus(name=name, user_id=None)
    db_session.add(corpus)
    db_session.flush()
    return corpus


def _make_ownerless_document(db_session: Session, name: str, content_hash: str) -> Document:
    document = Document(
        name=name,
        content_hash=content_hash,
        content=b"%PDF-1.4 fake",
        size_bytes=13,
        user_id=None,
    )
    db_session.add(document)
    db_session.flush()
    return document


def test_first_signup_claims_all_ownerless_corpora_and_documents(
    isolated_session: Session,
) -> None:
    corpus = _make_ownerless_corpus(isolated_session, "Ownerless Corpus")
    document = _make_ownerless_document(isolated_session, "ownerless.pdf", "hash-1")
    isolated_session.commit()

    user = service.create_user(isolated_session, "first-user@example.com", "hunter22")

    isolated_session.refresh(corpus)
    isolated_session.refresh(document)
    assert corpus.user_id == user.id
    assert document.user_id == user.id


def test_second_signup_claims_nothing_left_unowned(isolated_session: Session) -> None:
    corpus = _make_ownerless_corpus(isolated_session, "Ownerless Corpus 2")
    isolated_session.commit()

    first_user = service.create_user(isolated_session, "first-again@example.com", "hunter22")
    isolated_session.refresh(corpus)
    assert corpus.user_id == first_user.id

    second_user = service.create_user(isolated_session, "second-user@example.com", "hunter22")

    # Nothing was left unowned for the second signup to claim — the corpus still
    # belongs to the first user, not the second.
    still_owned_by_first = isolated_session.execute(
        select(Corpus).where(Corpus.id == corpus.id, Corpus.user_id == first_user.id)
    ).scalar_one_or_none()
    assert still_owned_by_first is not None
    assert second_user.id != first_user.id
