import io

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.corpora import service as corpora_service
from app.db.models import Document
from app.sources import service


def make_upload(name: str, content: bytes) -> UploadFile:
    return UploadFile(filename=name, file=io.BytesIO(content))


@pytest.fixture
def user_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "corpus-links-owner@example.com", "hunter22").id


def test_save_file_dedupes_by_content_hash(db_session: Session, user_id: str) -> None:
    corpus_a = corpora_service.create_corpus(db_session, user_id, "A")
    corpus_b = corpora_service.create_corpus(db_session, user_id, "B")
    content = b"%PDF-1.4 identical"

    first = service.save_file(make_upload("one.pdf", content), db_session, corpus_a.id, user_id)
    second = service.save_file(make_upload("two.pdf", content), db_session, corpus_b.id, user_id)

    assert first.id == second.id
    assert len(db_session.query(Document).filter(Document.user_id == user_id).all()) == 1


def test_attach_document_to_corpus_not_found(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Solo")
    with pytest.raises(service.DocumentNotFoundError):
        service.attach_document_to_corpus(
            db_session, user_id, "00000000-0000-0000-0000-000000000000", corpus.id
        )


def test_attach_document_corpus_not_found(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Solo")
    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus.id, user_id)

    with pytest.raises(service.CorpusNotFoundError):
        service.attach_document_to_corpus(
            db_session, user_id, document.id, "00000000-0000-0000-0000-000000000000"
        )


def test_unlink_last_corpus_deletes_document(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Solo")
    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus.id, user_id)

    service.unlink_document_from_corpus(db_session, user_id, document.id, corpus.id)

    assert db_session.get(Document, document.id) is None


def test_unlink_not_in_corpus_raises(db_session: Session, user_id: str) -> None:
    corpus_a = corpora_service.create_corpus(db_session, user_id, "A")
    corpus_b = corpora_service.create_corpus(db_session, user_id, "B")
    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus_a.id, user_id)

    with pytest.raises(service.DocumentNotInCorpusError):
        service.unlink_document_from_corpus(db_session, user_id, document.id, corpus_b.id)
