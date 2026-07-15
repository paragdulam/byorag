import uuid

from sqlalchemy.orm import Session

from app.db.models import Corpus, Document


def _is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def get_corpus_or_none(db: Session, corpus_id: str) -> Corpus | None:
    if not _is_valid_uuid(corpus_id):
        return None
    return db.get(Corpus, corpus_id)


def get_document_or_none(db: Session, document_id: str) -> Document | None:
    if not _is_valid_uuid(document_id):
        return None
    return db.get(Document, document_id)
