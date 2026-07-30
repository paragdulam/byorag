from fastapi.testclient import TestClient


def test_mixed_valid_and_invalid_batch_only_saves_the_valid_file(
    client: TestClient, corpus_id: str
) -> None:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files=[
            ("files", ("good.pdf", b"%PDF-1.4 ok", "application/pdf")),
            ("files", ("notes.txt", b"nope", "text/plain")),
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert [doc["name"] for doc in body["documents"]] == ["good.pdf"]
    assert body["rejections"] == [{"fileName": "notes.txt", "reason": "invalid-type"}]

    list_body = client.get("/api/sources", params={"corpusId": corpus_id}).json()
    assert [doc["name"] for doc in list_body["documents"]] == ["good.pdf"]
