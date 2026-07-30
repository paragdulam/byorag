from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.corpora import service as corpora_service
from app.db.hashing import compute_content_hash
from app.db.models import Document, DocumentCorpus
from app.sources import service


def _make_document(db_session: Session, user_id: str, name: str, content: bytes) -> Document:
    corpus = corpora_service.create_corpus(db_session, user_id, f"corpus-for-{name}")
    document = Document(
        user_id=user_id,
        name=name,
        content_hash=compute_content_hash(content),
        content=content,
        size_bytes=len(content),
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))
    db_session.commit()
    return document


def test_delete_documents_removes_row(db_session: Session) -> None:
    user_id = auth_service.create_user(db_session, "deletion-owner@example.com", "hunter22").id
    document = _make_document(db_session, user_id, "report.pdf", b"contents")

    results = service.delete_documents(db_session, user_id, [document.id])

    assert [r.model_dump() for r in results] == [
        {"id": document.id, "status": "deleted", "reason": None}
    ]
    assert db_session.get(Document, document.id) is None


def test_delete_documents_unknown_id_is_deleted_not_failed(db_session: Session) -> None:
    user_id = auth_service.create_user(db_session, "deletion-owner2@example.com", "hunter22").id

    results = service.delete_documents(
        db_session, user_id, ["00000000-0000-0000-0000-000000000000"]
    )

    assert results[0].status == "deleted"
    assert results[0].reason is None


def test_delete_documents_another_users_document_is_reported_as_deleted_not_leaked(
    db_session: Session,
) -> None:
    owner_id = auth_service.create_user(db_session, "deletion-owner3@example.com", "hunter22").id
    other_id = auth_service.create_user(db_session, "deletion-other@example.com", "hunter22").id
    document = _make_document(db_session, owner_id, "mine.pdf", b"contents")

    results = service.delete_documents(db_session, other_id, [document.id])

    # Looks identical to an unknown id (FR-009) — never reveals that it exists.
    assert results[0].status == "deleted"
    assert db_session.get(Document, document.id) is not None


def test_delete_documents_mixed_batch_reports_in_order(db_session: Session) -> None:
    user_id = auth_service.create_user(db_session, "deletion-owner4@example.com", "hunter22").id
    real = _make_document(db_session, user_id, "real.pdf", b"contents")

    results = service.delete_documents(
        db_session, user_id, [real.id, "00000000-0000-0000-0000-000000000000"]
    )

    assert [r.id for r in results] == [real.id, "00000000-0000-0000-0000-000000000000"]
    assert [r.status for r in results] == ["deleted", "deleted"]
    assert db_session.get(Document, real.id) is None
