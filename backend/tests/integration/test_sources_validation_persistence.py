from pathlib import Path

from fastapi.testclient import TestClient


def test_mixed_valid_and_invalid_batch_only_saves_the_valid_file(
    client: TestClient, pdfs_dir: Path
) -> None:
    response = client.post(
        "/api/sources",
        files=[
            ("files", ("good.pdf", b"%PDF-1.4 ok", "application/pdf")),
            ("files", ("notes.txt", b"nope", "text/plain")),
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert [doc["name"] for doc in body["documents"]] == ["good.pdf"]
    assert body["rejections"] == [{"fileName": "notes.txt", "reason": "invalid-type"}]

    assert (pdfs_dir / "good.pdf").exists()
    assert not (pdfs_dir / "notes.txt").exists()

    list_body = client.get("/api/sources").json()
    assert [doc["name"] for doc in list_body["documents"]] == ["good.pdf"]
