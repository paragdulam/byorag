import io
from pathlib import Path

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.corpora import service as corpora_service
from app.sources import service
from app.sources.schemas import UploadRejection


def make_upload(filename: str, contents: bytes, content_type: str = "application/pdf") -> UploadFile:
    return UploadFile(filename=filename, file=io.BytesIO(contents), headers={"content-type": content_type})


def test_save_file_returns_save_failed_on_oserror_and_leaves_no_partial_file(
    db_session: Session, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "pdfs_dir", tmp_path)

    def broken_write_bytes(self: Path, data: bytes) -> int:
        raise OSError("disk full")

    monkeypatch.setattr(Path, "write_bytes", broken_write_bytes)

    corpus = corpora_service.create_corpus(db_session, "Test Corpus")
    upload = make_upload("report.pdf", b"%PDF-1.4 abc")

    result = service.save_file(upload, db_session, corpus.id)

    assert isinstance(result, UploadRejection)
    assert result == UploadRejection(fileName="report.pdf", reason="save-failed")
    assert list(tmp_path.iterdir()) == []
