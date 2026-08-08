# Phase 1 Data Model: UI/UX Polish Across Corpora, Sources, Chunking, Embeddings, Vector View, and Playground

Only one entity's *relationships* actually change (Document ↔ Corpus). Everything else in this
feature either reuses existing entities unchanged or introduces a purely client-side, unpersisted
concept (Answer Citation).

## Document (changed)

| Field | Type | Change |
|---|---|---|
| `corpus_id` | UUID, required, FK → `corpora.id` (`ondelete="RESTRICT"`) | **New.** Replaces the `document_corpora` many-to-many join table — a document now belongs to exactly one corpus, set at upload time and immutable thereafter (no "move to another corpus" feature is introduced by this change). |
| `content_hash` uniqueness | `UNIQUE(user_id, corpus_id, content_hash)` | **Changed** from `UNIQUE(user_id, content_hash)` — dedup now scoped per corpus, not per user, so the same PDF can be uploaded into two different corpora as two independent rows. |

Everything else on `Document` (id, name, content, size_bytes, status, uploaded_at, and its
`chunks`/`conversation_turns` cascade relationships) is unchanged.

**Migration** (idempotent, run via the existing `ensure_schema_migrations()` startup hook):

1. `ALTER TABLE documents ADD COLUMN IF NOT EXISTS corpus_id UUID`.
2. Backfill: for each `document_id` in `document_corpora`, set `documents.corpus_id` to the
   `corpus_id` of its **earliest** association (`MIN(added_at)`, tie-broken by `corpus_id`) —
   guarded so re-running the migration is a no-op for rows that already have `corpus_id` set.
3. `ALTER TABLE documents ALTER COLUMN corpus_id SET NOT NULL` (only once every row is
   backfilled) and add the FK constraint (`ondelete="RESTRICT"`, matching today's
   `document_corpora.corpus_id` behavior — a corpus with any documents still can't be deleted).
4. Drop the old `uq_document_user_content_hash` constraint, add
   `uq_document_user_corpus_content_hash` on `(user_id, corpus_id, content_hash)`.
5. Drop the `document_corpora` table.

**Validation rules**: A document's `corpus_id` is set once, at upload time, from the corpus the
upload targeted, and never changes. There is no "reassign to a different corpus" operation.

## Corpus (unchanged)

No schema change. Deletion remains blocked while it has any documents (`RESTRICT`, now via
`documents.corpus_id` instead of `document_corpora.corpus_id`) — satisfied by deleting every
document first, which the new per-document delete action makes directly possible without the
old "unlink" detour.

## Chunk / Retrieved Chunk (unchanged)

No schema change. Fixed Size Chunking's `Chunk` (positional, no stable id — `{index, content}`)
and Playground's `TurnChunk` (`{chunkId, documentId, index, content, score}`) are exactly as
they are today; this feature only adds UI that *displays* fields (a shareable link for the
former, the already-present `score` for the latter) that weren't surfaced before.

## Answer Citation (new — not persisted)

A purely client-side, derived concept: an association between a segment of a turn's `answer`
text and the specific retrieved chunk(s) that informed it.

| Field | Type | Notes |
|---|---|---|
| `marker` | `number` | The 1-based ordinal parsed from an inline `[N]` marker in `answer`. |
| `chunk` | `TurnChunk` | Resolved as `turn.chunks[marker - 1]` at render time. |

**Lifecycle**: Produced implicitly every time a turn with an `answer` containing `[N]` markers is
rendered — parsed fresh from `turn.answer` (already sent to the client) and `turn.chunks`
(already sent to the client). Nothing new is fetched, stored, or persisted; there is no
citations table, no new API field, and no new response shape. If `marker` doesn't resolve to a
valid index in `turn.chunks` (e.g. the model mis-cites), that specific marker renders as plain
text with no info icon rather than erroring, per spec Edge Cases.
