from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import EMBEDDING_DIMENSIONS
from app.db.models import Chunk as ChunkRow
from app.db.models import Embedding as EmbeddingRow
from tests.contract.test_playground_turns import upload_save_chunks_and_embeddings
from tests.pdf_helpers import make_words_pdf


def test_compare_unknown_corpus_returns_404(client: TestClient) -> None:
    response = client.get("/api/metrics/corpora/does-not-exist/compare")

    assert response.status_code == 404


def test_compare_with_fewer_than_two_pipelines_returns_400(client: TestClient, corpus_id: str) -> None:
    upload_save_chunks_and_embeddings(client, corpus_id, "report.pdf", make_words_pdf(10), 5)

    response = client.get(f"/api/metrics/corpora/{corpus_id}/compare")

    assert response.status_code == 400


def test_compare_with_two_pipelines_returns_both(
    client: TestClient, corpus_id: str, db_session: Session
) -> None:
    # Only one chunking technique is registered today (research.md), so a second pipeline is
    # simulated directly at the DB layer here — a second registered technique would otherwise
    # make this reachable purely through the chunking/embeddings APIs.
    document_id = upload_save_chunks_and_embeddings(
        client, corpus_id, "report.pdf", make_words_pdf(10), 5
    )
    other_chunk = ChunkRow(
        document_id=document_id, index=999, content="other technique's chunk",
        strategy="semantic", chunk_size=5, overlap=0,
    )
    db_session.add(other_chunk)
    db_session.flush()
    db_session.add(
        EmbeddingRow(chunk_id=other_chunk.id, model="bert", vector=[0.0] * EMBEDDING_DIMENSIONS)
    )
    db_session.commit()

    response = client.get(f"/api/metrics/corpora/{corpus_id}/compare")

    assert response.status_code == 200
    body = response.json()
    assert len(body["pipelines"]) == 2
    assert {p["chunkingStrategy"] for p in body["pipelines"]} == {"fixed-size", "semantic"}
    for pipeline in body["pipelines"]:
        assert pipeline["retrievalStrategy"] == "cosine-similarity"
        assert pipeline["generationLlm"] is None
        assert pipeline["judgeLlm"] is None
