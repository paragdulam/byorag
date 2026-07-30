import pytest
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.corpora import service


@pytest.fixture
def user_id(db_session: Session) -> str:
    user = auth_service.create_user(db_session, "corpora-owner@example.com", "hunter22")
    return user.id


@pytest.fixture
def other_user_id(db_session: Session) -> str:
    user = auth_service.create_user(db_session, "corpora-other@example.com", "hunter22")
    return user.id


def test_create_corpus_rejects_empty_name(db_session: Session, user_id: str) -> None:
    with pytest.raises(service.EmptyCorpusNameError):
        service.create_corpus(db_session, user_id, "")


def test_create_corpus_rejects_whitespace_only_name(db_session: Session, user_id: str) -> None:
    with pytest.raises(service.EmptyCorpusNameError):
        service.create_corpus(db_session, user_id, "   ")


def test_create_corpus_trims_whitespace(db_session: Session, user_id: str) -> None:
    corpus = service.create_corpus(db_session, user_id, "  Trimmed  ")

    assert corpus.name == "Trimmed"


def test_create_corpus_rejects_duplicate_name(db_session: Session, user_id: str) -> None:
    service.create_corpus(db_session, user_id, "Dup")

    with pytest.raises(service.DuplicateCorpusNameError):
        service.create_corpus(db_session, user_id, "Dup")


def test_create_corpus_same_name_allowed_for_different_users(
    db_session: Session, user_id: str, other_user_id: str
) -> None:
    service.create_corpus(db_session, user_id, "Shared Name")

    # Must not raise — corpus name uniqueness is scoped per user.
    other_corpus = service.create_corpus(db_session, other_user_id, "Shared Name")
    assert other_corpus.name == "Shared Name"


def test_rename_corpus_not_found(db_session: Session, user_id: str) -> None:
    with pytest.raises(service.CorpusNotFoundError):
        service.rename_corpus(db_session, user_id, "00000000-0000-0000-0000-000000000000", "New")


def test_rename_corpus_allows_keeping_same_name(db_session: Session, user_id: str) -> None:
    corpus = service.create_corpus(db_session, user_id, "Same")

    renamed = service.rename_corpus(db_session, user_id, corpus.id, "Same")

    assert renamed.name == "Same"


def test_rename_another_users_corpus_raises_not_found(
    db_session: Session, user_id: str, other_user_id: str
) -> None:
    corpus = service.create_corpus(db_session, user_id, "Mine")

    with pytest.raises(service.CorpusNotFoundError):
        service.rename_corpus(db_session, other_user_id, corpus.id, "Stolen")


def test_delete_corpus_not_found(db_session: Session, user_id: str) -> None:
    with pytest.raises(service.CorpusNotFoundError):
        service.delete_corpus(db_session, user_id, "00000000-0000-0000-0000-000000000000")


def test_delete_empty_corpus_succeeds(db_session: Session, user_id: str) -> None:
    corpus = service.create_corpus(db_session, user_id, "Empty")

    service.delete_corpus(db_session, user_id, corpus.id)

    assert service.list_corpora(db_session, user_id) == []


def test_delete_another_users_corpus_raises_not_found(
    db_session: Session, user_id: str, other_user_id: str
) -> None:
    corpus = service.create_corpus(db_session, user_id, "Mine")

    with pytest.raises(service.CorpusNotFoundError):
        service.delete_corpus(db_session, other_user_id, corpus.id)
