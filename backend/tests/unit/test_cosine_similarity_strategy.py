from sqlalchemy.orm import Session

from app.db.models import EMBEDDING_DIMENSIONS
from app.db.models import Chunk as ChunkRow
from app.db.models import Document
from app.db.models import Embedding as EmbeddingRow
from app.retrieval.strategies.cosine_similarity import CosineSimilarityStrategy


def _make_document(db_session: Session, name: str = "doc.pdf") -> Document:
    document = Document(
        name=name,
        content_hash=f"hash-{name}-{id(name)}",
        content=b"x",
        size_bytes=10,
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    return document


def _make_chunk(db_session: Session, document: Document, index: int, content: str = "text") -> ChunkRow:
    chunk = ChunkRow(
        document_id=document.id,
        index=index,
        content=content,
        strategy="fixed-size",
        chunk_size=10,
        overlap=0,
    )
    db_session.add(chunk)
    db_session.flush()
    return chunk


def _make_embedding(
    db_session: Session, chunk: ChunkRow, vector: list[float], model: str = "bert"
) -> EmbeddingRow:
    embedding = EmbeddingRow(chunk_id=chunk.id, model=model, vector=vector)
    db_session.add(embedding)
    db_session.flush()
    return embedding


def _unit_vector(index: int) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSIONS
    vector[index] = 1.0
    return vector


def test_orders_results_by_similarity_descending(db_session: Session) -> None:
    document = _make_document(db_session)
    matching_chunk = _make_chunk(db_session, document, 0, content="matches the query")
    orthogonal_chunk = _make_chunk(db_session, document, 1, content="unrelated")
    _make_embedding(db_session, matching_chunk, _unit_vector(0))
    _make_embedding(db_session, orthogonal_chunk, _unit_vector(1))
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search(db_session, document.id, "bert", _unit_vector(0), limit=5)

    assert [chunk.id for chunk, _embedding_id, _score in results] == [matching_chunk.id, orthogonal_chunk.id]
    assert results[0][2] > results[1][2]
    assert results[0][2] == 1.0


def test_caps_results_at_the_requested_limit(db_session: Session) -> None:
    document = _make_document(db_session)
    for i in range(6):
        chunk = _make_chunk(db_session, document, i, content=f"chunk {i}")
        _make_embedding(db_session, chunk, _unit_vector(i))
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search(db_session, document.id, "bert", _unit_vector(0), limit=5)

    assert len(results) == 5


def test_deduplicates_a_chunk_with_multiple_saved_embeddings(db_session: Session) -> None:
    document = _make_document(db_session)
    chunk = _make_chunk(db_session, document, 0, content="saved twice")
    # Older, worse-matching embedding first, then a newer, better-matching one — the
    # strategy must keep only the best-scoring one, not one row per saved embedding.
    _make_embedding(db_session, chunk, _unit_vector(1))
    _make_embedding(db_session, chunk, _unit_vector(0))
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search(db_session, document.id, "bert", _unit_vector(0), limit=5)

    assert len(results) == 1
    assert results[0][0].id == chunk.id
    assert results[0][2] == 1.0


def test_scopes_results_to_the_requested_document_and_model(db_session: Session) -> None:
    document = _make_document(db_session, "doc-a.pdf")
    other_document = _make_document(db_session, "doc-b.pdf")
    in_scope_chunk = _make_chunk(db_session, document, 0, content="in scope")
    other_doc_chunk = _make_chunk(db_session, other_document, 0, content="other document")
    _make_embedding(db_session, in_scope_chunk, _unit_vector(0), model="bert")
    _make_embedding(db_session, other_doc_chunk, _unit_vector(0), model="bert")
    # Same document, different model — must not be picked up when searching for "bert".
    _make_embedding(db_session, in_scope_chunk, _unit_vector(0), model="other-model")
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search(db_session, document.id, "bert", _unit_vector(0), limit=5)

    assert [chunk.id for chunk, _embedding_id, _score in results] == [in_scope_chunk.id]
