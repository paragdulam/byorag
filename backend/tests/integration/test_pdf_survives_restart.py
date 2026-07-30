"""Upload a document, then remove any local pdfs_dir reference entirely (never even
create it) — preview/chunking/structured-preview must still succeed purely from
`Document.content` (024-user-authentication SC-004, research.md §8)."""

import shutil

from fastapi.testclient import TestClient

from app.config import settings
from tests.pdf_helpers import make_words_pdf


def test_pdf_content_and_chunking_survive_without_any_local_file(
    client: TestClient, corpus_id: str
) -> None:
    content = make_words_pdf(20)
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", content, "application/pdf")},
    )
    assert upload.status_code == 200
    document_id = upload.json()["documents"][0]["id"]

    # No pdfs_dir was ever created for this test (unlike tests using the `pdfs_dir`
    # fixture) — if any code path still depended on a local file, this would 404/500.
    assert not settings.pdfs_dir.exists() or not any(settings.pdfs_dir.iterdir())

    file_response = client.get(f"/api/sources/{document_id}/file")
    assert file_response.status_code == 200
    assert file_response.content == content

    save = client.get(
        "/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5}
    )
    assert save.status_code == 200

    preview = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )
    assert preview.status_code == 200
    assert "word" in preview.json()["fullText"]


def test_pdf_survives_even_if_pdfs_dir_is_deleted_after_upload(
    client: TestClient, pdfs_dir, corpus_id: str
) -> None:
    content = make_words_pdf(10)
    upload = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", content, "application/pdf")},
    )
    document_id = upload.json()["documents"][0]["id"]

    if pdfs_dir.exists():
        shutil.rmtree(pdfs_dir)

    file_response = client.get(f"/api/sources/{document_id}/file")
    assert file_response.status_code == 200
    assert file_response.content == content
