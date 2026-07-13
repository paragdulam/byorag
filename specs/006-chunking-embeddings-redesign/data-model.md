# Data Model: Chunking Section Redesign & Embeddings Entry Point

No persisted storage is introduced by this feature (unchanged from 005 — chunking results remain
ephemeral, computed fresh per run). The entities below describe request/response payloads
(backend, over SSE) and in-memory UI state (frontend), not database tables.

## Backend payloads (`backend/app/chunking/schemas.py`)

### ChunkProgressEvent *(new — SSE `progress` event data, not a persisted model)*

| Field | Type | Notes |
|---|---|---|
| `percent` | `int` | 0–90 while pages are being extracted (`pages_processed / total_pages * 90`, rounded down); reserved 90–100 range is emitted only as part of the terminal `result` event reaching 100. Monotonically non-decreasing within one run. |

### Chunk *(unchanged from 005)*

| Field | Type | Notes |
|---|---|---|
| `index` | `int` | Position of this chunk within the full (uncapped) result. |
| `content` | `str` | The chunk's text content. |

### ChunkingResult *(unchanged from 005)*

| Field | Type | Notes |
|---|---|---|
| `chunks` | `list[Chunk]` | Capped at `MAX_CHUNKS` (200), same as 005. |
| `totalChunks` | `int` | True count before capping — drives the existing "more chunks exist" note. |
| `strategy` | `"fixed-size"` | Always `"fixed-size"` — no other strategy is selectable from this screen (FR-002). |
| `chunkSize` | `int` | Echoes the chunk size used for this run. |

### ChunkRunResponse *(unchanged from 005 — SSE terminal `result` event data)*

| Field | Type | Notes |
|---|---|---|
| `extractionFailed` | `bool` | `true` when no text could be extracted from the document. |
| `result` | `ChunkingResult \| null` | `null` when `extractionFailed` is `true`. |

**Removed**: `ChunkRunRequest` (JSON body of the old `POST /api/chunking/run`) is removed —
`documentId` and `chunkSize` are now plain query parameters on the streaming `GET` endpoint
(research.md §1, §4). `strategy` is no longer an input at all: the endpoint always runs
`"fixed-size"` server-side (FR-002), matching the screen no longer offering a strategy choice.

## Frontend state (`frontend/src/hooks/useFixedSizeChunking.ts`)

### ChunkingRunStatus *(extended from 005)*

`'idle' | 'running' | 'success' | 'extraction-failed' | 'error'` — unchanged set of states; `'running'`
now additionally carries a live `progressPercent`.

### UseFixedSizeChunking *(extended from 005)*

| Field | Type | Notes |
|---|---|---|
| `documents` | `SourceDocument[]` | Unchanged. |
| `isLoadingDocuments` | `bool` | Unchanged. |
| `status` | `ChunkingRunStatus` | Unchanged set of values. |
| `progressPercent` | `int` (0–100) | **New.** Live progress while `status === 'running'`; reset to `0` when a new run starts. |
| `result` | `ChunkingResult \| null` | Unchanged. |
| `hasSucceededOnce` | `bool` | **New.** One-way latch set to `true` on the first successful run in this session (research.md §7); drives "Move to Embeddings" enablement. Never resets to `false`. |
| `run` | `(documentId: string, chunkSize: number) => void` | Unchanged signature; internally now opens the SSE stream instead of a single `fetch`. |

## Navigation (`frontend/src/components/layout/SidebarNav.tsx`)

### ScreenId *(extended)*

`'sources' | 'fixed-size-chunking' | 'embeddings'` — adds the new `'embeddings'` screen id.

### NAV_ITEMS *(updated)*

The top-level entry previously labeled `'Experiments'` is renamed to `'Chunking'` (FR-001) and gains
a second sub-item:

| Sub-item label | `screen` |
|---|---|
| `Fixed Size Chunking` | `'fixed-size-chunking'` (unchanged) |
| `Embeddings` | `'embeddings'` (new, FR-003) |
