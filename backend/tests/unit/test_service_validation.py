import pytest

from app.sources.service import MAX_UPLOAD_SIZE_BYTES, validate_file


@pytest.mark.parametrize(
    "filename,size,content_type,expected",
    [
        ("report.pdf", 1024, "application/pdf", None),
        ("REPORT.PDF", 1024, "application/octet-stream", None),
        ("notes.txt", 1024, "text/plain", "invalid-type"),
        ("no-extension", 1024, None, "invalid-type"),
        ("huge.pdf", MAX_UPLOAD_SIZE_BYTES + 1, "application/pdf", "too-large"),
        ("exact.pdf", MAX_UPLOAD_SIZE_BYTES, "application/pdf", None),
    ],
)
def test_validate_file(filename: str, size: int, content_type: str | None, expected) -> None:
    assert validate_file(filename, size, content_type) == expected
