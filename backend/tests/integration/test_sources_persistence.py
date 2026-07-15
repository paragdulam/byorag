from pathlib import Path

from fastapi.testclient import TestClient


def test_save_then_list_round_trip(client: TestClient, pdfs_dir: Path, corpus_id: str) -> None:
    upload_response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("notes.pdf", b"%PDF-1.4 abc", "application/pdf")},
    )
    assert upload_response.status_code == 200

    assert (pdfs_dir / "notes.pdf").exists()

    list_response = client.get("/api/sources", params={"corpusId": corpus_id})
    assert list_response.status_code == 200
    docs = list_response.json()["documents"]
    assert len(docs) == 1
    assert docs[0]["name"] == "notes.pdf"
    assert docs[0]["sizeBytes"] == len(b"%PDF-1.4 abc")
