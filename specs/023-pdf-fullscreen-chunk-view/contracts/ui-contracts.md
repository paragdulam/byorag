# UI Contracts: PDF Fullscreen Reading & In-Context Chunk Preview

## `SourceDocumentPreview` (updated)

**Location**: `frontend/src/components/sources/SourceDocumentPreview.tsx`

**Props**: `{ documentId: string | null; isFullscreen: boolean; onToggleFullscreen: () => void }`

**Behavior**:
- Renders the PDF (`react-pdf` `Document`/`Page`, continuous scroll through every page) exactly as
  today — the fullscreen/normal distinction affects only the *container width*, controlled by the
  parent (`DataSourcesScreen`), not this component's own rendering.
- No longer renders a "Chunked Preview"/"Back to PDF" button and no longer imports
  `ChunkedMarkdownView`.
- Renders a single control button in the footer bar:
  - When `isFullscreen` is `false`: a "Fullscreen" button, `onClick={onToggleFullscreen}`.
  - When `isFullscreen` is `true`: a "Restore" button, `onClick={onToggleFullscreen}`.
- `data-testid="source-preview-fullscreen-toggle"` on that button, for both states (label text
  changes, testid does not) — so tests can assert on label text without needing two selectors.

## `DataSourcesScreen` (updated)

**Location**: `frontend/src/components/sources/DataSourcesScreen.tsx`

**New local state**: `isFullscreen: boolean` (default `false`).

**Behavior**:
- `useEffect(() => setIsFullscreen(false), [selectedDocumentId])` — resets on document change
  (FR-004).
- Layout:
  - `isFullscreen === false` (today's behavior): left pane (`sources-left-pane`) at `w-1/2`, right
    pane (`sources-right-pane`) at `w-1/2`, both visible.
  - `isFullscreen === true`: left pane not rendered (or `hidden`), right pane at `w-full`
    (100% of the content area).
- Passes `isFullscreen`/`setIsFullscreen`-derived toggle down to `SourceDocumentPreview`.

## `ChunkInContextPreview` (new)

**Location**: `frontend/src/components/chunking/ChunkInContextPreview.tsx`

**Props**: `{ documentId: string; selectedChunkIndex: number; hasUnsavedChanges: boolean }`

**Behavior**:
- On `documentId` change, calls `fetchStructuredPreview(documentId)` once and caches the result
  for subsequent chunk-selection changes within the same document (no re-fetch per click).
- If `hasUnsavedChanges` is `true`: renders
  `data-testid="chunk-context-unsaved"` — "Save chunks to see this configuration in its page
  context." — and does not attempt to render page content (research.md §8).
- If the fetch fails or the document has zero saved chunks (same 404 cases as the base
  structured-preview contract): renders the same `data-testid="chunked-preview-empty"` empty state
  text used previously by `ChunkedMarkdownView` ("No chunks exist yet for this document…") — FR-013.
- Otherwise: calls `computeChunkContextView(preview, selectedChunkIndex)` (research.md §5) and
  renders, for each returned page in order:
  - `data-testid="chunk-context-page"` wrapper
  - A page-number divider/label, e.g. `data-testid="chunk-context-page-number"` — "Page {n}"
  - `<ColoredBlockGroups blocks={page.blocks} spansByBlock={page.spansByBlock} />`
- When the selected chunk (or a neighbor) is missing because it's the first/last chunk of the
  document, that neighbor is simply absent from the rendered pages — no error, no placeholder
  (FR-012).

## `ColoredBlockGroups` (new, shared)

**Location**: `frontend/src/components/shared/ColoredBlockGroups.tsx`

**Props**: `{ blocks: PreviewBlock[]; spansByBlock: BlockColorSpan[][] }`

**Behavior**: Identical rendering to `ChunkedMarkdownView`'s previous internal
`groupForRendering`/`ColoredSpans` — groups consecutive `list-item` blocks sharing a `listGroupId`
into one `<ul data-testid="chunked-preview-list">`, renders `heading` blocks as
`<h3 data-testid="chunked-preview-heading">`, everything else as
`<p data-testid="chunked-preview-paragraph">`, each with inline colored `<span>` children per
`spansByBlock`. Pure/presentational — no fetching, no per-document or per-chunk awareness.

## `FixedSizeChunkingScreen` (updated)

**Location**: `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`

**New local state**: `selectedChunkIndex: number` (default `0`).

**Behavior**:
- `useEffect(() => setSelectedChunkIndex(0), [result])` — re-defaults to the first chunk whenever
  a new saved-chunks result loads (FR-007).
- Only applies in single-document (non-Entire-Corpus) scope; Entire-Corpus scope keeps today's
  full-width `EntireCorpusSummaryList` unchanged.
- The `chunk-list` render area, in single-document scope, becomes two columns:
  - Left (`w-1/2`, existing `data-testid="chunk-list"` semantics preserved): the existing
    per-chunk cards, each now a `<button>` with `onClick={() => setSelectedChunkIndex(chunk.index)}`,
    `aria-current="true"` (or an equivalent selected-state class) on the currently selected card.
  - Right (`w-1/2`, `data-testid="chunk-context-preview"`): `<ChunkInContextPreview
    documentId={activeDocumentId} selectedChunkIndex={selectedChunkIndex}
    hasUnsavedChanges={chunkOrigin === 'computed' && !isSaved} />`.
