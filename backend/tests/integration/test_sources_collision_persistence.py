from pathlib import Path

from fastapi.testclient import TestClient


def test_two_sequential_uploads_with_identical_filenames_leave_two_distinct_files(
    client: TestClient, pdfs_dir: Path
) -> None:
    client.post(
        "/api/sources",
        files={"files": ("report.pdf", b"%PDF-1.4 original", "application/pdf")},
    )
    client.post(
        "/api/sources",
        files={"files": ("report.pdf", b"%PDF-1.4 replacement", "application/pdf")},
    )

    on_disk = sorted(p.name for p in pdfs_dir.iterdir())
    assert on_disk == ["report (1).pdf", "report.pdf"]
    assert (pdfs_dir / "report.pdf").read_bytes() == b"%PDF-1.4 original"
    assert (pdfs_dir / "report (1).pdf").read_bytes() == b"%PDF-1.4 replacement"
