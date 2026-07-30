"""A document may only ever be attached to (or remain attached to) a corpus sharing its
owner — corpora and documents are strictly private (024-user-authentication research.md
§7, spec.md Clarifications)."""

import io

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.corpora import service as corpora_service
from app.sources import service as sources_service


@pytest.fixture
def owner_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "ownership-owner@example.com", "hunter22").id


@pytest.fixture
def other_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "ownership-other@example.com", "hunter22").id


def test_attaching_a_document_to_another_users_corpus_is_rejected(
    db_session: Session, owner_id: str, other_id: str
) -> None:
    own_corpus = corpora_service.create_corpus(db_session, owner_id, "My Corpus")
    document = sources_service.save_file(
        UploadFile(filename="mine.pdf", file=io.BytesIO(b"content")),
        db_session,
        own_corpus.id,
        owner_id,
    )
    other_corpus = corpora_service.create_corpus(db_session, other_id, "Their Corpus")

    with pytest.raises(sources_service.CorpusNotFoundError):
        sources_service.attach_document_to_corpus(
            db_session, owner_id, document.id, other_corpus.id
        )


def test_a_users_attach_call_cannot_reach_another_users_document(
    db_session: Session, owner_id: str, other_id: str
) -> None:
    import io

    from fastapi import UploadFile

    other_corpus = corpora_service.create_corpus(db_session, other_id, "Their Corpus")
    their_document = sources_service.save_file(
        UploadFile(filename="theirs.pdf", file=io.BytesIO(b"content")),
        db_session,
        other_corpus.id,
        other_id,
    )
    own_corpus = corpora_service.create_corpus(db_session, owner_id, "My Corpus")

    with pytest.raises(sources_service.DocumentNotFoundError):
        sources_service.attach_document_to_corpus(
            db_session, owner_id, their_document.id, own_corpus.id
        )
