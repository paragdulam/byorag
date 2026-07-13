from fastapi.testclient import TestClient


def make_pdf_bytes() -> bytes:
    return b"%PDF-1.4 fake pdf contents"


def test_upload_single_valid_pdf(client: TestClient) -> None:
    response = client.post(
        "/api/sources",
        files={"files": ("report.pdf", make_pdf_bytes(), "application/pdf")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rejections"] == []
    assert len(body["documents"]) == 1
    doc = body["documents"][0]
    assert doc["name"] == "report.pdf"
    assert doc["sizeBytes"] == len(make_pdf_bytes())
    assert doc["status"] == "processed"


def test_upload_multiple_valid_pdfs_in_one_request(client: TestClient) -> None:
    files = [
        ("files", ("a.pdf", make_pdf_bytes(), "application/pdf")),
        ("files", ("b.pdf", make_pdf_bytes(), "application/pdf")),
        ("files", ("c.pdf", make_pdf_bytes(), "application/pdf")),
    ]

    response = client.post("/api/sources", files=files)

    assert response.status_code == 200
    body = response.json()
    assert body["rejections"] == []
    names = {doc["name"] for doc in body["documents"]}
    assert names == {"a.pdf", "b.pdf", "c.pdf"}


def test_uploaded_file_is_reflected_in_subsequent_list(client: TestClient) -> None:
    client.post(
        "/api/sources",
        files={"files": ("report.pdf", make_pdf_bytes(), "application/pdf")},
    )

    response = client.get("/api/sources")

    assert response.status_code == 200
    names = {doc["name"] for doc in response.json()["documents"]}
    assert "report.pdf" in names
