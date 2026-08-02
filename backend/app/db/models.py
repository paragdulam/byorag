import uuid
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
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


class User(Base):
    """A person who can log in (024-user-authentication). Every `Corpus`/`Document`
    row's ownership traces back to a `User.id`."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )


class Session(Base):
    """One logged-in session (024-user-authentication data-model.md). `token` is the
    opaque bearer credential returned to the client at signup/login; `revoked_at` is
    null while the session is still active. No `expires_at` — sessions persist until
    explicit logout (FR-004)."""

    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship()


class UserAnthropicKey(Base):
    """A user's personal Anthropic API key (025-user-profile-anthropic-key data-model.md).
    At most one per user — `user_id` is unique, so adding/updating is always an upsert of
    this single row, never a second one. `encrypted_key` holds `Fernet` ciphertext
    (`app/profile/service.py`), reversible (unlike `User.password_hash`) since the
    plaintext key must be recoverable to call Anthropic on the user's behalf.
    `last_four` exists purely so the UI can show a masked form without ever decrypting
    the key just to display it."""

    __tablename__ = "user_anthropic_keys"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    encrypted_key: Mapped[str] = mapped_column(Text, nullable=False)
    last_four: Mapped[str] = mapped_column(String(4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )


class Corpus(Base):
    __tablename__ = "corpora"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_corpus_user_name"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    # Nullable only to tolerate rows that predate this feature — claimed by the first
    # signup's backfill (024-user-authentication research.md §2-3). Every application-level
    # read/write treats a null user_id as inaccessible.
    user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    document_links: Mapped[list["DocumentCorpus"]] = relationship(
        back_populates="corpus", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        UniqueConstraint("user_id", "content_hash", name="uq_document_user_content_hash"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    # Denormalized owner, set once at upload time — kept alongside the corpus's own
    # user_id so per-user queries never need to join through document_corpora/corpora to
    # find the owner (024-user-authentication research.md §7). Nullable for the same
    # pre-existing-row reason as Corpus.user_id.
    user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Content-based dedup (FR-005) is scoped per user, not global — two different users
    # uploading identical bytes each get their own private Document row (corpora/documents
    # are strictly private, 024-user-authentication spec.md Clarifications).
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
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


class GoldenDatasetEntry(Base):
    """A reference record — question + preferred answer + evidence chunks — for evaluating
    the RAG pipeline (027-golden-dataset). Scoped to a corpus, and optionally to one specific
    document within it. `source` distinguishes manual (SME-authored, always created as
    "approved") from `llm_generated` (always created as "pending_review" — FR-011, never
    usable until a human explicitly approves it, data-model.md's state diagram). `status` can
    move freely between all three values via the shared editor — rejection is not terminal
    (FR-013a).

    `document_id`/`corpus_id` both use `ondelete="CASCADE"` — a deliberate departure from
    `ConversationTurnChunk`'s softer `SET NULL` pattern below, since spec FR-019 requires
    golden entries to be deleted (not orphaned) when their source document is removed
    (research.md §6).
    """

    __tablename__ = "golden_dataset_entries"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    corpus_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("corpora.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    preferred_answer: Mapped[str] = mapped_column(Text, nullable=False)
    # "manual" | "llm_generated" — plain string, validated at the service layer, matching this
    # codebase's existing convention for such fields (e.g. ConversationTurn.scope) rather than
    # a native Postgres enum.
    source: Mapped[str] = mapped_column(String, nullable=False)
    # "approved" | "pending_review" | "rejected"
    status: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )
    # Set the first time status leaves "pending_review" (approved or rejected); left null for
    # entries that were manual from the start, since they were never reviewed in that sense.
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    chunks: Mapped[list["GoldenDatasetEntryChunk"]] = relationship(
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="GoldenDatasetEntryChunk.position",
    )


class GoldenDatasetEntryChunk(Base):
    """A snapshot of one evidence chunk selected for a `GoldenDatasetEntry` (027-golden-dataset
    data-model.md) — mirrors `ConversationTurnChunk`'s field split (hard FK to parent /
    soft-linkable source ref / snapshot content / display order), but `entry_id` cascades a
    delete of its own snapshot rows, and the entry's `document_id`/`corpus_id` cascade instead
    of soft-linking (see `GoldenDatasetEntry`'s docstring). `content`/`chunk_index` are the
    durable evidence itself, spec FR-016 — they survive a later re-chunk of the document even
    though `chunk_id` (kept only as a best-effort live link) is nulled out by that same
    re-chunk, exactly like `ConversationTurnChunk.chunk_id`.
    """

    __tablename__ = "golden_dataset_entry_chunks"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_new_uuid)
    entry_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("golden_dataset_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False), ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True
    )
    # Snapshot of which document this evidence came from — no FK (pure snapshot column, same
    # as ConversationTurnChunk.document_id); populated for corpus-scoped entries, informational
    # for document-scoped ones since the parent entry's own document_id already identifies it.
    document_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    # Snapshot of the chunk's position at selection time — informational only, never used to
    # re-identify the chunk after a re-chunk (content is what's authoritative, FR-016).
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # Stable display order among an entry's evidence chunks (insertion order) — no
    # scoring/ranking connotation, unlike ConversationTurnChunk.rank.
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    entry: Mapped["GoldenDatasetEntry"] = relationship(back_populates="chunks")


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
