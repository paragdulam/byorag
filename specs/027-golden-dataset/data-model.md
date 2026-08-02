# Data Model: Golden Dataset Creation (Manual & LLM-Generated)

Two new tables, added as new SQLAlchemy model classes in `backend/app/db/models.py`. No migration
script is needed — `Base.metadata.create_all` (called on every backend startup) only ever creates
missing tables, and neither new table alters an existing one (research.md's DB-migration note).

## GoldenDatasetEntry

Maps to spec's **Golden Dataset Entry** entity.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | `default=_new_uuid`, matching every other table's PK convention |
| `user_id` | UUID, FK → `users.id`, `ondelete="CASCADE"` | Owner; deleting a user deletes their golden entries, consistent with every other owned entity |
| `corpus_id` | UUID, FK → `corpora.id`, `ondelete="CASCADE"` | Always set — every entry belongs to a corpus (spec: "scoped per corpus") |
| `document_id` | UUID, FK → `documents.id`, `ondelete="CASCADE"`, nullable | Set when the entry is scoped to one specific document; null for corpus-wide entries (research.md §6) |
| `question` | Text, not null | |
| `preferred_answer` | Text, not null | One answer per entry (spec Assumptions — no variants) |
| `source` | String, not null | `"manual"` \| `"llm_generated"` (FR-014). Plain string column with app-level validation, not a native Postgres enum — matches this codebase's existing convention (e.g. `ConversationTurn.scope`) of validating such fields at the service layer rather than the database, so adding a future value never needs an `ALTER TYPE` |
| `status` | String, not null | `"approved"` \| `"pending_review"` \| `"rejected"` (FR-014), same plain-string convention |
| `created_at` | DateTime (tz-aware), not null | |
| `updated_at` | DateTime (tz-aware), not null | Bumped on any edit (FR-017) or status change |
| `reviewed_at` | DateTime (tz-aware), nullable | Set the first time status leaves `pending_review` (approved or rejected); left null for entries that were manual from the start, since they were never reviewed in that sense |

**Relationships**: `chunks: list[GoldenDatasetEntryChunk]`, `cascade="all, delete-orphan"`,
`order_by="GoldenDatasetEntryChunk.position"` — same relationship shape as
`ConversationTurn.chunks`.

**Validation rules** (service-layer, not DB constraints — matching this codebase's convention):
- FR-002/FR-018: a status of `"approved"` requires at least one associated `GoldenDatasetEntryChunk`
  — enforced in the service function that handles save/approve, not a DB-level check, consistent
  with how e.g. `scope` exclusivity is enforced in `playground/service.py` rather than a CHECK
  constraint.
- Exactly one of `document_id` present or absent per the entry's chosen scope at creation time —
  not mutually validated against anything else (a document-scoped entry's `document_id` must
  belong to the same `corpus_id`, checked at creation).

**State transitions** (FR-011, FR-012, FR-013, FR-013a):

```text
        (manual creation)
              │
              ▼
          approved ◄────────┐
              ▲              │
              │  edit+approve│  edit+approve
              │              │
   (LLM gen)  │         reopen│
              ▼              │
       pending_review ──────►│
              │              │
              │ reject        │
              ▼              │
          rejected ──────────┘
                  (reopen → pending_review or approved)
```

Manual creation enters directly at `approved` (FR-008). LLM generation enters at `pending_review`
(FR-011) and can only reach `approved` via an explicit action (FR-011, never automatically).
`rejected` is not terminal (Clarifications, 2026-08-01 / FR-013a) — it can move back to
`pending_review` or straight to `approved` via the same shared editor.

## GoldenDatasetEntryChunk

Maps to spec's **Evidence Chunk Snapshot** entity. Deliberately mirrors `ConversationTurnChunk`'s
existing 4-tier field split (hard FK to parent / soft-linkable source ref / snapshot content /
display order) — see research.md §6 for why this one differs from that precedent on cascade
behavior.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `entry_id` | UUID, FK → `golden_dataset_entries.id`, `ondelete="CASCADE"`, not null | Join-record parent; dies with the entry |
| `chunk_id` | UUID, FK → `chunks.id`, `ondelete="SET NULL"`, nullable | Best-effort live link back to the source chunk, if it still exists — not the source of truth (research.md §2, §6) |
| `document_id` | UUID, no FK, nullable | Plain snapshot column (which document this evidence came from), same as `ConversationTurnChunk.document_id` — populated for corpus-scoped entries, informational for document-scoped ones since the parent entry's own `document_id` already identifies it |
| `chunk_index` | Integer, not null | Snapshot of the chunk's position *at selection time* — informational only; never used to re-identify the chunk after a re-chunk (spec explicitly requires content-based, not index-based, matching) |
| `content` | Text, not null | The durable evidence text itself — the actual ground truth (FR-016) |
| `position` | Integer, not null | Stable display order among an entry's evidence chunks (insertion order); no scoring/ranking connotation, unlike `ConversationTurnChunk.rank` |

**Relationships**: `entry: GoldenDatasetEntry`, `back_populates="chunks"`.

**Not persisted** (research.md §2 — deliberately excluded as speculative for this version):
question/answer embeddings, and which search(es) a chunk matched during candidate selection
(`matched_via`) — both are transient, request/response-only data used while building or editing an
entry, not stored once chunks are selected.

## Candidate search response shape (not a stored entity)

Returned by `POST /api/golden-dataset/candidates` (contracts/), never persisted:

| Field | Type | Notes |
|---|---|---|
| `chunkId` | string | |
| `documentId` | string | |
| `chunkIndex` | integer | |
| `content` | string | |
| `matchedQuestion` | boolean | This chunk appeared in the question-text search results |
| `matchedAnswer` | boolean | This chunk appeared in the answer-text search results (false if no answer text was provided yet) |
| `rrfScore` | number | Combined Reciprocal Rank Fusion score, for ordering only — not persisted, not shown as a raw number to the user (the badge is derived from `matchedQuestion`/`matchedAnswer`, per FR-004) |
