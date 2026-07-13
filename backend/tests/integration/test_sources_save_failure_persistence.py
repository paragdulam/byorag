import os
import stat
from pathlib import Path

from fastapi.testclient import TestClient


def test_disk_write_failure_is_reported_without_partial_file_or_list_entry(
    client: TestClient, pdfs_dir: Path
) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    original_mode = pdfs_dir.stat().st_mode
    read_only_mode = stat.S_IRUSR | stat.S_IXUSR
    os.chmod(pdfs_dir, read_only_mode)

    try:
        response = client.post(
            "/api/sources",
            files={"files": ("report.pdf", b"%PDF-1.4 abc", "application/pdf")},
        )
    finally:
        os.chmod(pdfs_dir, original_mode)

    assert response.status_code == 200
    body = response.json()
    assert body["documents"] == []
    assert body["rejections"] == [{"fileName": "report.pdf", "reason": "save-failed"}]
    assert not (pdfs_dir / "report.pdf").exists()

    list_body = client.get("/api/sources").json()
    assert list_body["documents"] == []
