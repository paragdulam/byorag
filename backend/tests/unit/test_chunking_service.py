from pathlib import Path

import pytest

from app.chunking import service
from tests.pdf_helpers import make_multi_page_words_pdf, make_words_pdf


def _run(tmp_path: Path, document_id: str, chunk_size: int, strategy: str = "fixed-size"):
    document_path = service.resolve_run(
        document_id=document_id, chunk_size=chunk_size, strategy=strategy, pdfs_dir=tmp_path
    )
    return list(service.stream_chunking(document_path, chunk_size, strategy))


def test_stream_chunking_caps_at_200_and_reports_true_total(tmp_path: Path) -> None:
    (tmp_path / "long.pdf").write_bytes(make_words_pdf(500))

    events = _run(tmp_path, "long.pdf", 1)

    assert events[-1][0] == "result"
    response = events[-1][1]
    assert response.extractionFailed is False
    assert response.result is not None
    assert response.result.totalChunks == 500
    assert len(response.result.chunks) == 200
    assert [c.index for c in response.result.chunks] == list(range(200))


def test_stream_chunking_no_extractable_text_reports_failure(tmp_path: Path) -> None:
    (tmp_path / "empty.pdf").write_bytes(make_words_pdf(0))

    events = _run(tmp_path, "empty.pdf", 10)

    assert events[-1][0] == "result"
    response = events[-1][1]
    assert response.extractionFailed is True
    assert response.result is None


def test_resolve_run_unregistered_strategy_raises_value_error(tmp_path: Path) -> None:
    (tmp_path / "report.pdf").write_bytes(make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            document_id="report.pdf", chunk_size=5, strategy="semantic", pdfs_dir=tmp_path
        )


def test_resolve_run_invalid_chunk_size_raises_value_error(tmp_path: Path) -> None:
    (tmp_path / "report.pdf").write_bytes(make_words_pdf(10))

    with pytest.raises(ValueError):
        service.resolve_run(
            document_id="report.pdf", chunk_size=0, strategy="fixed-size", pdfs_dir=tmp_path
        )


def test_resolve_run_unknown_document_raises_file_not_found(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        service.resolve_run(
            document_id="does-not-exist.pdf",
            chunk_size=5,
            strategy="fixed-size",
            pdfs_dir=tmp_path,
        )


def test_stream_chunking_uncapped_result_has_matching_total_and_length(tmp_path: Path) -> None:
    (tmp_path / "short.pdf").write_bytes(make_words_pdf(20))

    events = _run(tmp_path, "short.pdf", 5)

    response = events[-1][1]
    assert response.result is not None
    assert response.result.totalChunks == len(response.result.chunks)


def test_stream_chunking_emits_nondecreasing_progress_across_pages(tmp_path: Path) -> None:
    (tmp_path / "multi.pdf").write_bytes(make_multi_page_words_pdf([10, 10, 10, 10]))

    events = _run(tmp_path, "multi.pdf", 5)

    progress_percents = [payload["percent"] for kind, payload in events if kind == "progress"]
    assert len(progress_percents) == 4
    assert progress_percents == sorted(progress_percents)
    assert all(0 <= p <= 90 for p in progress_percents)
    assert events[-1][0] == "result"


def test_stream_chunking_emits_at_least_one_progress_event_for_single_page(
    tmp_path: Path,
) -> None:
    (tmp_path / "single.pdf").write_bytes(make_words_pdf(20))

    events = _run(tmp_path, "single.pdf", 5)

    progress_events = [e for e in events if e[0] == "progress"]
    assert len(progress_events) >= 1
    assert events[-1][0] == "result"
