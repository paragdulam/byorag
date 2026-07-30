from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Chunk, Document, DocumentCorpus


def upload_pdf(client: TestClient, corpus_id: str, name: str, content: bytes) -> str:
    response = client.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": (name, content, "application/pdf")},
    )
    return response.json()["documents"][0]["id"]


def test_dedup_attach_unlink_survives_then_deletes_on_last_unlink(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    corpus_a = corpus_id
    corpus_b = client.post("/api/corpora", json={"name": "Corpus B"}).json()["id"]
    content = b"%PDF-1.4 shared contents"

    # Upload into Corpus A.
    document_id = upload_pdf(client, corpus_a, "shared.pdf", content)

    # Re-uploading identical content into Corpus B dedupes: same document id,
    # no duplicate document/chunk rows (FR-005, FR-006, SC-004).
    dedup_id = upload_pdf(client, corpus_b, "shared-copy.pdf", content)
    assert dedup_id == document_id
    # Scoped to this document's own content hash, not a global count — the shared dev
    # database this suite runs against holds other real documents too.
    matching = db_session.execute(
        select(Document).where(Document.id == document_id)
    ).scalars().all()
    assert len(matching) == 1

    # Simulate a persisted chunk for this document (chunk persistence itself
    # lands in User Story 3; here we only verify the cascade-delete behavior
    # FR-008/SC-006 depends on).
    db_session.add(
        Chunk(
            document_id=document_id,
            index=0,
            content="chunk text",
            strategy="fixed-size",
            chunk_size=50,
            overlap=0,
        )
    )
    db_session.commit()

    # Unlinking from Corpus A: document survives (still linked to Corpus B).
    response = client.delete(f"/api/sources/{document_id}/corpora/{corpus_a}")
    assert response.status_code == 204
    assert client.get("/api/sources", params={"corpusId": corpus_a}).json()["documents"] == []
    docs_b = client.get("/api/sources", params={"corpusId": corpus_b}).json()["documents"]
    assert [d["id"] for d in docs_b] == [document_id]
    assert db_session.get(Document, document_id) is not None
    assert (
        db_session.execute(select(Chunk).where(Chunk.document_id == document_id))
        .scalars()
        .first()
        is not None
    )

    # Unlinking from Corpus B (the last remaining corpus) deletes the
    # document and all of its chunks (FR-008, SC-006).
    response = client.delete(f"/api/sources/{document_id}/corpora/{corpus_b}")
    assert response.status_code == 204
    assert db_session.get(Document, document_id) is None
    assert (
        db_session.execute(select(Chunk).where(Chunk.document_id == document_id)).scalars().all()
        == []
    )
    assert (
        db_session.execute(
            select(DocumentCorpus).where(DocumentCorpus.document_id == document_id)
        )
        .scalars()
        .all()
        == []
    )
