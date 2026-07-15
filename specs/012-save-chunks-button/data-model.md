# Phase 1 Data Model: Explicit Save Chunks to Database

No schema change / migration is introduced by this feature. The persisted `Chunk` entity
(`backend/app/db/models.py::Chunk`, table `chunks`) already has every column this feature needs —
this document describes how the existing entity's *write* semantics change, plus the new transient
(non-persisted) preview/save-state values the frontend tracks.

## Chunk (persisted — existing entity, unchanged schema)

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Unchanged. |
| `document_id` | UUID (FK → `documents.id`, cascade delete) | Unchanged. |
| `index` | integer | Unchanged. Unique per `(document_id, index)`. |
| `content` | text | Unchanged. |
| `strategy` | string | Unchanged — e.g. `"fixed-size"`. |
| `chunk_size` | integer | Unchanged. |
| `overlap` | integer | Unchanged. |

**Write semantics (changed by this feature)**:
- **Before**: a row-set for a document was fully replaced (delete-then-insert) on every successful
  `GET /api/chunking/run/stream` run (preview and persist were the same action).
- **After**: a row-set for a document is fully replaced **only** by a successful
  `POST /api/chunking/save` call (spec FR-002, FR-005). `GET /api/chunking/run/stream` no longer
  writes to this table at all (spec FR-001, FR-006).

**Validation rules**: unchanged — `resolve_run()`'s existing checks (`chunkSize > 0`,
`0 <= overlap < chunkSize`, `strategy` registered, `document` exists) gate both the preview stream
and the new save call before either runs.

**Relationships**: unchanged — one `Document` has many `Chunk` rows; deleting a `Document` cascades
to its `Chunk` rows (existing FK `ondelete="CASCADE"`).

## ChunkingResult / ChunkRunResponse (transient — existing shape, reused by both endpoints)

| Field | Type | Notes |
|---|---|---|
| `chunks` | `Chunk[]` (index + content only) | Unchanged — capped at `MAX_CHUNKS` (200) entries, same cap applied to what gets persisted (spec Edge Cases, Assumptions). |
| `totalChunks` | integer | Unchanged — full computed count, independent of the display/persist cap. |
| `strategy` | `"fixed-size"` | Unchanged. |
| `chunkSize` | integer | Unchanged. |
| `overlap` | integer | Unchanged. |

`POST /api/chunking/save`'s success response reuses this exact shape (see
`contracts/chunking-save-api.md`) so the frontend does not need a second response type for
"preview result" vs. "saved result" — they are structurally identical, only produced by different
endpoints with different persistence side effects.

## Run Identity / Saved Run Id (new — transient, frontend-only, not persisted)

Tracks whether the currently displayed preview is the specific run that was saved, without a
network round trip (research.md §4, revised after implementation — see note below).

| Field | Type | Notes |
|---|---|---|
| `currentRunId` | integer | Incremented every time `run()` is called; identifies *this specific* preview, not just its parameters. |
| `savedRunId` | integer \| `null` | Set to the `currentRunId` value at the moment a `POST /api/chunking/save` call succeeds. |

**State transitions**:
- `currentRunId` starts at `0` and `savedRunId` starts `null` for a freshly mounted hook instance.
- `currentRunId` increments on every `run()` call, regardless of its parameters.
- `savedRunId` is set to the in-flight `currentRunId` immediately after a successful
  `POST /api/chunking/save` response.
- A preview is considered **"saved"** in the UI (spec User Story 3) iff `status === 'success'` and
  `savedRunId === currentRunId`; otherwise it is **"unsaved"**.

**Revision note**: the original design (see research.md §4) compared run *parameters*
(`documentId`/`chunkSize`/`overlap`) instead of run *identity*, reasoning that deterministic
chunking makes parameter equality a valid proxy for "this preview matches what's saved." That
design failed spec User Story 3's Acceptance Scenario 2 (re-running with identical settings must
still show "unsaved") during implementation's TDD cycle, and was replaced with run-identity
tracking, which the failing test caught before merge.

## Move-to-Embeddings Gate (changed — existing `hasSucceededOnce` latch repurposed)

| Before this feature | After this feature |
|---|---|
| Latches `true` on the first successful **preview** (`run()` success) for the session, per `useFixedSizeChunking.ts`. | Latches `true` on the first successful **save** (`POST /api/chunking/save` success) for the currently active document (research.md §6). |

No new persisted entity — this is derived UI state in `useFixedSizeChunking`, same one-way-latch
shape as before, just re-keyed to the save event instead of the preview event.
