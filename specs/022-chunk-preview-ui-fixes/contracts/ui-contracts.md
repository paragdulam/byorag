# UI Contracts: Chunked Preview v2, Sources List Wrapping, Shared Entire Corpus Components

Internal TypeScript component/hook contracts (not a wire protocol), covering the three user
stories' frontend-only concerns.

## `ChunkedMarkdownView` (rewritten, same component name/props as today)

```ts
export interface ChunkedMarkdownViewProps {
  documentId: string
}
```

**Behavioral contract** (replaces the current per-chunk-card rendering):
- Fetches `GET /api/chunking/structured-preview?documentId=` (contracts/chunking-structured-
  preview-api.md) instead of `GET /api/chunking/saved-chunks`.
- `404` with "no saved chunks" → same "no chunks yet" empty state as today (FR-010).
- On success, classifies `fullText` into `PreviewBlock[]` (data-model.md) via the heading/list
  heuristic (research.md §3), intersects each block's range with `segments` to produce
  `BlockColorSpan[]` per block (research.md §4), and renders one continuous flow: `<h3>` for
  heading blocks, `<p>` for paragraph blocks, consecutive `list-item` blocks grouped into one
  `<ul>`/`<li>` — no borders, gaps, or per-block containers between them (FR-004/FR-005).
- Each `BlockColorSpan` renders as an inline `<span style={{ backgroundColor, color: textColor }}>`
  — color changes occur exactly at block-internal span boundaries, which may fall mid-word
  (FR-008), never only at block boundaries.
- Segments with `kind === "overlap"` render with the reserved `OVERLAP_COLOR`/`OVERLAP_TEXT_COLOR`
  constants (FR-009), never a per-chunk palette color.

## `classifyBlocks(fullText: string): PreviewBlock[]` (new, pure function)

```ts
export interface PreviewBlock {
  kind: 'heading' | 'paragraph' | 'list-item'
  text: string
  startOffset: number
  endOffset: number
  listGroupId: string | null
}

declare function classifyBlocks(fullText: string): PreviewBlock[]
```

**Behavioral contract**:
- Pure function — no side effects, deterministic for the same `fullText`.
- Blocks are ordered, contiguous relative to non-blank content, and their offsets are valid slices
  of `fullText` (research.md §3's heuristic: standalone short lines → heading; lines starting with
  a bullet/number marker → list-item, consecutive ones share a `listGroupId`; everything else →
  paragraph, consecutive non-blank lines merged into one paragraph block).

## `colorBlocks(blocks: PreviewBlock[], segments: PreviewSegment[]): Map<PreviewBlock, BlockColorSpan[]>` (new, pure function)

```ts
export interface BlockColorSpan {
  text: string
  backgroundColor: string
  textColor: string
}

declare function colorBlocks(
  blocks: PreviewBlock[],
  segments: PreviewSegment[],
): BlockColorSpan[][] // index-aligned with `blocks`
```

**Behavioral contract**:
- Pure function. For each block, returns the ordered list of `BlockColorSpan`s covering that
  block's `[startOffset, endOffset)`, split wherever a `segments` boundary falls inside the block
  (research.md §4) — every character of every block is covered by exactly one span.
- `chunkIndex`-kind segments resolve to a color via `assignChunkColors`-equivalent lookup (stable
  per chunk index for the whole document, not re-randomized per block); `"overlap"`-kind segments
  always resolve to the reserved overlap color.

## `chunkColorPalette.ts` additions

```ts
export const OVERLAP_COLOR: string // new reserved constant, distinct from every CHUNK_COLOR_PALETTE entry
export const OVERLAP_TEXT_COLOR: string // fixed dark constant for legibility against OVERLAP_COLOR

export function assignColorsByChunkIndex(chunkIndexes: number[]): Map<number, string>
// Same "no two adjacent share a color" guarantee as today's assignChunkColors, keyed by chunk
// index instead of by SavedChunk[] — since Chunked Preview v2 no longer renders one card per
// chunk, colors are looked up by index while building BlockColorSpans instead.
```

## `DocumentList` (updated, same props as today)

**Behavioral contract** (research.md n/a — pure CSS/layout fix, no new props):
- The document-name column wraps long names onto multiple lines instead of clipping/overflowing
  (FR-001) — the table no longer forces a fixed row height incompatible with wrapped multi-line
  content (FR-002); other columns stay aligned per row regardless of that row's wrapped height
  (FR-003).

## Shared "Entire Corpus" components (new)

```ts
// frontend/src/components/shared/BatchProgressBar.tsx
export interface BatchProgressBarProps {
  progress: BatchProgress // existing type, batchRunner.ts
}

// frontend/src/components/shared/AlreadyDoneIndicator.tsx
export interface AlreadyDoneIndicatorProps {
  verb: string   // e.g. "Chunking", "Embedding generation"
  noun: string   // e.g. "chunks", "embeddings"
  scope: 'document' | 'corpus'
}

// frontend/src/components/shared/EntireCorpusSummaryList.tsx
export interface EntireCorpusSummaryListProps<T> {
  results: BatchItemResult<T>[] // existing type, batchRunner.ts
  formatSuccessLabel: (result: T) => string // e.g. (r) => `${r.totalChunks} chunks`
}
```

**Behavioral contract**:
- `FixedSizeChunkingScreen` and `EmbeddingsScreen` both render these three components for their
  respective "Entire Corpus" states (FR-011–FR-014) — identical markup/styling, differing only in
  the props passed (verb/noun text, and each screen's own `BatchItemResult<T>` data plus its own
  `formatSuccessLabel`).
- `EmbeddingsScreen`'s existing bespoke per-document `existingEmbeddingsSummary` breakdown block is
  removed from its render output; the underlying `existingEmbeddingsSummary` data is instead
  reduced to a boolean ("does at least one document/chunk already have this data") to drive
  `AlreadyDoneIndicator`, matching `FixedSizeChunkingScreen`'s `chunkOrigin === 'auto-loaded'`
  pattern.
