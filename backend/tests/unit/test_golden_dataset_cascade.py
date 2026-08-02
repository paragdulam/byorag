import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import service as auth_service
from app.db.models import Chunk as ChunkRow
from app.db.models import Corpus, Document, GoldenDatasetEntry, GoldenDatasetEntryChunk


def _find_entry(db_session: Session, entry_id: str) -> GoldenDatasetEntry | None:
    # `db_session.get(...)` refreshes a stale-but-still-identity-mapped instance and raises
    # `ObjectDeletedError` when a DB-level (not ORM-level) cascade removed the row out from
    # under it — a fresh `select` avoids that refresh path entirely.
    return db_session.execute(
        select(GoldenDatasetEntry).where(GoldenDatasetEntry.id == entry_id)
    ).scalar_one_or_none()


@pytest.fixture
def user_id(db_session: Session) -> str:
    user = auth_service.create_user(db_session, "golden-cascade@example.com", "hunter22")
    return user.id


def _make_corpus(db_session: Session, user_id: str, name: str = "Corpus") -> Corpus:
    corpus = Corpus(user_id=user_id, name=name)
    db_session.add(corpus)
    db_session.flush()
    return corpus


def _make_document(db_session: Session, user_id: str, name: str = "doc.pdf") -> Document:
    document = Document(
        user_id=user_id,
        name=name,
        content_hash=f"hash-{name}-{id(name)}",
        content=b"x",
        size_bytes=10,
        status="processed",
    )
    db_session.add(document)
    db_session.flush()
    return document


def _make_chunk(db_session: Session, document_id: str, index: int = 0) -> ChunkRow:
    chunk = ChunkRow(
        document_id=document_id,
        index=index,
        content="some evidence text",
        strategy="fixed-size",
        chunk_size=10,
        overlap=0,
    )
    db_session.add(chunk)
    db_session.flush()
    return chunk


def _make_entry(
    db_session: Session,
    user_id: str,
    corpus_id: str,
    document_id: str | None,
    chunk: ChunkRow | None = None,
) -> GoldenDatasetEntry:
    entry = GoldenDatasetEntry(
        user_id=user_id,
        corpus_id=corpus_id,
        document_id=document_id,
        question="What is the notice period?",
        preferred_answer="30 days.",
        source="manual",
        status="approved",
    )
    db_session.add(entry)
    db_session.flush()
    if chunk is not None:
        db_session.add(
            GoldenDatasetEntryChunk(
                entry_id=entry.id,
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                chunk_index=chunk.index,
                content=chunk.content,
                position=0,
            )
        )
        db_session.commit()
    else:
        db_session.commit()
    return entry


def test_deleting_a_document_cascades_its_golden_entries(db_session: Session, user_id: str) -> None:
    corpus = _make_corpus(db_session, user_id)
    document = _make_document(db_session, user_id)
    chunk = _make_chunk(db_session, document.id)
    entry = _make_entry(db_session, user_id, corpus.id, document.id, chunk)
    entry_id = entry.id

    db_session.delete(document)
    db_session.commit()

    assert _find_entry(db_session, entry_id) is None


def test_deleting_a_corpus_cascades_its_corpus_only_golden_entries(
    db_session: Session, user_id: str
) -> None:
    corpus = _make_corpus(db_session, user_id)
    entry = _make_entry(db_session, user_id, corpus.id, document_id=None)
    entry_id = entry.id

    db_session.delete(corpus)
    db_session.commit()

    assert _find_entry(db_session, entry_id) is None


def test_deleting_an_entry_cascades_its_chunk_snapshots(db_session: Session, user_id: str) -> None:
    corpus = _make_corpus(db_session, user_id)
    document = _make_document(db_session, user_id)
    chunk = _make_chunk(db_session, document.id)
    entry = _make_entry(db_session, user_id, corpus.id, document.id, chunk)
    snapshot_id = entry.chunks[0].id

    db_session.delete(entry)
    db_session.commit()

    assert db_session.get(GoldenDatasetEntryChunk, snapshot_id) is None


def test_deleting_a_chunk_nulls_the_snapshots_live_link_without_deleting_the_snapshot(
    db_session: Session, user_id: str
) -> None:
    corpus = _make_corpus(db_session, user_id)
    document = _make_document(db_session, user_id)
    chunk = _make_chunk(db_session, document.id)
    entry = _make_entry(db_session, user_id, corpus.id, document.id, chunk)
    snapshot_id = entry.chunks[0].id
    original_content = entry.chunks[0].content

    db_session.delete(chunk)
    db_session.commit()

    refreshed = db_session.get(GoldenDatasetEntryChunk, snapshot_id)
    assert refreshed is not None
    assert refreshed.chunk_id is None
    assert refreshed.content == original_content
