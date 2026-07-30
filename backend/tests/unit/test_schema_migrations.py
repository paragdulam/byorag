import uuid

import psycopg
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from app.db.schema_migrations import ensure_schema_migrations

_ADMIN_DSN = "postgresql://byorag:byorag@localhost:5432/byorag"
_PRE_024_SCHEMA_SQL = """
CREATE TABLE corpora (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    name VARCHAR NOT NULL,
    content_hash VARCHAR(64) NOT NULL UNIQUE,
    storage_path VARCHAR NOT NULL,
    size_bytes INTEGER NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'processed',
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


@pytest.fixture
def isolated_engine():
    """A throwaway Postgres database, created fresh for this test and dropped
    afterward — this test exercises real `ALTER TABLE`/`DROP COLUMN` DDL, which must
    never run against the shared dev database (unlike `db_session`'s rollback-based
    isolation, DDL of this kind cannot safely share the app's real `corpora`/
    `documents` tables)."""
    db_name = f"pytest_schema_migrations_{uuid.uuid4().hex[:12]}"

    admin_conn = psycopg.connect(_ADMIN_DSN, autocommit=True)
    try:
        admin_conn.execute(f'CREATE DATABASE "{db_name}"')
    finally:
        admin_conn.close()

    engine = create_engine(f"postgresql+psycopg://byorag:byorag@localhost:5432/{db_name}")
    try:
        with engine.connect() as connection:
            connection.execute(text(_PRE_024_SCHEMA_SQL))
            connection.commit()
        yield engine
    finally:
        engine.dispose()
        admin_conn = psycopg.connect(_ADMIN_DSN, autocommit=True)
        try:
            admin_conn.execute(f'DROP DATABASE IF EXISTS "{db_name}" WITH (FORCE)')
        finally:
            admin_conn.close()


def _column_names(engine: Engine, table_name: str) -> set[str]:
    inspector = inspect(engine)
    return {column["name"] for column in inspector.get_columns(table_name)}


def test_adds_missing_columns_and_drops_storage_path(isolated_engine: Engine) -> None:
    ensure_schema_migrations(isolated_engine)

    assert "user_id" in _column_names(isolated_engine, "corpora")
    document_columns = _column_names(isolated_engine, "documents")
    assert "user_id" in document_columns
    assert "content" in document_columns
    assert "storage_path" not in document_columns


def test_running_twice_in_a_row_is_a_no_op_the_second_time(isolated_engine: Engine) -> None:
    ensure_schema_migrations(isolated_engine)
    # Second call must not raise (IF NOT EXISTS / IF EXISTS guards) and must leave the
    # schema in the same, already-migrated shape.
    ensure_schema_migrations(isolated_engine)

    document_columns = _column_names(isolated_engine, "documents")
    assert "user_id" in document_columns
    assert "content" in document_columns
    assert "storage_path" not in document_columns


def test_backfills_content_from_storage_path_file_before_dropping_it(
    isolated_engine: Engine, tmp_path
) -> None:
    pdf_path = tmp_path / "existing.pdf"
    pdf_bytes = b"%PDF-1.4 pretend-pdf-bytes"
    pdf_path.write_bytes(pdf_bytes)

    document_id = str(uuid.uuid4())
    with isolated_engine.connect() as connection:
        connection.execute(
            text(
                "INSERT INTO documents "
                "(id, name, content_hash, storage_path, size_bytes, status, uploaded_at) "
                "VALUES (:id, 'existing.pdf', 'deadbeef', :storage_path, :size, 'processed', now())"
            ),
            {"id": document_id, "storage_path": str(pdf_path), "size": len(pdf_bytes)},
        )
        connection.commit()

    ensure_schema_migrations(isolated_engine)

    with isolated_engine.connect() as connection:
        row = connection.execute(
            text("SELECT content FROM documents WHERE id = :id"), {"id": document_id}
        ).one()
    assert bytes(row.content) == pdf_bytes


def test_does_not_touch_existing_row_data(isolated_engine: Engine) -> None:
    corpus_id = str(uuid.uuid4())
    with isolated_engine.connect() as connection:
        connection.execute(
            text("INSERT INTO corpora (id, name, created_at) VALUES (:id, :name, now())"),
            {"id": corpus_id, "name": "Pre-existing Corpus"},
        )
        connection.commit()

    ensure_schema_migrations(isolated_engine)

    with isolated_engine.connect() as connection:
        row = connection.execute(
            text("SELECT name, user_id FROM corpora WHERE id = :id"), {"id": corpus_id}
        ).one()
    assert row.name == "Pre-existing Corpus"
    assert row.user_id is None


def test_replaces_the_global_name_uniqueness_constraint_with_a_per_user_one(
    isolated_engine: Engine,
) -> None:
    ensure_schema_migrations(isolated_engine)

    with isolated_engine.connect() as connection:
        constraint_names = {
            row.conname
            for row in connection.execute(
                text("SELECT conname FROM pg_constraint WHERE conrelid = 'corpora'::regclass")
            )
        }
        assert "corpora_name_key" not in constraint_names
        assert "uq_corpus_user_name" in constraint_names

        # Two different users may now share the same corpus name.
        connection.execute(
            text(
                "INSERT INTO corpora (id, user_id, name, created_at) "
                "VALUES (:id, :user_id, 'Shared Name', now())"
            ),
            {"id": str(uuid.uuid4()), "user_id": str(uuid.uuid4())},
        )
        connection.execute(
            text(
                "INSERT INTO corpora (id, user_id, name, created_at) "
                "VALUES (:id, :user_id, 'Shared Name', now())"
            ),
            {"id": str(uuid.uuid4()), "user_id": str(uuid.uuid4())},
        )
        connection.commit()


def test_replaces_the_global_content_hash_uniqueness_constraint_with_a_per_user_one(
    isolated_engine: Engine,
) -> None:
    ensure_schema_migrations(isolated_engine)

    with isolated_engine.connect() as connection:
        constraint_names = {
            row.conname
            for row in connection.execute(
                text("SELECT conname FROM pg_constraint WHERE conrelid = 'documents'::regclass")
            )
        }
        assert "documents_content_hash_key" not in constraint_names
        assert "uq_document_user_content_hash" in constraint_names

        # Two different users may now upload identical content, each getting their own row.
        connection.execute(
            text(
                "INSERT INTO documents "
                "(id, user_id, name, content_hash, content, size_bytes, status, uploaded_at) "
                "VALUES (:id, :user_id, 'a.pdf', 'sharedhash', '', 0, 'processed', now())"
            ),
            {"id": str(uuid.uuid4()), "user_id": str(uuid.uuid4())},
        )
        connection.execute(
            text(
                "INSERT INTO documents "
                "(id, user_id, name, content_hash, content, size_bytes, status, uploaded_at) "
                "VALUES (:id, :user_id, 'b.pdf', 'sharedhash', '', 0, 'processed', now())"
            ),
            {"id": str(uuid.uuid4()), "user_id": str(uuid.uuid4())},
        )
        connection.commit()


def test_missing_storage_path_file_leaves_content_null_without_crashing(
    isolated_engine: Engine, tmp_path
) -> None:
    document_id = str(uuid.uuid4())
    missing_path = tmp_path / "does-not-exist.pdf"
    with isolated_engine.connect() as connection:
        connection.execute(
            text(
                "INSERT INTO documents "
                "(id, name, content_hash, storage_path, size_bytes, status, uploaded_at) "
                "VALUES (:id, 'gone.pdf', 'cafebabe', :storage_path, 0, 'processed', now())"
            ),
            {"id": document_id, "storage_path": str(missing_path)},
        )
        connection.commit()

    ensure_schema_migrations(isolated_engine)  # must not raise

    with isolated_engine.connect() as connection:
        row = connection.execute(
            text("SELECT content FROM documents WHERE id = :id"), {"id": document_id}
        ).one()
    assert row.content is None
