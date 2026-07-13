from pathlib import Path

import pytest

from app.chunking import service
from tests.pdf_helpers import make_words_pdf


def test_run_chunking_caps_at_200_and_reports_true_total(tmp_path: Path) -> None:
    (tmp_path / "long.pdf").write_bytes(make_words_pdf(500))

    response = service.run_chunking(
        document_id="long.pdf", chunk_size=1, strategy="fixed-size", pdfs_dir=tmp_path
    )

    assert response.extractionFailed is False
    assert response.result is not None
    assert response.result.totalChunks == 500
    assert len(response.result.chunks) == 200
    assert [c.index for c in response.result.chunks] == list(range(200))


def test_run_chunking_no_extractable_text_reports_failure(tmp_path: Path) -> None:
    (tmp_path / "empty.pdf").write_bytes(make_words_pdf(0))

    response = service.run_chunking(
        document_id="empty.pdf", chunk_size=10, strategy="fixed-size", pdfs_dir=tmp_path
    )

    assert response.extractionFailed is True
    assert response.result is None


def test_run_chunking_unregistered_strategy_raises_value_error(tmp_path: Path) -> None:
    (tmp_path / "report.pdf").write_bytes(make_words_pdf(10))

    with pytest.raises(ValueError):
        service.run_chunking(
            document_id="report.pdf", chunk_size=5, strategy="semantic", pdfs_dir=tmp_path
        )


def test_run_chunking_invalid_chunk_size_raises_value_error(tmp_path: Path) -> None:
    (tmp_path / "report.pdf").write_bytes(make_words_pdf(10))

    with pytest.raises(ValueError):
        service.run_chunking(
            document_id="report.pdf", chunk_size=0, strategy="fixed-size", pdfs_dir=tmp_path
        )


def test_run_chunking_unknown_document_raises_file_not_found(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        service.run_chunking(
            document_id="does-not-exist.pdf",
            chunk_size=5,
            strategy="fixed-size",
            pdfs_dir=tmp_path,
        )


def test_run_chunking_uncapped_result_has_matching_total_and_length(tmp_path: Path) -> None:
    (tmp_path / "short.pdf").write_bytes(make_words_pdf(20))

    response = service.run_chunking(
        document_id="short.pdf", chunk_size=5, strategy="fixed-size", pdfs_dir=tmp_path
    )

    assert response.result is not None
    assert response.result.totalChunks == len(response.result.chunks)
