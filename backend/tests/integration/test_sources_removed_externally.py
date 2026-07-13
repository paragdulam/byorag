from pathlib import Path

from fastapi.testclient import TestClient


def test_file_removed_outside_app_is_excluded_from_next_list(
    client: TestClient, pdfs_dir: Path
) -> None:
    pdfs_dir.mkdir(parents=True, exist_ok=True)
    keep = pdfs_dir / "keep.pdf"
    remove = pdfs_dir / "remove.pdf"
    keep.write_bytes(b"%PDF-1.4 keep")
    remove.write_bytes(b"%PDF-1.4 remove")

    first_list = client.get("/api/sources").json()["documents"]
    assert {d["name"] for d in first_list} == {"keep.pdf", "remove.pdf"}

    remove.unlink()

    second_list = client.get("/api/sources").json()["documents"]
    assert {d["name"] for d in second_list} == {"keep.pdf"}
