# UI Contracts: Sources Split View, Chunked Preview, Embedding Projection

These are internal TypeScript component/hook contracts (not a wire protocol) covering the
frontend-only concerns of this feature: the Sources screen split layout, the PDF/Chunked Preview
toggle, per-chunk color assignment, and the embedding projection view.

## `DataSourcesScreen` layout contract

```ts
interface DataSourcesScreenState {
  selectedDocumentId: string | null; // null => right pane shows placeholder (FR-007)
}
```

**Behavioral contract**:
- Renders a two-column layout: left column = upload control + `DocumentList` (unchanged from
  today); right column = `SourceDocumentPreview` (new).
- Selecting a row in `DocumentList` sets `selectedDocumentId`; `SourceDocumentPreview` re-renders
  for the new id (FR-006). Uploading a new document does not change `selectedDocumentId` (FR-005
  acceptance scenario 5).
- If the currently selected document is deleted, `selectedDocumentId` MUST reset to `null` and the
  right pane MUST show the "document no longer available" state (Edge Cases).

## `SourceDocumentPreview` component contract

```ts
type PreviewMode = "pdf" | "chunked";

interface SourceDocumentPreviewProps {
  documentId: string | null;
  mode: PreviewMode;                 // defaults to "pdf" on every new documentId selection
  onModeChange: (mode: PreviewMode) => void;
}
```

**Behavioral contract**:
- `documentId === null` → placeholder empty state (FR-007), no "Chunked Preview" button shown.
- `mode === "pdf"` → fetches/streams `GET /api/sources/{documentId}/file` (contracts/sources-file-api.md)
  and renders it via the PDF viewer; a `404`/unreadable-file response renders "preview unavailable"
  (Edge Cases) instead of a blank pane.
- `mode === "chunked"` → renders `ChunkedMarkdownView` for `documentId` (below); a "Back to PDF"
  control is present.
- A "Chunked Preview" button is anchored to the bottom-right of the pane whenever `documentId` is
  set (FR-009), regardless of current `mode` (acts as a toggle).
- Switching `documentId` MUST reset `mode` back to `"pdf"`.

## `ChunkedMarkdownView` component contract

```ts
interface ChunkedMarkdownViewProps {
  documentId: string;
}

interface SavedChunk {           // from GET /api/chunking/saved-chunks — unchanged shape
  id: string;
  index: number;
  content: string;
}
```

**Behavioral contract**:
- Fetches `GET /api/chunking/saved-chunks?documentId=` (existing endpoint, unchanged).
- `chunks.length === 0` → renders a "no chunks yet — run chunking first" message (FR-012), no color
  assignment logic runs.
- `chunks.length > 0` → renders one block per chunk, in ascending `index` order, each block's text
  passed through `ReactMarkdown` (research.md §4) and wrapped with a background color from
  `assignChunkColors` (below).

## `assignChunkColors` contract

```ts
interface ChunkColorAssignment {
  chunkId: string;
  backgroundColor: string; // hex, from CHUNK_COLOR_PALETTE
  textColor: string;       // hex, same constant value for every entry
}

declare const CHUNK_COLOR_PALETTE: readonly string[]; // ~10-12 curated pastel hex values
declare const CHUNK_TEXT_COLOR: string;                // fixed dark hex value

function assignChunkColors(chunks: SavedChunk[]): ChunkColorAssignment[];
```

**Behavioral contract** (research.md §5, spec FR-011):
- Pure function — same `chunks` order in, same-length `ChunkColorAssignment[]` out, index-aligned.
- Every `textColor` value equals `CHUNK_TEXT_COLOR`.
- For `i > 0`, `backgroundColor` at index `i` MUST NOT equal `backgroundColor` at index `i - 1`.
- Colors MAY repeat non-consecutively (e.g., index `i` and index `i + 2` may match).

## `EmbeddingProjectionView` component contract

```ts
type ProjectionScope =
  | { kind: "document"; documentId: string }
  | { kind: "corpus"; corpusId: string };

interface ProjectionPoint {      // from POST /api/embeddings/project — unchanged from contract
  chunkId: string;
  documentId: string;
  x: number;
  y: number;
}

interface EmbeddingProjectionViewProps {
  scope: ProjectionScope;
  method: "vector" | "umap" | "pca";
}
```

**Behavioral contract**:
- Resolves the set of embedded chunks for `scope` (single document's `GET
  /api/embeddings/saved?chunkId=` per chunk, or fan-out across every document in the corpus for
  `kind: "corpus"` — research.md §8).
- If the resolved entry count is `< 5`, the `method` selector for `"umap"`/`"pca"` MUST render
  disabled with an explanatory message (FR-018); `"vector"` (the existing raw-grid view) remains
  selectable regardless of count.
- For `kind: "corpus"`, any document contributing zero embedded chunks MUST be listed as excluded
  (FR-017, `DocumentExclusion` from data-model.md) rather than silently omitted with no explanation.
- When `method` is `"umap"` or `"pca"` and the minimum is met, calls `POST
  /api/embeddings/project` (contracts/embeddings-projection-api.md) and renders the returned
  `points` as a 2D scatter (research.md §7), colored/grouped by `documentId` when `scope.kind ===
  "corpus"`, with each point's tooltip identifying its `chunkId`/`documentId`.
