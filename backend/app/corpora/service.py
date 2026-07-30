from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.lookups import get_corpus_owned_by
from app.db.models import Corpus, DocumentCorpus


class EmptyCorpusNameError(Exception):
    pass


class DuplicateCorpusNameError(Exception):
    def __init__(self, name: str) -> None:
        self.name = name
        super().__init__(f"A corpus named '{name}' already exists")


class CorpusNotFoundError(Exception):
    def __init__(self, corpus_id: str) -> None:
        self.corpus_id = corpus_id
        super().__init__(f"No corpus found with id '{corpus_id}'")


class CorpusNotEmptyError(Exception):
    def __init__(self, corpus: Corpus, document_count: int) -> None:
        self.corpus = corpus
        self.document_count = document_count
        super().__init__(
            f"Cannot delete corpus '{corpus.name}': {document_count} document(s) still "
            "associated. Remove or reassign them first."
        )


def _normalize_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise EmptyCorpusNameError("Corpus name must not be empty")
    return normalized


def _assert_name_available(
    db: Session, user_id: str, name: str, exclude_corpus_id: str | None = None
) -> None:
    """Corpus name uniqueness is scoped per user (024-user-authentication data-model.md) —
    two different users may each have a corpus named the same thing; one user may not have
    two."""
    stmt = select(Corpus).where(Corpus.user_id == user_id, Corpus.name == name)
    if exclude_corpus_id is not None:
        stmt = stmt.where(Corpus.id != exclude_corpus_id)
    if db.execute(stmt).scalar_one_or_none() is not None:
        raise DuplicateCorpusNameError(name)


def list_corpora(db: Session, user_id: str) -> list[Corpus]:
    return list(
        db.execute(
            select(Corpus).where(Corpus.user_id == user_id).order_by(Corpus.created_at.asc())
        )
        .scalars()
        .all()
    )


def create_corpus(db: Session, user_id: str, name: str) -> Corpus:
    normalized = _normalize_name(name)
    _assert_name_available(db, user_id, normalized)

    corpus = Corpus(user_id=user_id, name=normalized)
    db.add(corpus)
    db.commit()
    db.refresh(corpus)
    return corpus


def rename_corpus(db: Session, user_id: str, corpus_id: str, name: str) -> Corpus:
    corpus = get_corpus_owned_by(db, corpus_id, user_id)
    if corpus is None:
        raise CorpusNotFoundError(corpus_id)

    normalized = _normalize_name(name)
    _assert_name_available(db, user_id, normalized, exclude_corpus_id=corpus_id)

    corpus.name = normalized
    db.commit()
    db.refresh(corpus)
    return corpus


def delete_corpus(db: Session, user_id: str, corpus_id: str) -> None:
    corpus = get_corpus_owned_by(db, corpus_id, user_id)
    if corpus is None:
        raise CorpusNotFoundError(corpus_id)

    linked = list(
        db.execute(
            select(DocumentCorpus).where(DocumentCorpus.corpus_id == corpus_id)
        ).scalars()
    )
    if linked:
        raise CorpusNotEmptyError(corpus, len(linked))

    db.delete(corpus)
    db.commit()
