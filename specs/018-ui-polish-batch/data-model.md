# Phase 1 Data Model: RAG Workflow Screens — UI Polish Batch

**No new or changed database tables, columns, or relationships.** `Corpus`, `Document`,
`DocumentCorpus`, `Chunk`, and `Embedding` (`backend/app/db/models.py`) are reused exactly as
established in `008-corpora-management` and `013-bert-pgvector-embeddings` — every "Entire
Corpus" feature in this batch is a client-side loop over rows those tables already return through
existing endpoints, not a new persisted concept (see research.md §1–3, §7).

The only backend wire-shape change is `POST /api/chunking/save`'s request/response envelope moving
to a streaming GET (`contracts/chunking-save-stream-api.md`); its underlying persisted rows
(`Chunk`) and their shape are unchanged.

## Frontend logical types (new, not persisted)

### `EntireCorpusSelection`

```ts
export const ENTIRE_CORPUS_SELECTION = '__entire-corpus__' as const
export type DocumentSelectionValue = string // a real Document.id, or ENTIRE_CORPUS_SELECTION
export function isEntireCorpusSelection(value: string): boolean
```

A frontend-only sentinel (`frontend/src/lib/entireCorpusSelection.ts`), never sent to the backend
as a `documentId`. Consumed by `FixedSizeChunkingScreen`, `EmbeddingsScreen`, and
`VectorViewScreen`'s document `<select>`s and their backing hooks.

### `BatchProgress` / `BatchItemResult<T>`

```ts
export interface BatchProgress {
  index: number        // 0-based position of the document currently running
  total: number        // total documents in this batch
  documentId: string
  documentName: string
  documentPercent: number   // 0-100, that one document's own real progress
}

export interface BatchItemResult<T> {
  documentId: string
  documentName: string
  status: 'success' | 'failed'
  result?: T            // present when status === 'success'
  errorMessage?: string  // present when status === 'failed'
}
```

Produced by `runSequentialBatch()` (`frontend/src/lib/batchRunner.ts`, research.md §2) and
consumed by `useFixedSizeChunking`/`useChunkEmbeddings` to drive the combined progress bar/text
and the post-run per-document summary list (research.md §3). Not persisted; exists only for the
duration of one "Entire Corpus" run in component/hook state.

### `useFixedSizeChunking` / `useChunkEmbeddings` — added state

| Field | Type | Notes |
|---|---|---|
| `saveProgressPercent` | `number` | NEW on `useFixedSizeChunking` — mirrors `useChunkEmbeddings`'s existing field of the same name; driven by the new `save/stream` SSE progress events (research.md §4). |
| `batchProgress` | `BatchProgress \| null` | NEW on both hooks — non-null only while an "Entire Corpus" run is in flight. |
| `batchResults` | `BatchItemResult<T>[]` | NEW on both hooks — the completed run's per-document summary (research.md §3); cleared when a new run starts. |

### `useVectorView` — "Entire Corpus" grouping

```ts
export interface ChunkGroup {
  documentId: string
  documentName: string
  chunks: SavedChunk[]
}
```

When the selector's value is `ENTIRE_CORPUS_SELECTION`, `useVectorView` loops
`listSavedChunks(doc.id)` for every document the active corpus lists (research.md §1, reusing the
existing per-document endpoint unchanged) and exposes `chunkGroups: ChunkGroup[]` in
document-list order instead of a single `savedChunks: SavedChunk[]`. Selecting one chunk from a
group continues to drive `listSavedEmbeddings(chunkId)` exactly as today — no change to how an
individual chunk's saved embeddings are fetched or displayed (FR-024).

### `CorporaScreen` — per-row preview state

| Field | Type | Scope |
|---|---|---|
| `documentsByCorpus` | `Map<string, DocumentWithCorpora[]>` | Local to `CorporaScreen`; derived once from a single `listAllSources()` call (research.md §7), grouped by `corpusId`. |
| `expandedCorpusIds` | `Set<string>` | Local to `CorporaScreen`; which rows currently show the full document list instead of the first-5 preview. Not persisted, not shared via `CorpusContext`. |

`CorpusContext`'s existing `activeCorpusId`/`selectCorpus` are unchanged (FR-012/FR-013 only move
*which click* invokes `selectCorpus`, not its signature or behavior).
