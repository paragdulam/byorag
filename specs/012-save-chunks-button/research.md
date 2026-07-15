# Phase 0 Research: Explicit Save Chunks to Database

No open `NEEDS CLARIFICATION` markers remain from the spec or Technical Context — this feature
is scoped entirely within the existing `chunking` vertical slice, whose conventions (streaming
preview endpoint, `Chunk` DB model, strategy registry) are already established by
`005-fixed-size-chunking`, `006-chunking-embeddings-redesign`, `007-chunking-overlap-controls`,
and `008-corpora-management`. This document records the design decisions made while turning the
spec into a concrete plan.

## 1. How does "Save Chunks" get the chunk content to persist?

**Decision**: The save endpoint takes only `documentId`, `chunkSize`, and `overlap` (strategy is
still implicitly `"fixed-size"`, matching the existing `/run/stream` endpoint), and **recomputes**
the chunking result server-side from the document's stored text — it does not accept a
client-supplied chunk list.

**Rationale**: Fixed-size chunking is a pure function of `(document text, chunk_size, overlap)`.
Recomputing guarantees the persisted rows are always derived from the document itself, never from
arbitrary client input — avoiding a class of bugs/abuse where a client could persist fabricated
`content` unrelated to the actual PDF. It also keeps the request payload tiny (three scalars)
instead of re-uploading potentially hundreds of chunk strings that the server already produced
once during the preview.

**Alternatives considered**:
- *Client sends back the exact chunk list it received from `/run/stream`*: rejected — trusts
  client-supplied text as document content, and duplicates the (larger) payload for no benefit
  since recomputation is cheap and deterministic.
- *Server caches the last preview's chunks per document/session and "save" just flips a flag*:
  rejected — adds server-side session/cache state for a single-user local tool (violates
  Principle III's YAGNI guidance) and would break across page reloads/multiple tabs.

## 2. Save endpoint shape

**Decision**: `POST /api/chunking/save` with a JSON body `{ documentId, chunkSize, overlap }`,
returning the same `ChunkRunResponse` shape (`extractionFailed`, `result`) that `/run/stream`'s
terminal event already returns. Non-streaming (single response), since no progress reporting is
needed for a save the user already watched compute once during preview.

**Rationale**: Matches this codebase's existing convention of query-string GET for the
SSE-streaming endpoint but JSON-body POST for other chunking-adjacent mutations
(`backend/app/sources/router.py`'s `POST /api/sources/delete` takes a JSON body). Reusing
`ChunkRunResponse` avoids introducing a parallel response shape the frontend has to special-case.

**Alternatives considered**:
- *GET with query params, mirroring `/run/stream`*: rejected — this is a mutating (persisting)
  request, so POST is the correct HTTP semantic, and there's no need for `EventSource` (which
  requires GET) since no streaming/progress is involved.

## 3. Sharing logic between preview and save without duplicating extraction/chunking code

**Decision**: Factor the "extract full document text" step (currently inlined at the top of
`stream_chunking`) into a small reusable step, and add a new `save_chunks()` function in
`backend/app/chunking/service.py` that: extracts text, runs the same `strategy_impl.chunk(...)`
call, caps to `MAX_CHUNKS`, and calls the existing `_persist_chunks()` helper (unchanged) — then
returns a `ChunkRunResponse`. `stream_chunking()` keeps its per-page progress-yielding shape for
the preview path but **stops calling `_persist_chunks()`** at the end.

**Rationale**: `_persist_chunks()` (delete-then-insert, single transaction, "full replace" —
already documented in the existing code's docstring) is exactly the persistence semantics FR-005/
FR-006 need and is already correct; it just needs to be called from one new place instead of every
preview run. `resolve_run()` (validation + document lookup) is already shared and reused as-is by
both the stream and save endpoints.

**Alternatives considered**:
- *Give `stream_chunking` a `persist: bool` flag*: rejected — conflates a streaming/progress-shaped
  generator with a plain persist call, and keeps a live footgun where a future caller could
  accidentally pass `persist=True` on a preview path. Two small, single-purpose functions are
  clearer and match constitution Principle I's preference for explicit, non-branching flows.

## 4. How the frontend knows "is the current preview saved?"

**Decision**: Track **run identity**, not run parameters, in the `useFixedSizeChunking` hook — a
monotonically increasing `currentRunId` incremented on every `run()` call, and a `savedRunId` set
to the id of whichever run a successful `save()` most recently persisted. `isSaved` is
`status === 'success' && savedRunId === currentRunId`.

**Rationale**: The spec's User Story 3, Acceptance Scenario 2 explicitly requires that re-running
"Re-Calculate Chunks" with the *same* chunk size/overlap as the last save still shows "unsaved" —
the state reflects "was this specific result explicitly saved," not "would saving now reproduce
identical bytes." An initial implementation compared `(documentId, chunkSize, overlap)` parameter
equality instead (reasoning that chunking is deterministic, so matching params prove the preview
matches what's persisted); that failed exactly this acceptance scenario, since two different runs
with identical parameters are still two different, independently-savable actions from the user's
point of view. Run-identity tracking is what the spec actually asks for and is equally cheap — no
new backend endpoint, no content diffing, no DB round-trip.

**Alternatives considered**:
- *Parameter-equality signature (`documentId + chunkSize + overlap + strategy`)*: tried first,
  rejected — deterministic chunking makes it *correct* about content equality, but the spec cares
  about "was this result the one that got saved," not content equality, so it fails Acceptance
  Scenario 2 above.
- *Fetch saved-chunk metadata from the DB on load/after every action to compare*: rejected as
  unnecessary round-trips — the signature the frontend already holds locally (from its own last
  successful save response) is sufficient and simpler, consistent with Principle III.

## 5. Preventing duplicate/corrupted rows on rapid double-save (FR-009)

**Decision**: Disable the "Save Chunks" button client-side while a save request is in flight
(mirroring the existing pattern where "Re-Calculate Chunks" is disabled while `status === 'running'`).
Server-side, rely on the existing `_persist_chunks()` transaction (delete + insert, single commit)
which is already atomic per request — two sequential save requests for the same document simply
result in the second's delete-then-insert superseding the first's, never a partial or duplicated
state.

**Rationale**: For a single local user, client-side disabling removes the realistic trigger for
overlapping requests; the existing atomic replace transaction already makes any residual race safe
(worst case: last-write-wins, no duplicate rows, no partial rows) without adding locking
infrastructure, consistent with Principle III (YAGNI).

**Alternatives considered**:
- *Add a DB-level advisory lock or request de-duplication token*: rejected as unnecessary
  complexity for a single-user local tool with no realistic concurrent-write scenario.

## 6. "Move to Embeddings" gating

**Decision** (already recorded as an assumption in the spec): the button that navigates to the
Embeddings screen is enabled only after at least one successful **save** for the currently active
document, not merely a successful preview. The existing `hasSucceededOnce` latch in
`useFixedSizeChunking` is renamed/repurposed to track "has saved at least once for the current
document" instead of "has previewed at least once."

**Rationale**: Embeddings must be generated from durable, queryable chunk rows (Qdrant/embedding
pipeline reads persisted chunks, not an in-memory preview state that vanishes on navigation/reload).
Gating on preview alone would let a user proceed to Embeddings with nothing in the database for
that document's current settings.
