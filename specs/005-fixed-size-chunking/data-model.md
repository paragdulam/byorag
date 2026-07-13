# Phase 1 Data Model: Fixed Size Chunking Experiment

No database is introduced. Chunking is computed fresh on each request from the selected document's
bytes (read from `PDFS_DIR`, per `002-persist-pdf-sources`) and returned directly — nothing here is
persisted (research.md §7, spec Assumptions).

## Chunk

A single fixed-size piece of a document's extracted text, produced by one chunking run.

| Field | Type | Notes |
|---|---|---|
| `index` | integer | Zero-based position within the run's full (uncapped) result — stable even when the displayed list is capped at 200, so a capped chunk's position is still meaningful if this becomes relevant to a later feature. |
| `content` | string | The chunk's text content (a contiguous slice of the extracted document text, split at word boundaries per the `"fixed-size"` strategy — research.md §3). |

**Validation rules**: None from user input — `Chunk` is entirely derived output.

## ChunkingResult

The full outcome of one `POST /api/chunking/run` call.

| Field | Type | Notes |
|---|---|---|
| `chunks` | `Chunk[]` | At most 200 entries (FR-007a), even when `totalChunks` is larger. |
| `totalChunks` | integer | The true number of chunks the run produced, whether or not all of them are included in `chunks`. The frontend shows the "more exist" note (FR-007a, SC-005) whenever `totalChunks > chunks.length`. |
| `strategy` | `"fixed-size"` | Echoes which registered strategy produced this result (research.md §1) — forward-compatible field; only one value is possible today. |
| `chunkSize` | integer | Echoes the chunk size the run used, so the frontend can display it alongside the results without keeping separate client-side state in sync. |

**Validation rules**:
- `chunks.length <= 200` always.
- `totalChunks >= chunks.length` always.
- `chunks[i].index` values are contiguous starting at `0` and are unique within a result.

**State transitions**: None — `ChunkingResult` is a transient response value, entirely replaced by
the next `POST /api/chunking/run` call; nothing carries over between runs (spec Edge Cases: the
screen resets on navigation away and back).

## ChunkingStrategy (backend-internal interface, not part of the API contract)

Not a data entity exposed to the frontend — documented here because it shapes how `Chunk`/
`ChunkingResult` get produced (research.md §1).

| Aspect | Shape |
|---|---|
| Interface | A callable/protocol taking `(text: str, chunk_size: int) -> list[str]`, returning ordered chunk text pieces. |
| Registry | A name-keyed mapping (e.g., `{"fixed-size": FixedSizeStrategy()}`) the chunking service looks up by the request's `strategy` field. |
| Registered today | Only `"fixed-size"`. Requesting any other `strategy` value is rejected (contract-level validation error), not silently ignored — there is no fallback behavior masking an unsupported strategy request. |

## Relationship to existing entities

- **SourceDocument** (`002-persist-pdf-sources`): `ChunkingResult` is produced *from* one
  `SourceDocument`'s on-disk bytes, identified by the same `id` (filename) the Sources screen
  already uses — no new document-identity concept is introduced. Chunking does not modify or
  reference-count the source document in any way (spec Edge Cases: an externally-deleted document
  simply becomes unavailable in the picker on the next visit, per `004-delete-source-documents`).

## New frontend types (`frontend/src/types/chunking.ts`)

Mirrors the backend shapes above in camelCase (already camelCase in the backend schema, no
renaming needed — matching the existing convention from `sources`/`system` modules):

```ts
export interface Chunk {
  index: number
  content: string
}

export interface ChunkingResult {
  chunks: Chunk[]
  totalChunks: number
  strategy: 'fixed-size'
  chunkSize: number
}
```

No changes to `SourceDocument`, `UploadRejection`, `DeletionResult`, or `SystemCapacity` types from
prior features.
