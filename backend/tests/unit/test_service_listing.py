from datetime import datetime, timezone
from pathlib import Path

from app.sources import service


def test_list_documents_maps_stat_to_source_document(tmp_path: Path) -> None:
    pdf_path = tmp_path / "report.pdf"
    contents = b"%PDF-1.4 hello"
    pdf_path.write_bytes(contents)

    documents = service.list_documents(tmp_path)

    assert len(documents) == 1
    doc = documents[0]
    assert doc.id == "report.pdf"
    assert doc.name == "report.pdf"
    assert doc.sizeBytes == len(contents)
    assert doc.status == "processed"
    assert isinstance(doc.uploadedAt, datetime)
    expected_mtime = datetime.fromtimestamp(pdf_path.stat().st_mtime, tz=timezone.utc)
    assert abs((doc.uploadedAt - expected_mtime).total_seconds()) < 1


def test_list_documents_empty_directory(tmp_path: Path) -> None:
    assert service.list_documents(tmp_path) == []


def test_list_documents_sorted_by_uploaded_at_ascending(tmp_path: Path) -> None:
    import time

    first = tmp_path / "first.pdf"
    first.write_bytes(b"1")
    time.sleep(0.01)
    second = tmp_path / "second.pdf"
    second.write_bytes(b"2")

    documents = service.list_documents(tmp_path)

    assert [d.name for d in documents] == ["first.pdf", "second.pdf"]
