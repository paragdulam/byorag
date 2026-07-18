from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ConversationTurn
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


def test_entire_corpus_question_retrieves_chunks_from_multiple_documents_and_persists_scope(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    # 3 chunks per document (15 words / chunk size 5), 6 total, requesting the top 5: by
    # pigeonhole, whichever single chunk ranks worst can only belong to one document, so the
    # top 5 is guaranteed to include chunks from both — deterministic regardless of the real
    # embedding model's actual similarity scores on this filler content. Distinct words per
    # document so the two uploads don't collide on content-hash dedup and become one Document.
    upload_save_chunks_and_embeddings(client, corpus_id, "a.pdf", make_words_pdf(15, "alpha"), 5)
    upload_save_chunks_and_embeddings(client, corpus_id, "b.pdf", make_words_pdf(15, "beta"), 5)

    response = client.post(
        "/api/playground/turns",
        json={"corpusId": corpus_id, "model": "bert", "query": "what is this about?"},
    )

    assert response.status_code == 201
    body = response.json()
    document_ids = {chunk["documentId"] for chunk in body["chunks"]}
    assert len(document_ids) == 2

    turn = db_session.execute(
        select(ConversationTurn).where(ConversationTurn.id == body["id"])
    ).scalar_one()
    assert turn.scope == "corpus"
    assert turn.corpus_id == corpus_id
    assert turn.document_id is None
    assert turn.chunking_strategy == "fixed-size"
