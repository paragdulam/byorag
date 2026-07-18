# Contract: "Entire Corpus" Client-Side Batch Orchestration

This is not an HTTP API contract — per `/speckit-clarify`, "Entire Corpus" chunking and embedding
introduce **no new backend endpoints**. This document instead pins down the client-side contract
that `useFixedSizeChunking` and `useChunkEmbeddings` both implement via the shared
`runSequentialBatch()` helper (`frontend/src/lib/batchRunner.ts`, research.md §2), so the two
screens behave identically and any future screen adding an "Entire Corpus" mode reuses the same
rules rather than inventing new ones.

## Inputs

- `documents: SourceDocument[]` — the active corpus's document list, in the same order the
  screen's existing `documents` state already provides (i.e., whatever order
  `GET /api/sources?corpusId=...` returns).
- `runOne: (doc: SourceDocument) => Promise<TResult>` — wraps **one** of the screen's existing
  single-document operations, called as its own separate batch — mirroring the screen's existing
  two-button shape (a "run"/"generate" preview action and a distinct "save" action), not a
  combined run-then-save step:
  - Chunking: `runSequentialBatch` is invoked once for "Re-Calculate Chunks" (each `runOne` calls
    `runChunkingStream` for one document — preview only) and, on a later, separate "Save Chunks"
    click, invoked again for the save (each `runOne` calls `saveChunksStream` for one document,
    using the same chunk size/overlap the corpus-wide preview used).
  - Embeddings: same shape — one batch for "Generate Embeddings" (`generateEmbeddingsStream` per
    document) and a separate batch, on "Save", for `saveEmbeddingsStream` per document, using the
    selected model.
  Each of these is already a per-document streaming call today for the single-document flow —
  `runOne` reuses it unchanged, one document at a time. Keeping run and save as two separate
  batch invocations (rather than one `runOne` doing both) matches spec User Story 1/2's
  acceptance scenarios, which describe running and saving as distinct user actions even in
  "Entire Corpus" mode.
- `onProgress: (progress: BatchProgress) => void` — called immediately before each document
  starts, and again as that document's own real progress updates (data-model.md).

## Sequencing rules

1. Documents are processed **strictly one at a time, in order** — never concurrently. (A future
   corpus could be large; unbounded concurrent requests against the same backend would be a
   scope/complexity increase this feature does not need — Constitution Principle III.)
2. If `runOne(doc)` rejects (a genuine per-document failure — e.g., extraction failure, a document
   with no saved chunks for embeddings, a network/server error), the runner **records the failure
   and continues to the next document** — it never aborts the remaining batch (FR-007, FR-021).
3. The overall combined percent shown to the user is:
   `round(((index + documentPercent / 100) / total) * 100)`, and the text is
   `"Processing document {index + 1} of {total} ({documentName})"` — the exact format resolved in
   `/speckit-clarify`.
4. When every document has been attempted (succeeded or failed), the runner resolves with a
   `BatchItemResult<TResult>[]` (data-model.md) — one entry per document, in the same order — for
   the screen to render as its post-run summary (research.md §3) and to drive the "Save"/"Move to
   Embeddings"/"Move to Vector View" downstream buttons' `hasSavedOnce`-style gating exactly as a
   single successful save does today.

## What does *not* change

- No new request/response shape on any existing endpoint used by `runOne` (the per-document
  chunking/embedding run and save calls are used exactly as today's single-document flow uses
  them — see `contracts/chunking-save-stream-api.md` for the one save-endpoint shape change,
  which applies identically whether triggered for one document or as part of a batch).
- No new persisted "batch" or "job" entity, status, or history — a batch run's only durable trace
  is the same per-document `Chunk`/`Embedding` rows an individual run would have left, for exactly
  the documents that succeeded.
- Navigating away or switching the active corpus mid-batch is not specially handled beyond what
  already happens today when a single-document run/save is interrupted by navigation — in-flight
  requests are simply abandoned client-side; documents already persisted before the interruption
  keep their saved chunks/embeddings (matches spec Edge Cases).
