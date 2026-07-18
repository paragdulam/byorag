from fastapi.testclient import TestClient

from tests.pdf_helpers import make_words_pdf


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_saved_chunks_returns_previously_saved_chunks_in_order(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    client.get("/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5})

    response = client.get("/api/chunking/saved-chunks", params={"documentId": document_id})

    assert response.status_code == 200
    chunks = response.json()["chunks"]
    assert [c["index"] for c in chunks] == [0, 1, 2, 3]
    assert chunks[0]["content"] == "word word word word word"


def test_saved_chunks_empty_list_when_nothing_saved(client: TestClient, corpus_id: str) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get("/api/chunking/saved-chunks", params={"documentId": document_id})

    assert response.status_code == 200
    assert response.json() == {"chunks": []}


def test_saved_chunks_unknown_document(client: TestClient) -> None:
    response = client.get(
        "/api/chunking/saved-chunks",
        params={"documentId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    assert "detail" in response.json()
