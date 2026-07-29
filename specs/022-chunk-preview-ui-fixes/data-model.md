# Data Model: Chunk Preview Structure & UI Fixes

No new database tables or columns. Everything below is either a new transient (request/response,
not persisted) shape, or a frontend-only presentation concept. `Chunk.content`, `Chunk.strategy`,
`Chunk.chunk_size`, and `Chunk.overlap` (existing columns) are read but not modified.

## Existing entities referenced (no schema change)

### Chunk (existing DB row, via `Chunk`/`ChunkRow`)

Relevant existing fields used by this feature: `id`, `index`, `strategy`, `chunk_size`, `overlap` —
`chunk_size`/`overlap`/`strategy` are shared across every chunk row for a document's current save
(a re-run replaces the full set), so any one saved chunk's row supplies the values needed to
recompute word-boundary math for the whole document. `content` itself is *not* used by this
feature (it has already lost original whitespace/structure — research.md §1); the backend
re-extracts the source PDF instead.

## New transient entities (request/response only — not persisted)

### StructuredPreviewResponse (new, backend → frontend)

Returned by the new structured-preview endpoint (contracts/chunking-structured-preview-api.md).

| Field | Type | Notes |
|---|---|---|
| `fullText` | string | The document's extracted text with original structure (newlines, paragraph breaks) intact — not word-rejoined like `Chunk.content` |
| `segments` | `PreviewSegment[]` | Ordered, non-overlapping, covering the chunked portion of `fullText` |

### PreviewSegment (new, backend → frontend)

One contiguous character range of `fullText` and what owns it.

| Field | Type | Notes |
|---|---|---|
| `start` | number | Character offset into `fullText` (inclusive) |
| `end` | number | Character offset into `fullText` (exclusive) |
| `kind` | `"chunk" \| "overlap"` | `"overlap"` when 2+ saved chunks' word ranges cover this range |
| `chunkIndex` | number \| null | The owning chunk's `index`, when `kind === "chunk"`; `null` for `"overlap"` (research.md §2 — an overlap span is never attributed to a single chunk) |

Validation: `segments` are sorted ascending by `start`, contiguous (`segments[i].end === segments[i+1].start`), and never overlap each other (they partition the chunked range of `fullText`, they don't double-cover it — the `"overlap"` `kind` is what represents a chunk-to-chunk overlap, the segments list itself has no gaps or double-coverage).

## Frontend-only presentation concepts (not sent over the wire)

### PreviewBlock (frontend-only, derived from `fullText`)

Produced by the lightweight heading/list heuristic (research.md §3).

| Field | Type | Notes |
|---|---|---|
| `kind` | `"heading" \| "paragraph" \| "list-item"` | Classification from the text-cue heuristic |
| `text` | string | The block's own text (a slice of `fullText`) |
| `startOffset` | number | Offset of `text` within `fullText` |
| `endOffset` | number | Offset of `text`'s end within `fullText` |
| `listGroupId` | string \| null | Shared identifier for consecutive `list-item` blocks that belong to the same rendered `<ul>`/`<ol>`; `null` for non-list blocks |

### BlockColorSpan (frontend-only, derived per block)

The result of intersecting a `PreviewBlock`'s offset range with the backend's `segments`
(research.md §4) — one or more per block, always fully contained within that block's own range.

| Field | Type | Notes |
|---|---|---|
| `text` | string | The span's own text (a sub-slice of the block's `text`) |
| `backgroundColor` | string (hex) | From `CHUNK_COLOR_PALETTE`, or the new reserved overlap color |
| `textColor` | string (hex) | Fixed dark constant, same as today (`CHUNK_TEXT_COLOR`) |

### ChunkColorAssignment (existing concept, extended)

`assignChunkColors` (existing, `chunkColorPalette.ts`) is unchanged in its per-chunk-index
random-with-no-adjacent-repeat behavior. This feature adds one new reserved constant,
`OVERLAP_COLOR` (and `OVERLAP_TEXT_COLOR` if needed for contrast), used only for segments with
`kind === "overlap"` — never selected by `assignChunkColors` itself.

## Shared "Entire Corpus" presentation props (frontend-only, no new data — existing types reused)

These are shared component prop shapes (research.md §6); the underlying data they render
(`BatchProgress`, `BatchItemResult<T>`, `ExistingEmbeddingsSummaryItem` / the equivalent already-
chunked boolean) is unchanged from what `useFixedSizeChunking`/`useChunkEmbeddings` already
expose — only which component renders them, and how, changes.

| Component | Consumes | Used by |
|---|---|---|
| `BatchProgressBar` | `BatchProgress` (existing type) | `FixedSizeChunkingScreen`, `EmbeddingsScreen` |
| `AlreadyDoneIndicator` | `{ verb: string; noun: string; scope: "document" \| "corpus" }` | `FixedSizeChunkingScreen`, `EmbeddingsScreen` |
| `EntireCorpusSummaryList` | `BatchItemResult<T>[]` + a `formatSuccessLabel(result: T) => string` callback | `FixedSizeChunkingScreen`, `EmbeddingsScreen` |
