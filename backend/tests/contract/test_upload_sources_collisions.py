from pathlib import Path

from fastapi.testclient import TestClient


def test_same_filename_uploaded_twice_is_saved_under_a_suffixed_name(
    client: TestClient, pdfs_dir: Path
) -> None:
    first = client.post(
        "/api/sources",
        files={"files": ("report.pdf", b"%PDF-1.4 first", "application/pdf")},
    )
    second = client.post(
        "/api/sources",
        files={"files": ("report.pdf", b"%PDF-1.4 second", "application/pdf")},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["documents"][0]["name"] == "report.pdf"
    assert second.json()["documents"][0]["name"] == "report (1).pdf"

    list_body = client.get("/api/sources").json()
    names = {doc["name"] for doc in list_body["documents"]}
    assert names == {"report.pdf", "report (1).pdf"}
