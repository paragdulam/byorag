from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.hashing import compute_content_hash
from app.db.legacy_migration import UNCATEGORIZED_CORPUS_NAME, migrate_legacy_pdfs
from app.db.models import Corpus, Document, DocumentCorpus


def _uncategorized_corpora(db_session: Session) -> list[Corpus]:
    return list(
        db_session.execute(
            select(Corpus).where(Corpus.name == UNCATEGORIZED_CORPUS_NAME)
        ).scalars()
    )


def test_migrate_legacy_pdfs_creates_documents_in_uncategorized_corpus(
    db_session: Session, tmp_path: Path
) -> None:
    (tmp_path / "a.pdf").write_bytes(b"contents a")
    (tmp_path / "b.pdf").write_bytes(b"contents b")

    migrated = migrate_legacy_pdfs(db_session, tmp_path)

    assert migrated == 2
    corpora = _uncategorized_corpora(db_session)
    assert len(corpora) == 1
    documents = db_session.execute(
        select(Document).where(
            Document.content_hash.in_(
                [compute_content_hash(b"contents a"), compute_content_hash(b"contents b")]
            )
        )
    ).scalars().all()
    assert {d.name for d in documents} == {"a.pdf", "b.pdf"}
    links = db_session.execute(
        select(DocumentCorpus).where(
            DocumentCorpus.document_id.in_([d.id for d in documents]),
            DocumentCorpus.corpus_id == corpora[0].id,
        )
    ).scalars().all()
    assert len(links) == 2


def test_migrate_legacy_pdfs_is_idempotent(db_session: Session, tmp_path: Path) -> None:
    (tmp_path / "a.pdf").write_bytes(b"contents a")

    first = migrate_legacy_pdfs(db_session, tmp_path)
    second = migrate_legacy_pdfs(db_session, tmp_path)

    assert first == 1
    assert second == 0
    matching_documents = db_session.execute(
        select(Document).where(Document.content_hash == compute_content_hash(b"contents a"))
    ).scalars().all()
    assert len(matching_documents) == 1


def test_migrate_legacy_pdfs_empty_directory(db_session: Session, tmp_path: Path) -> None:
    corpora_before = len(_uncategorized_corpora(db_session))

    migrated = migrate_legacy_pdfs(db_session, tmp_path)

    assert migrated == 0
    assert len(_uncategorized_corpora(db_session)) == corpora_before


def test_migrate_legacy_pdfs_missing_directory(db_session: Session, tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"

    migrated = migrate_legacy_pdfs(db_session, missing)

    assert migrated == 0
