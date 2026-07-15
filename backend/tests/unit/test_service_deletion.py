from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.corpora import service as corpora_service
from app.db.models import Document
from app.sources import service


def _make_document(db_session: Session, tmp_path: Path, name: str, content: bytes) -> Document:
    path = tmp_path / name
    path.write_bytes(content)
    from app.db.hashing import compute_content_hash

    corpus = corpora_service.create_corpus(db_session, f"corpus-for-{name}")
    document = Document(
        name=name,
        content_hash=compute_content_hash(content),
        storage_path=str(path),
        size_bytes=len(content),
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    from app.db.models import DocumentCorpus

    db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))
    db_session.commit()
    return document


def test_delete_documents_removes_real_file(db_session: Session, tmp_path: Path) -> None:
    document = _make_document(db_session, tmp_path, "report.pdf", b"contents")

    results = service.delete_documents(db_session, [document.id])

    assert [r.model_dump() for r in results] == [
        {"id": document.id, "status": "deleted", "reason": None}
    ]
    assert not (tmp_path / "report.pdf").exists()
    assert db_session.get(Document, document.id) is None


def test_delete_documents_unknown_id_is_deleted_not_failed(db_session: Session) -> None:
    results = service.delete_documents(db_session, ["00000000-0000-0000-0000-000000000000"])

    assert results[0].status == "deleted"
    assert results[0].reason is None


def test_delete_documents_os_error_is_reported_as_failed(
    db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    document = _make_document(db_session, tmp_path, "locked.pdf", b"contents")

    def raise_permission_error(self: Path, *args: object, **kwargs: object) -> None:
        raise PermissionError("Permission denied")

    monkeypatch.setattr(Path, "unlink", raise_permission_error)

    results = service.delete_documents(db_session, [document.id])

    assert results[0].id == document.id
    assert results[0].status == "failed"
    assert results[0].reason is not None
    assert db_session.get(Document, document.id) is not None


def test_delete_documents_mixed_batch_reports_independent_outcomes_in_order(
    db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    real = _make_document(db_session, tmp_path, "real.pdf", b"contents")
    locked = _make_document(db_session, tmp_path, "locked.pdf", b"other-contents")

    original_unlink = Path.unlink

    def selective_unlink(self: Path, *args: object, **kwargs: object) -> None:
        if self.name == "locked.pdf":
            raise PermissionError("Permission denied")
        return original_unlink(self, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", selective_unlink)

    results = service.delete_documents(
        db_session, [real.id, "00000000-0000-0000-0000-000000000000", locked.id]
    )

    assert [r.id for r in results] == [real.id, "00000000-0000-0000-0000-000000000000", locked.id]
    assert [r.status for r in results] == ["deleted", "deleted", "failed"]
    assert results[2].reason is not None
    assert not (tmp_path / "real.pdf").exists()
    assert (tmp_path / "locked.pdf").exists()
