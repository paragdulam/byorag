from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chunking import service
from app.db.hashing import compute_content_hash
from app.db.models import Chunk as ChunkRow
from app.db.models import Document
from tests.pdf_helpers import make_multi_page_words_pdf, make_words_pdf


def _make_document(db_session: Session, tmp_path: Path, filename: str, content: bytes) -> Document:
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
    return document


def _run(
    db_session: Session,
    document: Document,
    chunk_size: int,
    strategy: str = "fixed-size",
    overlap: int = 0,
):
    resolved = service.resolve_run(
        db_session, document_id=document.id, chunk_size=chunk_size, strategy=strategy, overlap=overlap
    )
    return list(service.stream_chunking(resolved, chunk_size, strategy, overlap=overlap))


def test_stream_chunking_caps_at_200_and_reports_true_total(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "long.pdf", make_words_pdf(500))

    events = _run(db_session, document, 1)

    assert events[-1][0] == "result"
    response = events[-1][1]
    assert response.extractionFailed is False
    assert response.result is not None
    assert response.result.totalChunks == 500
    assert len(response.result.chunks) == 200
    assert [c.index for c in response.result.chunks] == list(range(200))


def test_stream_chunking_no_extractable_text_reports_failure(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "empty.pdf", make_words_pdf(0))

    events = _run(db_session, document, 10)

    assert events[-1][0] == "result"
    response = events[-1][1]
    assert response.extractionFailed is True
    assert response.result is None


def test_resolve_run_unregistered_strategy_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "report.pdf", make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            db_session, document_id=document.id, chunk_size=5, strategy="semantic"
        )


def test_resolve_run_invalid_chunk_size_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "report.pdf", make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            db_session, document_id=document.id, chunk_size=0, strategy="fixed-size"
        )


def test_resolve_run_unknown_document_raises_file_not_found(db_session: Session) -> None:
    with pytest.raises(FileNotFoundError):
        service.resolve_run(
            db_session,
            document_id="00000000-0000-0000-0000-000000000000",
            chunk_size=5,
            strategy="fixed-size",
        )


def test_stream_chunking_uncapped_result_has_matching_total_and_length(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    events = _run(db_session, document, 5)

    response = events[-1][1]
    assert response.result is not None
    assert response.result.totalChunks == len(response.result.chunks)


def test_stream_chunking_emits_nondecreasing_progress_across_pages(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(
        db_session, tmp_path, "multi.pdf", make_multi_page_words_pdf([10, 10, 10, 10])
    )

    events = _run(db_session, document, 5)

    progress_percents = [payload["percent"] for kind, payload in events if kind == "progress"]
    assert len(progress_percents) == 4
    assert progress_percents == sorted(progress_percents)
    assert all(0 <= p <= 90 for p in progress_percents)
    assert events[-1][0] == "result"


def test_stream_chunking_emits_at_least_one_progress_event_for_single_page(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "single.pdf", make_words_pdf(20))

    events = _run(db_session, document, 5)

    progress_events = [e for e in events if e[0] == "progress"]
    assert len(progress_events) >= 1
    assert events[-1][0] == "result"


def test_resolve_run_overlap_equal_to_chunk_size_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "report.pdf", make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            db_session, document_id=document.id, chunk_size=5, strategy="fixed-size", overlap=5
        )


def test_resolve_run_overlap_greater_than_chunk_size_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "report.pdf", make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            db_session, document_id=document.id, chunk_size=5, strategy="fixed-size", overlap=10
        )


def test_resolve_run_negative_overlap_raises_value_error(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "report.pdf", make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            db_session, document_id=document.id, chunk_size=5, strategy="fixed-size", overlap=-1
        )


def test_stream_chunking_higher_overlap_increases_total_chunks(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "long.pdf", make_words_pdf(100))

    no_overlap_events = _run(db_session, document, 10, overlap=0)
    overlap_events = _run(db_session, document, 10, overlap=5)

    no_overlap_total = no_overlap_events[-1][1].result.totalChunks
    overlap_total = overlap_events[-1][1].result.totalChunks
    assert overlap_total > no_overlap_total


def test_stream_chunking_result_echoes_overlap(db_session: Session, tmp_path: Path) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    events = _run(db_session, document, 5, overlap=2)

    assert events[-1][1].result.overlap == 2


def test_stream_chunking_does_not_persist_chunks_for_the_document(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    _run(db_session, document, 5)

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document.id))
        .scalars()
        .all()
    )
    assert rows == []


def test_stream_chunking_repeated_runs_never_persist_chunks(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    _run(db_session, document, 5)
    _run(db_session, document, 10, overlap=2)
    _run(db_session, document, 3)

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document.id))
        .scalars()
        .all()
    )
    assert rows == []


def _save(
    db_session: Session,
    document: Document,
    chunk_size: int,
    strategy: str = "fixed-size",
    overlap: int = 0,
):
    resolved = service.resolve_run(
        db_session, document_id=document.id, chunk_size=chunk_size, strategy=strategy, overlap=overlap
    )
    events = list(
        service.save_chunks_stream(db_session, resolved, chunk_size, strategy, overlap=overlap)
    )
    assert events[-1][0] == "result"
    return events


def test_save_chunks_stream_emits_progress_before_the_terminal_result(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    events = _save(db_session, document, 5)

    progress_events = [e for e in events if e[0] == "progress"]
    assert len(progress_events) >= 1
    assert events[-1][0] == "result"


def test_save_chunks_persists_matching_strategy_size_overlap_and_content(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    events = _save(db_session, document, 5)
    response = events[-1][1]

    assert response.extractionFailed is False
    assert response.result is not None
    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document.id))
        .scalars()
        .all()
    )
    assert len(rows) == 4
    assert {r.strategy for r in rows} == {"fixed-size"}
    assert {r.chunk_size for r in rows} == {5}
    assert {r.overlap for r in rows} == {0}
    saved_content_by_index = {r.index: r.content for r in rows}
    assert saved_content_by_index == {c.index: c.content for c in response.result.chunks}


def test_save_chunks_resave_replaces_previous_saved_chunks(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))

    _save(db_session, document, 5)
    _save(db_session, document, 10)

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document.id))
        .scalars()
        .all()
    )
    assert len(rows) == 2
    assert {r.chunk_size for r in rows} == {10}
    assert len({r.index for r in rows}) == len(rows)


def test_save_chunks_no_extractable_text_persists_nothing(
    db_session: Session, tmp_path: Path
) -> None:
    document = _make_document(db_session, tmp_path, "empty.pdf", make_words_pdf(0))

    events = _save(db_session, document, 10)
    response = events[-1][1]

    assert response.extractionFailed is True
    assert response.result is None
    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == document.id))
        .scalars()
        .all()
    )
    assert rows == []


def test_save_chunks_failed_extraction_leaves_prior_saved_chunks_untouched(
    db_session: Session, tmp_path: Path
) -> None:
    good = _make_document(db_session, tmp_path, "short.pdf", make_words_pdf(20))
    _save(db_session, good, 5)

    empty = _make_document(db_session, tmp_path, "empty.pdf", make_words_pdf(0))
    _save(db_session, empty, 10)

    rows = (
        db_session.execute(select(ChunkRow).where(ChunkRow.document_id == good.id))
        .scalars()
        .all()
    )
    assert len(rows) == 4
