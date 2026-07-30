from fastapi.testclient import TestClient


def test_two_sequential_uploads_with_identical_filenames_are_kept_distinct(
    client: TestClient, corpus_id: str
) -> None:
    first = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", b"%PDF-1.4 original", "application/pdf")},
    )
    second = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("report.pdf", b"%PDF-1.4 replacement", "application/pdf")},
    )

    first_document = first.json()["documents"][0]
    second_document = second.json()["documents"][0]
    assert sorted([first_document["name"], second_document["name"]]) == [
        "report (1).pdf",
        "report.pdf",
    ]

    by_name = {
        first_document["name"]: first_document["id"],
        second_document["name"]: second_document["id"],
    }
    assert client.get(f"/api/sources/{by_name['report.pdf']}/file").content == (
        b"%PDF-1.4 original"
    )
    assert client.get(f"/api/sources/{by_name['report (1).pdf']}/file").content == (
        b"%PDF-1.4 replacement"
    )
