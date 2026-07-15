import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Fixed to bert-base-uncased's hidden size — the only registered embedding model today.
# A second model with a different output dimension will require a schema change
# (013-bert-pgvector-embeddings research.md §3, a deliberately deferred limitation).
EMBEDDING_DIMENSIONS = 768


def _new_uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Corpus(Base):
    __tablename__ = "corpora"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    document_links: Mapped[list["DocumentCorpus"]] = relationship(
        back_populates="corpus", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    storage_path: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="processed")
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    corpus_links: Mapped[list["DocumentCorpus"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    chunks: Mapped[list["Chunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    conversation_turns: Mapped[list["ConversationTurn"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class DocumentCorpus(Base):
    __tablename__ = "document_corpora"

    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    corpus_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("corpora.id", ondelete="RESTRICT"),
        primary_key=True,
        index=True,
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    document: Mapped["Document"] = relationship(back_populates="corpus_links")
    corpus: Mapped["Corpus"] = relationship(back_populates="document_links")


class Chunk(Base):
    __tablename__ = "chunks"
    __table_args__ = (UniqueConstraint("document_id", "index", name="uq_chunk_document_index"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    strategy: Mapped[str] = mapped_column(String, nullable=False)
    chunk_size: Mapped[int] = mapped_column(Integer, nullable=False)
    overlap: Mapped[int] = mapped_column(Integer, nullable=False)

    document: Mapped["Document"] = relationship(back_populates="chunks")
    embeddings: Mapped[list["Embedding"]] = relationship(
        back_populates="chunk", cascade="all, delete-orphan"
    )


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    chunk_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("chunks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The registered model-registry key (e.g. "bert"), not the underlying model artifact
    # name — mirrors Chunk.strategy storing "fixed-size" (013 research.md §6).
    model: Mapped[str] = mapped_column(String, nullable=False)
    vector: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSIONS), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    # No UniqueConstraint on (chunk_id, model) — saves accumulate, never replace
    # (013-bert-pgvector-embeddings research.md §6).
    chunk: Mapped["Chunk"] = relationship(back_populates="embeddings")


class ConversationTurn(Base):
    """One persisted question in a document's Playground conversation (017 spec FR-016).

    Status is derived, not stored, from `answer`/`error` (data-model.md): no chunks means
    retrieval found nothing; `answer is None and error is None` means retrieved but not yet
    generated; `error is not None` means the last generate attempt failed (retryable);
    `answer is not None` means answered (with `error` always cleared to None in that state).
    """

    __tablename__ = "conversation_turns"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    embedding_model: Mapped[str] = mapped_column(String, nullable=False)
    query_embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIMENSIONS), nullable=False)
    llm_provider: Mapped[str | None] = mapped_column(String, nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String, nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document: Mapped["Document"] = relationship(back_populates="conversation_turns")
    chunks: Mapped[list["ConversationTurnChunk"]] = relationship(
        back_populates="turn", cascade="all, delete-orphan", order_by="ConversationTurnChunk.rank"
    )


class ConversationTurnChunk(Base):
    """A snapshot of one chunk retrieved for a `ConversationTurn` (017 research.md Decision 1).

    `chunk_index`/`content` are copied at retrieval time and are the durable source of truth —
    they survive a later re-chunk of the document even though `chunk_id`/`embedding_id` (kept
    only as best-effort live links) would otherwise be nulled out by that same re-chunk.
    """

    __tablename__ = "conversation_turn_chunks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    turn_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversation_turns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True
    )
    embedding_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("embeddings.id", ondelete="SET NULL"), nullable=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    turn: Mapped["ConversationTurn"] = relationship(back_populates="chunks")
