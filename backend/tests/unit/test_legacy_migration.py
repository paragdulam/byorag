from pathlib import Path

from sqlalchemy.orm import Session

from app.db.legacy_migration import UNCATEGORIZED_CORPUS_NAME, migrate_legacy_pdfs
from app.db.models import Corpus, Document, DocumentCorpus


def test_migrate_legacy_pdfs_creates_documents_in_uncategorized_corpus(
    db_session: Session, tmp_path: Path
) -> None:
    (tmp_path / "a.pdf").write_bytes(b"contents a")
    (tmp_path / "b.pdf").write_bytes(b"contents b")

    migrated = migrate_legacy_pdfs(db_session, tmp_path)

    assert migrated == 2
    corpora = db_session.query(Corpus).all()
    assert [c.name for c in corpora] == [UNCATEGORIZED_CORPUS_NAME]
    documents = db_session.query(Document).all()
    assert {d.name for d in documents} == {"a.pdf", "b.pdf"}
    links = db_session.query(DocumentCorpus).all()
    assert len(links) == 2


def test_migrate_legacy_pdfs_is_idempotent(db_session: Session, tmp_path: Path) -> None:
    (tmp_path / "a.pdf").write_bytes(b"contents a")

    first = migrate_legacy_pdfs(db_session, tmp_path)
    second = migrate_legacy_pdfs(db_session, tmp_path)

    assert first == 1
    assert second == 0
    assert len(db_session.query(Document).all()) == 1
    assert len(db_session.query(Corpus).all()) == 1


def test_migrate_legacy_pdfs_empty_directory(db_session: Session, tmp_path: Path) -> None:
    migrated = migrate_legacy_pdfs(db_session, tmp_path)

    assert migrated == 0
    assert db_session.query(Corpus).all() == []


def test_migrate_legacy_pdfs_missing_directory(db_session: Session, tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"

    migrated = migrate_legacy_pdfs(db_session, missing)

    assert migrated == 0
