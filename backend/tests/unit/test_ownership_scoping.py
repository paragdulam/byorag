"""Cross-account access must look identical to "doesn't exist" — never a distinguishable
403 — across every endpoint that takes a corpus/document/chunk/turn id (FR-008, FR-009).
Each test signs up two independent users directly against `db_session`, has the first
create/own something, then asserts the second user's attempt to reach it 404s exactly like
an unknown id would."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.main import app
from tests.pdf_helpers import make_words_pdf


def _authed_client(db_session: Session, email: str) -> TestClient:
    """A fresh `TestClient` for its own distinct user — independent from any other client in
    the same test, so setting one's auth header can never leak onto another's (the same
    pitfall fixed in conftest.py's `client`/`anonymous_client` split)."""
    user = auth_service.create_user(db_session, email, "hunter22")
    token = auth_service.create_session(db_session, user.id)
    test_client = TestClient(app)
    test_client.headers["Authorization"] = f"Bearer {token}"
    return test_client


def test_corpora_rename_and_delete_of_another_users_corpus_404s(
    anonymous_client: TestClient, db_session: Session
) -> None:
    owner = _authed_client(db_session, "scoping-corpus-owner@example.com")
    corpus_id = owner.post("/api/corpora", json={"name": "Mine"}).json()["id"]

    other = _authed_client(db_session, "scoping-corpus-other@example.com")
    assert other.patch(f"/api/corpora/{corpus_id}", json={"name": "Stolen"}).status_code == 404
    assert other.delete(f"/api/corpora/{corpus_id}").status_code == 404

    # Never shows up in the other user's own listing either.
    assert corpus_id not in {c["id"] for c in other.get("/api/corpora").json()["corpora"]}


def test_sources_endpoints_reject_another_users_corpus_and_document(
    anonymous_client: TestClient, db_session: Session
) -> None:
    owner = _authed_client(db_session, "scoping-sources-owner@example.com")
    corpus_id = owner.post("/api/corpora", json={"name": "Mine"}).json()["id"]
    document_id = owner.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("a.pdf", b"%PDF-1.4 abc", "application/pdf")},
    ).json()["documents"][0]["id"]

    other = _authed_client(db_session, "scoping-sources-other@example.com")
    assert other.get("/api/sources", params={"corpusId": corpus_id}).status_code == 404
    assert other.get(f"/api/sources/{document_id}/file").status_code == 404
    assert other.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("b.pdf", b"%PDF-1.4 xyz", "application/pdf")},
    ).status_code == 404
    # Bulk delete of another user's document is reported as "deleted" (already-gone,
    # per FR-009) rather than revealing it exists — and it must survive untouched.
    delete_response = other.post("/api/sources/delete", json={"ids": [document_id]})
    assert delete_response.status_code == 200
    assert delete_response.json()["results"] == [
        {"id": document_id, "status": "deleted", "reason": None}
    ]
    assert owner.get(f"/api/sources/{document_id}/file").status_code == 200


def test_chunking_endpoints_reject_another_users_document(
    anonymous_client: TestClient, db_session: Session
) -> None:
    owner = _authed_client(db_session, "scoping-chunking-owner@example.com")
    corpus_id = owner.post("/api/corpora", json={"name": "Mine"}).json()["id"]
    document_id = owner.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("a.pdf", b"%PDF-1.4 abc", "application/pdf")},
    ).json()["documents"][0]["id"]

    other = _authed_client(db_session, "scoping-chunking-other@example.com")
    assert other.get(
        "/api/chunking/run/stream", params={"documentId": document_id, "chunkSize": 5}
    ).status_code == 404
    assert other.get(
        "/api/chunking/saved-chunks", params={"documentId": document_id}
    ).status_code == 404
    assert other.get(
        "/api/chunking/structured-preview", params={"documentId": document_id}
    ).status_code == 404


def test_embeddings_endpoints_reject_another_users_document_and_chunk(
    anonymous_client: TestClient, db_session: Session
) -> None:
    owner = _authed_client(db_session, "scoping-embeddings-owner@example.com")
    corpus_id = owner.post("/api/corpora", json={"name": "Mine"}).json()["id"]
    document_id = owner.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("a.pdf", make_words_pdf(20), "application/pdf")},
    ).json()["documents"][0]["id"]
    save = owner.get(
        "/api/chunking/save/stream", params={"documentId": document_id, "chunkSize": 5}
    )
    assert save.status_code == 200
    chunk_id = owner.get(
        "/api/chunking/saved-chunks", params={"documentId": document_id}
    ).json()["chunks"][0]["id"]

    other = _authed_client(db_session, "scoping-embeddings-other@example.com")
    assert other.get(
        "/api/embeddings/generate/stream", params={"documentId": document_id, "model": "bert"}
    ).status_code == 404
    assert other.get("/api/embeddings/saved", params={"chunkId": chunk_id}).status_code == 404


def test_playground_endpoints_reject_another_users_document(
    anonymous_client: TestClient, db_session: Session
) -> None:
    owner = _authed_client(db_session, "scoping-playground-owner@example.com")
    corpus_id = owner.post("/api/corpora", json={"name": "Mine"}).json()["id"]
    document_id = owner.post(
        "/api/sources",
        data={"corpusId": corpus_id},
        files={"files": ("a.pdf", b"%PDF-1.4 abc", "application/pdf")},
    ).json()["documents"][0]["id"]

    other = _authed_client(db_session, "scoping-playground-other@example.com")
    assert other.get(
        "/api/playground/context", params={"documentId": document_id}
    ).status_code == 404
    assert other.get("/api/playground/turns", params={"documentId": document_id}).status_code == 404
    assert other.post(
        "/api/playground/turns",
        json={"documentId": document_id, "model": "bert", "query": "hello"},
    ).status_code == 404


def test_metrics_endpoints_reject_another_users_corpus(
    anonymous_client: TestClient, db_session: Session
) -> None:
    owner = _authed_client(db_session, "scoping-metrics-owner@example.com")
    corpus_id = owner.post("/api/corpora", json={"name": "Mine"}).json()["id"]

    other = _authed_client(db_session, "scoping-metrics-other@example.com")
    assert other.get(f"/api/metrics/corpora/{corpus_id}/pipelines").status_code == 404
    assert other.get(f"/api/metrics/corpora/{corpus_id}/compare").status_code == 404
    # Never shows up in the other user's own corpora list either.
    assert corpus_id not in {c["corpusId"] for c in other.get("/api/metrics/corpora").json()["corpora"]}


def test_listing_endpoints_only_return_the_requesting_users_own_rows(
    anonymous_client: TestClient, db_session: Session
) -> None:
    first = _authed_client(db_session, "scoping-listing-first@example.com")
    first.post("/api/corpora", json={"name": "First's Corpus"})

    second = _authed_client(db_session, "scoping-listing-second@example.com")
    second.post("/api/corpora", json={"name": "Second's Corpus"})

    first_names = {c["name"] for c in first.get("/api/corpora").json()["corpora"]}
    second_names = {c["name"] for c in second.get("/api/corpora").json()["corpora"]}
    assert first_names == {"First's Corpus"}
    assert second_names == {"Second's Corpus"}
