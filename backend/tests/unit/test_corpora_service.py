import pytest
from sqlalchemy.orm import Session

from app.corpora import service


def test_create_corpus_rejects_empty_name(db_session: Session) -> None:
    with pytest.raises(service.EmptyCorpusNameError):
        service.create_corpus(db_session, "")


def test_create_corpus_rejects_whitespace_only_name(db_session: Session) -> None:
    with pytest.raises(service.EmptyCorpusNameError):
        service.create_corpus(db_session, "   ")


def test_create_corpus_trims_whitespace(db_session: Session) -> None:
    corpus = service.create_corpus(db_session, "  Trimmed  ")

    assert corpus.name == "Trimmed"


def test_create_corpus_rejects_duplicate_name(db_session: Session) -> None:
    service.create_corpus(db_session, "Dup")

    with pytest.raises(service.DuplicateCorpusNameError):
        service.create_corpus(db_session, "Dup")


def test_rename_corpus_not_found(db_session: Session) -> None:
    with pytest.raises(service.CorpusNotFoundError):
        service.rename_corpus(db_session, "00000000-0000-0000-0000-000000000000", "New")


def test_rename_corpus_allows_keeping_same_name(db_session: Session) -> None:
    corpus = service.create_corpus(db_session, "Same")

    renamed = service.rename_corpus(db_session, corpus.id, "Same")

    assert renamed.name == "Same"


def test_delete_corpus_not_found(db_session: Session) -> None:
    with pytest.raises(service.CorpusNotFoundError):
        service.delete_corpus(db_session, "00000000-0000-0000-0000-000000000000")


def test_delete_empty_corpus_succeeds(db_session: Session) -> None:
    corpus = service.create_corpus(db_session, "Empty")

    service.delete_corpus(db_session, corpus.id)

    assert service.list_corpora(db_session) == []
