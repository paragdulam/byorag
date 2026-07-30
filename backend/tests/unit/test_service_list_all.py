import io

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.corpora import service as corpora_service
from app.sources import service
from app.sources.service import save_file


@pytest.fixture
def user_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "list-all-owner@example.com", "hunter22").id


def test_list_all_documents_empty(db_session: Session, user_id: str) -> None:
    assert service.list_all_documents(db_session, user_id) == []


def test_list_all_documents_reports_corpus_ids(db_session: Session, user_id: str) -> None:
    corpus_a = corpora_service.create_corpus(db_session, user_id, "A")
    corpus_b = corpora_service.create_corpus(db_session, user_id, "B")

    document = save_file(
        UploadFile(filename="shared.pdf", file=io.BytesIO(b"shared contents")),
        db_session,
        corpus_a.id,
        user_id,
    )
    service.attach_document_to_corpus(db_session, user_id, document.id, corpus_b.id)

    results = service.list_all_documents(db_session, user_id)

    assert len(results) == 1
    assert results[0].id == document.id
    assert set(results[0].corpusIds) == {corpus_a.id, corpus_b.id}


def test_list_all_documents_orders_by_uploaded_at_ascending(
    db_session: Session, user_id: str
) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Solo")

    first = save_file(
        UploadFile(filename="first.pdf", file=io.BytesIO(b"first")), db_session, corpus.id, user_id
    )
    second = save_file(
        UploadFile(filename="second.pdf", file=io.BytesIO(b"second")),
        db_session,
        corpus.id,
        user_id,
    )

    results = service.list_all_documents(db_session, user_id)

    assert [r.id for r in results] == [first.id, second.id]
