# Data Model: Playground Split-Screen Chat Interface

Two new tables, created via the existing `Base.metadata.create_all(engine)` startup path (this
project has no Alembic/migration tooling). No changes to `documents`, `chunks`, or `embeddings`
(013-bert-pgvector-embeddings).

## `ConversationTurn` (table: `conversation_turns`)

One row per question the user submits — created by `POST /api/playground/turns`, mutated in place
by `POST /api/playground/turns/{id}/generate` (never a separate "answer" table — a turn's
generation record lives on the turn itself, per research.md Decision 5).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | `_new_uuid()` default, matching every other table in this project. |
| `document_id` | UUID, FK → `documents.id`, `ondelete=CASCADE`, indexed | Which document's conversation this turn belongs to (spec: "conversations are scoped per document"). |
| `question` | Text, not null | The user's submitted question, as typed. |
| `embedding_model` | String, not null | The registered embedding-model key (e.g. `"bert"`) the query was embedded with — same value as `Embedding.model`, needed to interpret `query_embedding`'s vector space. |
| `query_embedding` | `Vector(EMBEDDING_DIMENSIONS)`, not null | The embedding generated for `question` (reuses the existing `EMBEDDING_DIMENSIONS` constant from `db/models.py`). |
| `llm_provider` | String, nullable | The `GENERATION_PROVIDERS` registry key used (e.g. `"anthropic"`). Null until Generate has been attempted at least once. |
| `llm_model` | String, nullable | The specific model id the provider used (e.g. the configured `ANTHROPIC_MODEL`). Null until Generate succeeds. |
| `prompt` | Text, nullable | The exact prompt sent to the LLM (research.md Decision 5). Set on every generate attempt (success or failure), so a failed attempt's prompt is still inspectable. |
| `answer` | Text, nullable | The LLM's response. Null until generation succeeds; remains null (not partially filled) if generation fails (FR-014). |
| `error` | Text, nullable | The last generation failure's message, if any. Cleared (`null`) on a successful generate. |
| `created_at` | DateTime (tz-aware), not null | When the turn (question + retrieval) was created — the ordering key for FR-017's reload and FR-009's chronological display. |
| `answered_at` | DateTime (tz-aware), nullable | When generation last succeeded. Null if never successfully generated. |

**Status** is derived, not stored as a separate column, to avoid a second source of truth:
- No `chunks` rows at all → retrieval found nothing (Generate unavailable, FR-015).
- `answer is null and error is null` → retrieved, not yet generated (an "unanswered turn," per
  spec Assumptions).
- `answer is null and error is not null` → last generate attempt failed (retry available, FR-014).
- `answer is not null` → answered (`error` is always `null` in this state — a fresh success clears
  any prior error).

**Indices**: `(document_id, created_at)` — the access pattern for FR-017's per-document,
chronological reload.

## `ConversationTurnChunk` (table: `conversation_turn_chunks`)

One row per chunk retrieved for a turn (up to 5, per the existing `TOP_K` from 016) — a snapshot,
not a live view (research.md Decision 1).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | `_new_uuid()` default. |
| `turn_id` | UUID, FK → `conversation_turns.id`, `ondelete=CASCADE`, indexed | Deleting a turn removes its chunk snapshots; turns themselves are never deleted by any requirement in this feature. |
| `chunk_id` | UUID, FK → `chunks.id`, nullable, `ondelete=SET NULL` | Best-effort live link, e.g. for a future "jump to this chunk" action. Not required to render a past turn — see `chunk_index`/`content` below. |
| `embedding_id` | UUID, FK → `embeddings.id`, nullable, `ondelete=SET NULL` | Best-effort link to the specific saved `Embedding` row that matched (016's dedup rule — the chunk's single best-scoring saved embedding). |
| `chunk_index` | Integer, not null | Snapshot of the chunk's `index` within its document at retrieval time (display: "CHUNK_3"). |
| `content` | Text, not null | Snapshot of the chunk's `content` at retrieval time — the source of truth for the "Show more" full-content view (FR-005), immune to later re-chunking. |
| `score` | Float, not null | Cosine similarity score at retrieval time (same computation as 016's `SimilarityResultOut.score`). |
| `rank` | Integer, not null | 1-based position in this turn's ranked result list; also the row's display order. |

**Indices**: `(turn_id, rank)` — the access pattern for rendering a turn's chunk list in order.

## Relationships

```
Document (1) ──── (many) ConversationTurn ──── (many) ConversationTurnChunk
                          │                              │  (best-effort, nullable)
                          │                              ├──→ Chunk
                          │                              └──→ Embedding
                          │
                     GENERATION_PROVIDERS lookup (llm_provider) — not a DB relationship;
                     a code-level registry key (research.md Decision 3)
```

- `ConversationTurn.document_id` → `Document.id`: many turns per document, each document's
  conversation independent of every other's (spec Assumptions: "conversations are scoped per
  document").
- `ConversationTurnChunk.turn_id` → `ConversationTurn.id`: exactly one turn owns each chunk
  snapshot; a turn has 0–5 chunk snapshots (0 only when the document had no retrievable saved
  embeddings at all — FR-015's Generate-unavailable case).
- `ConversationTurnChunk.chunk_id` / `.embedding_id` are informational best-effort references only,
  per research.md Decision 1 — never required for correctness of what's displayed.

## Validation rules carried over from requirements

- A `ConversationTurn` is only ever created after a non-empty, within-length query (FR-011,
  reusing 016's existing `EmptyQueryError`/`QueryTooLongError` validation in
  `app/playground/service.py`) against a document with at least one saved embedding for the
  requested model (016's `NoSavedEmbeddingsError`).
- `POST /turns/{id}/generate` is only meaningful when the turn has ≥1 `ConversationTurnChunk`
  (FR-015); the service rejects generate attempts on a turn with zero retrieved chunks.
- `answer` and `error` are mutually exclusive at any point in time: a successful generate sets
  `answer` and clears `error`; a failed generate sets `error` and leaves `answer` untouched (never
  overwritten with a partial value, FR-014).
