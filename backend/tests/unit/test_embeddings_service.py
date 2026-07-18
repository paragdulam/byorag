from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking import service as chunking_service
from app.db.hashing import compute_content_hash
from app.db.models import Chunk as ChunkRow
from app.db.models import Document
from app.db.models import Embedding as EmbeddingRow
from app.embeddings import service as embeddings_service
from tests.pdf_helpers import make_words_pdf


def _make_saved_chunks(
    db_session: Session, tmp_path: Path, filename: str, word_count: int, chunk_size: int
) -> Document:
    content = make_words_pdf(word_count)
    path = tmp_path / filename
    path.write_bytes(content)
    document = Document(
        name=filename,
        content_hash=compute_content_hash(content),
        storage_path=str(path),
        size_bytes=len(content),
        status="processed",
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)

    resolved = chunking_service.resolve_run(
        db_session, document_id=document.id, chunk_size=chunk_size, strategy="fixed-size"
    )
    list(chunking_service.save_chunks_stream(db_session, resolved, chunk_size, "fixed-size"))
    db_session.refresh(document)
    return document


def test_resolve_embedding_run_unregistered_model_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)

    with pytest.raises(ValueError):
        embeddings_service.resolve_embedding_run(db_session, document.id, "not-a-model")


def test_resolve_embedding_run_unknown_document_raises_file_not_found(
    db_session: Session,
) -> None:
    with pytest.raises(FileNotFoundError):
        embeddings_service.resolve_embedding_run(
            db_session, "00000000-0000-0000-0000-000000000000", "bert"
        )


def test_resolve_embedding_run_no_saved_chunks_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    content = make_words_pdf(10)
    path = tmp_path / "report.pdf"
    path.write_bytes(content)
    document = Document(
        name="report.pdf",
        content_hash=compute_content_hash(content),
        storage_path=str(path),
        size_bytes=len(content),
        status="processed",
    )
    db_session.add(document)
    db_session.commit()
    db_session.refresh(document)

    with pytest.raises(ValueError):
        embeddings_service.resolve_embedding_run(db_session, document.id, "bert")


def test_stream_generate_never_persists(db_session: Session, tmp_path: Path) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)
    chunks = chunking_service.list_saved_chunks(db_session, document.id)

    events = list(embeddings_service.stream_generate(chunks, "bert"))

    assert events[-1][0] == "result"
    result = events[-1][1]
    assert len(result.vectors) == len(chunks)
    for vector_out in result.vectors:
        assert len(vector_out.vector) == 768

    rows = (
        db_session.execute(select(EmbeddingRow).where(EmbeddingRow.chunk_id == chunks[0].id))
        .scalars()
        .all()
    )
    assert rows == []


def test_stream_generate_emits_progress_for_each_chunk(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)
    chunks = chunking_service.list_saved_chunks(db_session, document.id)

    events = list(embeddings_service.stream_generate(chunks, "bert"))

    progress_events = [payload for kind, payload in events if kind == "progress"]
    assert len(progress_events) == len(chunks)
    assert progress_events[-1]["percent"] == 100


def test_save_embeddings_persists_one_row_per_chunk_tagged_with_model(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)
    chunks = chunking_service.list_saved_chunks(db_session, document.id)

    events = list(embeddings_service.save_embeddings(db_session, chunks, "bert"))

    assert events[-1][0] == "result"
    assert events[-1][1].savedCount == len(chunks)

    rows = (
        db_session.execute(
            select(EmbeddingRow).where(EmbeddingRow.chunk_id.in_([c.id for c in chunks]))
        )
        .scalars()
        .all()
    )
    assert len(rows) == len(chunks)
    assert {r.model for r in rows} == {"bert"}
    assert {r.chunk_id for r in rows} == {c.id for c in chunks}


def test_save_embeddings_second_call_adds_rows_rather_than_replacing(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)
    chunks = chunking_service.list_saved_chunks(db_session, document.id)

    list(embeddings_service.save_embeddings(db_session, chunks, "bert"))
    list(embeddings_service.save_embeddings(db_session, chunks, "bert"))

    rows = (
        db_session.execute(
            select(EmbeddingRow).where(EmbeddingRow.chunk_id.in_([c.id for c in chunks]))
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2 * len(chunks)


def test_list_saved_embeddings_orders_newest_first(db_session: Session, tmp_path: Path) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)
    chunks = chunking_service.list_saved_chunks(db_session, document.id)

    list(embeddings_service.save_embeddings(db_session, chunks, "bert"))
    list(embeddings_service.save_embeddings(db_session, chunks, "bert"))

    saved = embeddings_service.list_saved_embeddings(db_session, chunks[0].id)

    assert len(saved) == 2
    assert saved[0].created_at >= saved[1].created_at
    assert saved[0].id != saved[1].id


def test_list_saved_embeddings_empty_for_chunk_with_none(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_saved_chunks(db_session, tmp_path, "report.pdf", 10, 5)
    chunks = chunking_service.list_saved_chunks(db_session, document.id)

    saved = embeddings_service.list_saved_embeddings(db_session, chunks[0].id)

    assert saved == []
