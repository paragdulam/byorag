# Phase 1 Data Model: Functional Chunk Overlap Controls

No database is introduced (unchanged from `005-fixed-size-chunking`/`006-chunking-embeddings-redesign`).
This feature extends the existing transient `ChunkingResult` produced per streaming chunking run
with an `overlap` field, and adds `overlap` as an input alongside the existing `documentId`/
`chunkSize` inputs. Nothing here is persisted.

## Overlap (new input value)

A user-configured amount, expressed in the same approximate-token (whitespace-word) unit as
`chunkSize`, specifying how much trailing content from one chunk is repeated at the start of the
next chunk during a chunking run (spec Key Entities).

| Field | Type | Notes |
|---|---|---|
| `overlap` | integer | `0` means no shared content between adjacent chunks (identical to pre-feature behavior). Must satisfy `0 <= overlap < chunkSize` for a run to be allowed. |

**Validation rules**:
- `overlap >= 0` (the existing 0–200 slider range already guarantees this client-side; enforced
  again server-side).
- `overlap < chunkSize` — required so the chunking stride (`chunkSize - overlap`) stays positive
  (research.md §2). Violating this blocks the run with a validation error, both client-side
  (spec FR-008) and server-side (defense in depth, research.md §2).

**Relationship to existing entities**: Not a standalone persisted entity — it is a parameter of one
`ChunkingResult` run, alongside `documentId` and `chunkSize`, and is echoed back on the result for
traceability (see below).

## ChunkingResult (extends the entity defined in `005-fixed-size-chunking`)

| Field | Type | Notes |
|---|---|---|
| `chunks` | `Chunk[]` | Unchanged — at most 200 entries (FR-007a from `005`). |
| `totalChunks` | integer | Unchanged field, new meaning when `overlap > 0`: reflects the larger chunk count produced by the smaller stride (research.md §1). This is the same figure surfaced below the Overlap slider (spec FR-003) — no new count is introduced (research.md §4). |
| `strategy` | `"fixed-size"` | Unchanged. |
| `chunkSize` | integer | Unchanged. |
| `overlap` | integer | **New.** Echoes the overlap value used to produce this result, mirroring how `chunkSize` is already echoed, for reproducibility (constitution Principle V). |

**Validation rules** (in addition to `005`'s existing rules):
- `overlap` on a `ChunkingResult` always satisfies `0 <= overlap < chunkSize` for that same result
  (a result is never produced for an invalid combination — the run is blocked before it starts).

**State transitions**: Unchanged — still a transient response value, entirely replaced by the next
run; nothing carries over between runs.

## ChunkingStrategy (backend-internal interface, extends `005`'s entry)

| Aspect | Shape |
|---|---|
| Interface | `(text: str, chunk_size: int, overlap: int = 0) -> list[str]` — `overlap` added with a default so existing/future strategies that ignore it remain valid (constitution Principle I). |
| Registered today | Only `"fixed-size"` implements overlapping behavior; the default keeps the protocol backward-compatible. |

## Updated frontend types (`frontend/src/types/chunking.ts`)

```ts
export interface ChunkingResult {
  chunks: Chunk[]
  totalChunks: number
  strategy: 'fixed-size'
  chunkSize: number
  overlap: number   // new
}
```

`Chunk`, `ChunkRunResponse`, `SourceDocument`, `UploadRejection`, `DeletionResult`, and
`SystemCapacity` types are unchanged.
