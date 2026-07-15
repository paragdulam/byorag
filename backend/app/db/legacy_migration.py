import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.hashing import compute_content_hash
from app.db.models import Corpus, Document, DocumentCorpus

logger = logging.getLogger(__name__)

UNCATEGORIZED_CORPUS_NAME = "Uncategorized"


def _get_or_create_uncategorized_corpus(db: Session) -> Corpus:
    corpus = db.scalar(select(Corpus).where(Corpus.name == UNCATEGORIZED_CORPUS_NAME))
    if corpus is None:
        corpus = Corpus(name=UNCATEGORIZED_CORPUS_NAME)
        db.add(corpus)
        db.flush()
    return corpus


def migrate_legacy_pdfs(db: Session, pdfs_dir: Path) -> int:
    """Idempotently fold pre-existing flat-file PDFs into the DB (FR-015).

    Safe to call on every startup: files already represented by a `Document`
    row (matched by content hash) are skipped. Returns the number of files
    migrated on this call.
    """
    if not pdfs_dir.exists():
        return 0

    migrated = 0
    for path in sorted(pdfs_dir.iterdir()):
        if not path.is_file():
            continue

        content_hash = compute_content_hash(path.read_bytes())
        existing = db.scalar(select(Document).where(Document.content_hash == content_hash))
        if existing is not None:
            continue

        corpus = _get_or_create_uncategorized_corpus(db)

        document = Document(
            name=path.name,
            content_hash=content_hash,
            storage_path=str(path),
            size_bytes=path.stat().st_size,
            status="processed",
        )
        db.add(document)
        db.flush()
        db.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))
        migrated += 1

    db.commit()
    logger.info(
        "Legacy PDF migration: %d file(s) migrated into '%s' (already-migrated files skipped)",
        migrated,
        UNCATEGORIZED_CORPUS_NAME,
    )
    return migrated
