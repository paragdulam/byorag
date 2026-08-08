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


def test_save_file_dedupes_by_content_hash_within_the_same_corpus(
    db_session: Session, user_id: str
) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "A")
    content = b"%PDF-1.4 identical"

    first = service.save_file(make_upload("one.pdf", content), db_session, corpus.id, user_id)
    second = service.save_file(make_upload("two.pdf", content), db_session, corpus.id, user_id)

    assert first.id == second.id
    assert len(db_session.query(Document).filter(Document.user_id == user_id).all()) == 1


def test_save_file_does_not_dedupe_across_different_corpora(
    db_session: Session, user_id: str
) -> None:
    """033-ui-ux-polish: a document belongs to exactly one corpus now — uploading the same
    bytes into a *different* corpus creates its own independent row, not a shared reference."""
    corpus_a = corpora_service.create_corpus(db_session, user_id, "A")
    corpus_b = corpora_service.create_corpus(db_session, user_id, "B")
    content = b"%PDF-1.4 identical"

    first = service.save_file(make_upload("one.pdf", content), db_session, corpus_a.id, user_id)
    second = service.save_file(make_upload("two.pdf", content), db_session, corpus_b.id, user_id)

    assert first.id != second.id
    documents = db_session.query(Document).filter(Document.user_id == user_id).all()
    assert len(documents) == 2
    assert {document.corpus_id for document in documents} == {corpus_a.id, corpus_b.id}


def test_uploaded_document_is_owned_by_the_target_corpus(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Solo")

    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus.id, user_id)

    stored = db_session.get(Document, document.id)
    assert stored is not None
    assert stored.corpus_id == corpus.id
