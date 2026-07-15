from pathlib import Path

from fastapi.testclient import TestClient


def test_non_pdf_file_is_rejected(client: TestClient, pdfs_dir: Path, corpus_id: str) -> None:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("notes.txt", b"just some text", "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["documents"] == []
    assert body["rejections"] == [{"fileName": "notes.txt", "reason": "invalid-type"}]
    assert not (pdfs_dir / "notes.txt").exists()


def test_oversized_pdf_is_rejected(client: TestClient, pdfs_dir: Path, corpus_id: str) -> None:
    oversized_contents = b"0" * (50 * 1024 * 1024 + 1)

    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("huge.pdf", oversized_contents, "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["documents"] == []
    assert body["rejections"] == [{"fileName": "huge.pdf", "reason": "too-large"}]
    assert not (pdfs_dir / "huge.pdf").exists()
