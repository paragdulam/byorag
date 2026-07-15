import uuid

from sqlalchemy.orm import Session

from app.db.models import Chunk, ConversationTurn, Corpus, Document


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


def get_chunk_or_none(db: Session, chunk_id: str) -> Chunk | None:
    if not _is_valid_uuid(chunk_id):
        return None
    return db.get(Chunk, chunk_id)


def get_conversation_turn_or_none(db: Session, turn_id: str) -> ConversationTurn | None:
    if not _is_valid_uuid(turn_id):
        return None
    return db.get(ConversationTurn, turn_id)
