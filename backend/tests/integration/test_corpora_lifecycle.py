from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Document


def test_corpus_lifecycle_create_list_switch_scopes_sources(client: TestClient) -> None:
    corpus_a = client.post("/api/corpora", json={"name": "Corpus A"}).json()
    corpus_b = client.post("/api/corpora", json={"name": "Corpus B"}).json()

    names = {c["name"] for c in client.get("/api/corpora").json()["corpora"]}
    assert names == {"Corpus A", "Corpus B"}

    # Both start empty and independently scoped (FR-004).
    assert client.get("/api/sources", params={"corpusId": corpus_a["id"]}).json() == {
        "documents": []
    }
    assert client.get("/api/sources", params={"corpusId": corpus_b["id"]}).json() == {
        "documents": []
    }


def test_duplicate_corpus_name_rejected(client: TestClient) -> None:
    client.post("/api/corpora", json={"name": "Duplicate"})

    response = client.post("/api/corpora", json={"name": "Duplicate"})

    assert response.status_code == 409
    assert client.get("/api/corpora").json()["corpora"].__len__() == 1


def test_delete_blocked_while_corpus_has_documents(client: TestClient, db_session: Session) -> None:
    corpus = client.post("/api/corpora", json={"name": "Has Docs"}).json()

    document = Document(
        corpus_id=corpus["id"],
        name="a.pdf",
        content_hash="a" * 64,
        content=b"x",
        size_bytes=10,
        status="processed",
    )
    db_session.add(document)
    db_session.commit()

    response = client.delete(f"/api/corpora/{corpus['id']}")

    assert response.status_code == 409
    assert client.get("/api/corpora").json()["corpora"].__len__() == 1


def test_switching_active_corpus_scopes_sources(client: TestClient, db_session: Session) -> None:
    corpus_a = client.post("/api/corpora", json={"name": "Scoped A"}).json()
    corpus_b = client.post("/api/corpora", json={"name": "Scoped B"}).json()

    document = Document(
        corpus_id=corpus_a["id"],
        name="only-in-a.pdf",
        content_hash="b" * 64,
        content=b"x",
        size_bytes=5,
        status="processed",
    )
    db_session.add(document)
    db_session.commit()

    docs_a = client.get("/api/sources", params={"corpusId": corpus_a["id"]}).json()["documents"]
    docs_b = client.get("/api/sources", params={"corpusId": corpus_b["id"]}).json()["documents"]

    assert [d["name"] for d in docs_a] == ["only-in-a.pdf"]
    assert docs_b == []
