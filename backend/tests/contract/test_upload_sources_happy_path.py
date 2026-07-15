from fastapi.testclient import TestClient


def make_pdf_bytes() -> bytes:
    return b"%PDF-1.4 fake pdf contents"


def test_upload_single_valid_pdf(client: TestClient, corpus_id: str) -> None:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
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


def test_upload_multiple_valid_pdfs_in_one_request(client: TestClient, corpus_id: str) -> None:
    files = [
        ("files", ("a.pdf", b"a" * 20, "application/pdf")),
        ("files", ("b.pdf", b"b" * 20, "application/pdf")),
        ("files", ("c.pdf", b"c" * 20, "application/pdf")),
    ]

    response = client.post("/api/sources", data={"corpusId": corpus_id}, files=files)

    assert response.status_code == 200
    body = response.json()
    assert body["rejections"] == []
    names = {doc["name"] for doc in body["documents"]}
    assert names == {"a.pdf", "b.pdf", "c.pdf"}


def test_uploaded_file_is_reflected_in_subsequent_list(client: TestClient, corpus_id: str) -> None:
    client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_pdf_bytes(), "application/pdf")},
    )

    response = client.get("/api/sources", params={"corpusId": corpus_id})

    assert response.status_code == 200
    names = {doc["name"] for doc in response.json()["documents"]}
    assert "report.pdf" in names


def test_upload_missing_corpus_id_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/sources",
        files={"files": ("report.pdf", make_pdf_bytes(), "application/pdf")},
    )

    assert response.status_code == 400


def test_upload_unknown_corpus_id_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/sources",
        data={"corpusId": "00000000-0000-0000-0000-000000000000"},
        files={"files": ("report.pdf", make_pdf_bytes(), "application/pdf")},
    )

    assert response.status_code == 404


def test_uploading_identical_content_twice_dedupes_instead_of_duplicating(
    client: TestClient, corpus_id: str
) -> None:
    first = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", make_pdf_bytes(), "application/pdf")},
    )
    second = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report-copy.pdf", make_pdf_bytes(), "application/pdf")},
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["documents"][0]["id"] == second.json()["documents"][0]["id"]

    list_body = client.get("/api/sources", params={"corpusId": corpus_id}).json()
    assert len(list_body["documents"]) == 1
