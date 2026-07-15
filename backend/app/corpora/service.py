from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.lookups import get_corpus_or_none
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


def _assert_name_available(db: Session, name: str, exclude_corpus_id: str | None = None) -> None:
    stmt = select(Corpus).where(Corpus.name == name)
    if exclude_corpus_id is not None:
        stmt = stmt.where(Corpus.id != exclude_corpus_id)
    if db.execute(stmt).scalar_one_or_none() is not None:
        raise DuplicateCorpusNameError(name)


def list_corpora(db: Session) -> list[Corpus]:
    return list(db.execute(select(Corpus).order_by(Corpus.created_at.asc())).scalars().all())


def create_corpus(db: Session, name: str) -> Corpus:
    normalized = _normalize_name(name)
    _assert_name_available(db, normalized)

    corpus = Corpus(name=normalized)
    db.add(corpus)
    db.commit()
    db.refresh(corpus)
    return corpus


def rename_corpus(db: Session, corpus_id: str, name: str) -> Corpus:
    corpus = get_corpus_or_none(db, corpus_id)
    if corpus is None:
        raise CorpusNotFoundError(corpus_id)

    normalized = _normalize_name(name)
    _assert_name_available(db, normalized, exclude_corpus_id=corpus_id)

    corpus.name = normalized
    db.commit()
    db.refresh(corpus)
    return corpus


def delete_corpus(db: Session, corpus_id: str) -> None:
    corpus = get_corpus_or_none(db, corpus_id)
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
