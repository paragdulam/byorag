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
    """One persisted question in a Playground conversation, scoped either to a single
    document or to an entire corpus (017 spec FR-016; 019-metrics-dashboard extends scope).

    Status is derived, not stored, from `answer`/`error` (data-model.md): no chunks means
    retrieval found nothing; `answer is None and error is None` means retrieved but not yet
    generated; `error is not None` means the last generate attempt failed (retryable);
    `answer is not None` means answered (with `error` always cleared to None in that state).

    Exactly one of `document_id`/`corpus_id` is set, matching `scope` (019-metrics-dashboard
    data-model.md) — enforced at the service layer, not the database, mirroring how other
    cross-field invariants in this codebase are validated before persistence.
    """

    __tablename__ = "conversation_turns"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    document_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    corpus_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("corpora.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    scope: Mapped[str] = mapped_column(String, nullable=False, default="document")
    # Snapshot of the top-ranked retrieved chunk's `Chunk.strategy` at turn-creation time
    # (019-metrics-dashboard) — lets metrics aggregation group turns into a
    # (corpus_id, chunking_strategy, embedding_model) "pipeline" without requiring retrieval
    # itself to be strategy-scoped (retrieval still searches all of a document's/corpus's
    # chunks for the given `embedding_model`, matching the pre-existing 017 behavior). Null
    # only when retrieval found zero chunks.
    chunking_strategy: Mapped[str | None] = mapped_column(String, nullable=True)
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

    document: Mapped["Document | None"] = relationship(back_populates="conversation_turns")
    corpus: Mapped["Corpus | None"] = relationship()
    chunks: Mapped[list["ConversationTurnChunk"]] = relationship(
        back_populates="turn", cascade="all, delete-orphan", order_by="ConversationTurnChunk.rank"
    )
    quality_score: Mapped["TurnQualityScore | None"] = relationship(
        back_populates="turn", cascade="all, delete-orphan", uselist=False
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
    # Snapshot of which document this chunk came from — always populated for a
    # scope="corpus" turn (whose chunks may span several documents); may be left null for a
    # scope="document" turn since the parent turn's own document_id already identifies it
    # (019-metrics-dashboard data-model.md).
    document_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    turn: Mapped["ConversationTurn"] = relationship(back_populates="chunks")


class TurnQualityScore(Base):
    """Automatically computed LLM-as-judge quality scores for one answered `ConversationTurn`
    (019-metrics-dashboard research.md §6). Row absence means "not yet scored" — distinct from
    a genuine 0.0 score — since scoring runs asynchronously in the background and can also fail
    without blocking the turn itself.
    """

    __tablename__ = "turn_quality_scores"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    turn_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversation_turns.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    context_precision: Mapped[float] = mapped_column(Float, nullable=False)
    context_recall: Mapped[float] = mapped_column(Float, nullable=False)
    response_relevancy: Mapped[float] = mapped_column(Float, nullable=False)
    faithfulness: Mapped[float] = mapped_column(Float, nullable=False)
    # Registry key of the EvaluationJudge that produced this score (mirrors Chunk.strategy /
    # Embedding.model storing registry keys rather than a display name).
    judge: Mapped[str] = mapped_column(String, nullable=False)
    # The actual model name the judge's provider returned (e.g. "claude-sonnet-5") — distinct
    # from `judge` (the registry key), exactly mirroring ConversationTurn's existing
    # llm_provider/llm_model split (020-metrics-stage-groups research.md §1).
    judge_model: Mapped[str] = mapped_column(String, nullable=False)
    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    turn: Mapped["ConversationTurn"] = relationship(back_populates="quality_score")
