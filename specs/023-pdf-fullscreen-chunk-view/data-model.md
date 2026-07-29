# Data Model: PDF Fullscreen Reading & In-Context Chunk Preview

No database schema changes. All entities below are either new wire-format (API response) shapes
computed on demand from existing `Document`/`Chunk` rows and the on-disk PDF, or frontend-only
view-state/derived-data shapes. Nothing here is persisted.

## Backend (wire format additions to `GET /api/chunking/structured-preview`)

### PagePosition

| Field | Type | Notes |
|---|---|---|
| `pageNumber` | `int` | 1-indexed, matching `react-pdf`'s existing `Page` numbering |
| `start` | `int` | Character offset into `fullText` where this page's content begins (inclusive) |
| `end` | `int` | Character offset into `fullText` where this page's content ends (exclusive) |

One entry per PDF page that has any content remaining after the existing `fullText` strip
(research.md §3); a page collapsed to zero width by leading/trailing strip is omitted.

### ChunkRange

| Field | Type | Notes |
|---|---|---|
| `chunkIndex` | `int` | Matches a saved `Chunk.index` |
| `start` | `int` | Character offset into `fullText` where this chunk's own text begins |
| `end` | `int` | Character offset into `fullText` where this chunk's own text ends (exclusive) |

One entry per saved chunk (research.md §4) — independent of `segments`' overlap-collapsing, so a
chunk's true extent is always recoverable even where it overlaps a neighbor.

### StructuredPreviewResponse (extended)

| Field | Type | Notes |
|---|---|---|
| `fullText` | `string` | Unchanged from 022 |
| `segments` | `PreviewSegment[]` | Unchanged from 022 |
| `pages` | `PagePosition[]` | **New** — ordered by `pageNumber` |
| `chunkRanges` | `ChunkRange[]` | **New** — ordered by `chunkIndex` |

Backward compatible: existing consumers reading only `fullText`/`segments` are unaffected.

## Frontend (view-state and derived data)

### PDF Preview Layout State (Sources screen)

| Field | Type | Owner | Notes |
|---|---|---|---|
| `isFullscreen` | `boolean` | `DataSourcesScreen` | Resets to `false` on `selectedDocumentId` change (effect) and on screen remount (natural, research.md §1) |

### ChunkContextPage (frontend, derived per chunk selection)

Output of `computeChunkContextView` (research.md §5), one entry per touched page:

| Field | Type | Notes |
|---|---|---|
| `pageNumber` | `int` | From the matching `PagePosition` |
| `blocks` | `PreviewBlock[]` | From `classifyBlocks(pageText)` — unchanged type from 022 |
| `spansByBlock` | `BlockColorSpan[][]` | From `colorBlocks(blocks, clippedSegments, sharedColorMap)` — unchanged type from 022 |

### In-Context Chunk Selection (Fixed Size Chunking screen)

| Field | Type | Owner | Notes |
|---|---|---|---|
| `selectedChunkIndex` | `number` | `FixedSizeChunkingScreen` | Defaults to `0` whenever a new `result` (saved-chunks list) loads; only meaningful in single-document (non-Entire-Corpus) scope |

Derived, not stored: the neighbor indices (`selectedChunkIndex - 1`, `selectedChunkIndex + 1`) and
the resulting `ChunkContextPage[]` are computed fresh from `selectedChunkIndex` + the fetched
`StructuredPreview`, never persisted.

## Component Props

### `SourceDocumentPreview` (updated)

| Prop | Type | Notes |
|---|---|---|
| `documentId` | `string \| null` | Unchanged |
| `isFullscreen` | `boolean` | **New** |
| `onToggleFullscreen` | `() => void` | **New** — flips the parent's `isFullscreen` |

Removed: the internal `mode: 'pdf' \| 'chunked'` state, the "Chunked Preview"/"Back to PDF" button,
and the `ChunkedMarkdownView` import/usage.

### `ChunkInContextPreview` (new)

| Prop | Type | Notes |
|---|---|---|
| `documentId` | `string` | Drives the (single, cached-per-document) `fetchStructuredPreview` call |
| `selectedChunkIndex` | `number` | Drives which pages/chunks are sliced and rendered |
| `hasUnsavedChanges` | `boolean` | When `true`, renders the "Save chunks to see this configuration in its page context" state instead of fetching/rendering (research.md §8) |

### `ColoredBlockGroups` (new, shared)

| Prop | Type | Notes |
|---|---|---|
| `blocks` | `PreviewBlock[]` | Same shape `ChunkedMarkdownView` used internally |
| `spansByBlock` | `BlockColorSpan[][]` | Same shape `ChunkedMarkdownView` used internally |

Pure rendering — no data fetching, no document/chunk awareness. Used once per page by
`ChunkInContextPreview`; would also be the natural reuse point if a future feature needs the same
heading/paragraph/list-with-colored-spans rendering elsewhere.
