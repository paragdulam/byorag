from sqlalchemy.orm import Session

from app.db.models import EMBEDDING_DIMENSIONS
from app.db.models import Chunk as ChunkRow
from app.db.models import Corpus, Document, DocumentCorpus
from app.db.models import Embedding as EmbeddingRow
from app.retrieval.strategies.cosine_similarity import CosineSimilarityStrategy


def _make_corpus(db_session: Session, name: str = "corpus") -> Corpus:
    corpus = Corpus(name=name)
    db_session.add(corpus)
    db_session.flush()
    return corpus


def _make_document_in_corpus(db_session: Session, corpus: Corpus, name: str) -> Document:
    document = Document(
        name=name, content_hash=f"hash-{name}-{id(name)}", storage_path="/tmp/x.pdf",
        size_bytes=10, status="processed",
    )
    db_session.add(document)
    db_session.flush()
    db_session.add(DocumentCorpus(document_id=document.id, corpus_id=corpus.id))
    db_session.flush()
    return document


def _make_chunk(db_session: Session, document: Document, index: int, content: str = "text") -> ChunkRow:
    chunk = ChunkRow(
        document_id=document.id, index=index, content=content, strategy="fixed-size",
        chunk_size=10, overlap=0,
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


def test_search_corpus_ranks_chunks_across_multiple_documents(db_session: Session) -> None:
    corpus = _make_corpus(db_session)
    doc_a = _make_document_in_corpus(db_session, corpus, "a.pdf")
    doc_b = _make_document_in_corpus(db_session, corpus, "b.pdf")
    best_chunk = _make_chunk(db_session, doc_b, 0, content="best match, in doc b")
    other_chunk = _make_chunk(db_session, doc_a, 0, content="worse match, in doc a")
    _make_embedding(db_session, best_chunk, _unit_vector(0))
    _make_embedding(db_session, other_chunk, _unit_vector(1))
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search_corpus(db_session, corpus.id, "bert", _unit_vector(0), limit=5)

    assert [chunk.id for chunk, _eid, _score in results] == [best_chunk.id, other_chunk.id]
    assert results[0][0].document_id == doc_b.id


def test_search_corpus_returns_one_global_top_k_not_per_document(db_session: Session) -> None:
    corpus = _make_corpus(db_session)
    doc_a = _make_document_in_corpus(db_session, corpus, "a.pdf")
    doc_b = _make_document_in_corpus(db_session, corpus, "b.pdf")
    # doc_a has 3 near-perfect matches; doc_b has 1 mediocre match — a global top-2 should
    # take both of doc_a's best rather than reserving a slot for doc_b.
    for i in range(3):
        chunk = _make_chunk(db_session, doc_a, i, content=f"doc a chunk {i}")
        _make_embedding(db_session, chunk, _unit_vector(0))
    mediocre = _make_chunk(db_session, doc_b, 0, content="doc b chunk")
    _make_embedding(db_session, mediocre, _unit_vector(50))

    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search_corpus(db_session, corpus.id, "bert", _unit_vector(0), limit=2)

    assert len(results) == 2
    assert all(chunk.document_id == doc_a.id for chunk, _eid, _score in results)


def test_search_corpus_excludes_documents_outside_the_corpus(db_session: Session) -> None:
    corpus = _make_corpus(db_session, "corpus-a")
    other_corpus = _make_corpus(db_session, "corpus-b")
    in_scope_doc = _make_document_in_corpus(db_session, corpus, "in.pdf")
    out_of_scope_doc = _make_document_in_corpus(db_session, other_corpus, "out.pdf")
    in_scope_chunk = _make_chunk(db_session, in_scope_doc, 0, content="in scope")
    out_of_scope_chunk = _make_chunk(db_session, out_of_scope_doc, 0, content="out of scope")
    _make_embedding(db_session, in_scope_chunk, _unit_vector(0))
    _make_embedding(db_session, out_of_scope_chunk, _unit_vector(0))
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search_corpus(db_session, corpus.id, "bert", _unit_vector(0), limit=5)

    assert [chunk.id for chunk, _eid, _score in results] == [in_scope_chunk.id]


def test_search_corpus_excludes_other_embedding_models(db_session: Session) -> None:
    corpus = _make_corpus(db_session)
    document = _make_document_in_corpus(db_session, corpus, "a.pdf")
    chunk = _make_chunk(db_session, document, 0)
    _make_embedding(db_session, chunk, _unit_vector(0), model="other-model")
    db_session.commit()

    strategy = CosineSimilarityStrategy()
    results = strategy.search_corpus(db_session, corpus.id, "bert", _unit_vector(0), limit=5)

    assert results == []
