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


def get_corpus_owned_by(db: Session, corpus_id: str, user_id: str) -> Corpus | None:
    """Same as `get_corpus_or_none`, but returns `None` for both "doesn't exist" and "not
    yours" (024-user-authentication research.md §9) — a cross-account access attempt must
    look identical to a nonexistent id (FR-009)."""
    corpus = get_corpus_or_none(db, corpus_id)
    if corpus is None or corpus.user_id != user_id:
        return None
    return corpus


def get_document_owned_by(db: Session, document_id: str, user_id: str) -> Document | None:
    document = get_document_or_none(db, document_id)
    if document is None or document.user_id != user_id:
        return None
    return document


def get_chunk_owned_by(db: Session, chunk_id: str, user_id: str) -> Chunk | None:
    chunk = get_chunk_or_none(db, chunk_id)
    if chunk is None or chunk.document.user_id != user_id:
        return None
    return chunk


def get_conversation_turn_owned_by(
    db: Session, turn_id: str, user_id: str
) -> ConversationTurn | None:
    turn = get_conversation_turn_or_none(db, turn_id)
    if turn is None:
        return None
    owner_id = turn.document.user_id if turn.document is not None else turn.corpus.user_id
    if owner_id != user_id:
        return None
    return turn
