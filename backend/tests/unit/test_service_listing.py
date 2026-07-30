import pytest
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.corpora import service as corpora_service
from app.db.models import Document, DocumentCorpus
from app.sources import service


@pytest.fixture
def user_id(db_session: Session) -> str:
    return auth_service.create_user(db_session, "listing-owner@example.com", "hunter22").id


def test_list_documents_empty_corpus(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Empty")

    assert service.list_documents(db_session, corpus.id) == []


def test_list_documents_returns_linked_document(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Has One")
    document = Document(
        user_id=user_id,
        name="report.pdf",
        content_hash="c" * 64,
        content=b"x",
        size_bytes=42,
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))
    db_session.commit()

    documents = service.list_documents(db_session, corpus.id)

    assert len(documents) == 1
    assert documents[0].id == document.id
    assert documents[0].name == "report.pdf"
    assert documents[0].sizeBytes == 42
    assert documents[0].status == "processed"


def test_list_documents_sorted_by_uploaded_at_ascending(db_session: Session, user_id: str) -> None:
    corpus = corpora_service.create_corpus(db_session, user_id, "Sorted")
    for name in ["first.pdf", "second.pdf"]:
        document = Document(
            user_id=user_id,
            name=name,
            content_hash=f"{name}-hash".ljust(64, "0"),
            content=b"x",
            size_bytes=1,
            status="processed",
        )
        db_session.add(document)
        db_session.flush()
        db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))
    db_session.commit()

    documents = service.list_documents(db_session, corpus.id)

    assert [d.name for d in documents] == ["first.pdf", "second.pdf"]


def test_list_documents_excludes_other_corpora(db_session: Session, user_id: str) -> None:
    corpus_a = corpora_service.create_corpus(db_session, user_id, "A")
    corpus_b = corpora_service.create_corpus(db_session, user_id, "B")
    document = Document(
        user_id=user_id,
        name="only-a.pdf",
        content_hash="d" * 64,
        content=b"x",
        size_bytes=1,
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus_a.id))
    db_session.commit()

    assert [d.name for d in service.list_documents(db_session, corpus_a.id)] == ["only-a.pdf"]
    assert service.list_documents(db_session, corpus_b.id) == []
