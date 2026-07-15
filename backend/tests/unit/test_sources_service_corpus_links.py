import io

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.corpora import service as corpora_service
from app.db.models import Document
from app.sources import service


def make_upload(name: str, content: bytes) -> UploadFile:
    return UploadFile(filename=name, file=io.BytesIO(content))


def test_save_file_dedupes_by_content_hash(db_session: Session, tmp_path, monkeypatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    corpus_a = corpora_service.create_corpus(db_session, "A")
    corpus_b = corpora_service.create_corpus(db_session, "B")
    content = b"%PDF-1.4 identical"

    first = service.save_file(make_upload("one.pdf", content), db_session, corpus_a.id)
    second = service.save_file(make_upload("two.pdf", content), db_session, corpus_b.id)

    assert first.id == second.id
    assert len(db_session.query(Document).all()) == 1


def test_attach_document_to_corpus_not_found(db_session: Session) -> None:
    corpus = corpora_service.create_corpus(db_session, "Solo")
    with pytest.raises(service.DocumentNotFoundError):
        service.attach_document_to_corpus(
            db_session, "00000000-0000-0000-0000-000000000000", corpus.id
        )


def test_attach_document_corpus_not_found(db_session: Session, tmp_path, monkeypatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    corpus = corpora_service.create_corpus(db_session, "Solo")
    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus.id)

    with pytest.raises(service.CorpusNotFoundError):
        service.attach_document_to_corpus(
            db_session, document.id, "00000000-0000-0000-0000-000000000000"
        )


def test_unlink_last_corpus_deletes_document_and_file(
    db_session: Session, tmp_path, monkeypatch
) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    corpus = corpora_service.create_corpus(db_session, "Solo")
    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus.id)

    service.unlink_document_from_corpus(db_session, document.id, corpus.id)

    assert db_session.get(Document, document.id) is None
    assert not any(tmp_path.iterdir())


def test_unlink_not_in_corpus_raises(db_session: Session, tmp_path, monkeypatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    corpus_a = corpora_service.create_corpus(db_session, "A")
    corpus_b = corpora_service.create_corpus(db_session, "B")
    document = service.save_file(make_upload("a.pdf", b"content"), db_session, corpus_a.id)

    with pytest.raises(service.DocumentNotInCorpusError):
        service.unlink_document_from_corpus(db_session, document.id, corpus_b.id)
