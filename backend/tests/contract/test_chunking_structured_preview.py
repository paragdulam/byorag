from pathlib import Path

from fastapi.testclient import TestClient

from tests.pdf_helpers import make_multi_page_words_pdf, make_words_pdf


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def save_chunks(client: TestClient, document_id: str, chunk_size: int, overlap: int = 0) -> None:
    response = client.get(
        "/api/chunking/save/stream",
        params={"documentId": document_id, "chunkSize": chunk_size, "overlap": overlap},
    )
    assert response.status_code == 200


def test_structured_preview_returns_full_text_and_segments(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    save_chunks(client, document_id, chunk_size=5, overlap=0)

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    assert response.status_code == 200
    body = response.json()
    assert "word" in body["fullText"]
    segments = body["segments"]
    assert len(segments) > 0
    # No overlap segments when overlap=0
    assert all(s["kind"] == "chunk" for s in segments)
    # Segments are contiguous and ordered
    for prev, curr in zip(segments, segments[1:]):
        assert prev["end"] == curr["start"]


def test_structured_preview_includes_overlap_segments_when_overlap_configured(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    save_chunks(client, document_id, chunk_size=6, overlap=3)

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    assert response.status_code == 200
    segments = response.json()["segments"]
    assert any(s["kind"] == "overlap" for s in segments)
    for segment in segments:
        if segment["kind"] == "overlap":
            assert segment["chunkIndex"] is None
        else:
            assert isinstance(segment["chunkIndex"], int)


def test_structured_preview_unknown_document_returns_404(client: TestClient) -> None:
    response = client.get(
        "/api/chunking/structured-preview",
        params={"documentId": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    assert "no document found" in response.json()["detail"].lower()


def test_structured_preview_zero_saved_chunks_returns_404(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    assert response.status_code == 404
    assert "no saved chunks" in response.json()["detail"].lower()


def test_structured_preview_missing_file_returns_404(
    client: TestClient, pdfs_dir: Path, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    save_chunks(client, document_id, chunk_size=5, overlap=0)
    for path in pdfs_dir.iterdir():
        path.unlink()

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    assert response.status_code == 404
    detail = response.json()["detail"].lower()
    assert "missing" in detail or "unreadable" in detail


def test_structured_preview_pages_partition_full_text_for_single_page_document(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    save_chunks(client, document_id, chunk_size=5, overlap=0)

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    body = response.json()
    pages = body["pages"]
    assert len(pages) == 1
    assert pages[0]["pageNumber"] == 1
    assert pages[0]["start"] == 0
    assert pages[0]["end"] == len(body["fullText"])


def test_structured_preview_pages_partition_full_text_for_multi_page_document(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(
        client, corpus_id, "report.pdf", make_multi_page_words_pdf([10, 15, 8])
    )
    save_chunks(client, document_id, chunk_size=6, overlap=0)

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    body = response.json()
    pages = body["pages"]
    assert len(pages) == 3
    assert [p["pageNumber"] for p in pages] == [1, 2, 3]
    # Pages are ordered, contiguous (no gaps/overlaps), and fully cover fullText.
    assert pages[0]["start"] == 0
    for prev, curr in zip(pages, pages[1:]):
        assert prev["end"] == curr["start"]
    assert pages[-1]["end"] == len(body["fullText"])


def test_structured_preview_chunk_ranges_one_per_saved_chunk(
    client: TestClient, corpus_id: str
) -> None:
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    save_chunks(client, document_id, chunk_size=5, overlap=0)

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    body = response.json()
    chunk_ranges = body["chunkRanges"]
    assert len(chunk_ranges) == 4  # 20 words / chunk_size=5, no overlap
    assert [c["chunkIndex"] for c in chunk_ranges] == [0, 1, 2, 3]
    for chunk_range in chunk_ranges:
        assert 0 <= chunk_range["start"] < chunk_range["end"] <= len(body["fullText"])


def test_structured_preview_chunk_ranges_recoverable_even_when_overlapping(
    client: TestClient, corpus_id: str
) -> None:
    # Independent of segments' overlap-collapsing (research.md §4) — each chunk's own start/end
    # is still exactly recoverable even where two chunks' ranges overlap.
    document_id = upload_pdf(client, corpus_id, "report.pdf", make_words_pdf(20))
    save_chunks(client, document_id, chunk_size=6, overlap=3)

    response = client.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    )

    body = response.json()
    chunk_ranges = {c["chunkIndex"]: c for c in body["chunkRanges"]}
    assert 0 in chunk_ranges and 1 in chunk_ranges
    # Chunk 1 starts before chunk 0 ends — a real overlap in character-range terms.
    assert chunk_ranges[1]["start"] < chunk_ranges[0]["end"]
