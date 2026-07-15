from sqlalchemy.orm import Session

from app.corpora import service as corpora_service
from app.sources import service


def test_list_all_documents_empty(db_session: Session) -> None:
    assert service.list_all_documents(db_session) == []


def test_list_all_documents_reports_corpus_ids(db_session: Session, tmp_path, monkeypatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    corpus_a = corpora_service.create_corpus(db_session, "A")
    corpus_b = corpora_service.create_corpus(db_session, "B")

    from app.sources.service import save_file
    from fastapi import UploadFile
    import io

    document = save_file(
        UploadFile(filename="shared.pdf", file=io.BytesIO(b"shared contents")),
        db_session,
        corpus_a.id,
    )
    service.attach_document_to_corpus(db_session, document.id, corpus_b.id)

    results = service.list_all_documents(db_session)

    assert len(results) == 1
    assert results[0].id == document.id
    assert set(results[0].corpusIds) == {corpus_a.id, corpus_b.id}


def test_list_all_documents_orders_by_uploaded_at_ascending(
    db_session: Session, tmp_path, monkeypatch
) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)
    corpus = corpora_service.create_corpus(db_session, "Solo")

    from app.sources.service import save_file
    from fastapi import UploadFile
    import io

    first = save_file(UploadFile(filename="first.pdf", file=io.BytesIO(b"first")), db_session, corpus.id)
    second = save_file(UploadFile(filename="second.pdf", file=io.BytesIO(b"second")), db_session, corpus.id)

    results = service.list_all_documents(db_session)

    assert [r.id for r in results] == [first.id, second.id]
