# Research: PDF Fullscreen Reading & In-Context Chunk Preview

## §1. Where fullscreen state should live

**Decision**: `isFullscreen` is a plain `useState<boolean>` owned by `DataSourcesScreen.tsx` (the
parent), passed down to `SourceDocumentPreview` as a prop + toggle callback — not owned inside
`SourceDocumentPreview` itself, and not lifted into a context or persisted anywhere.

**Rationale**: Fullscreen must change the *layout* — hiding the document-list left pane and
expanding the right pane to 100% width — which is a concern of the screen's split-pane layout,
not of the preview component itself. `DataSourcesScreen` already owns `selectedDocumentId` and
already has a `useEffect` pattern for resetting state on document change; `isFullscreen` fits the
same pattern (`useEffect(() => setIsFullscreen(false), [selectedDocumentId])`).

Critically, this also gets "reset when navigating away and back" (Clarification 3) for free: the
app (`App.tsx`) swaps screens via a ternary over React elements, so `DataSourcesScreen` fully
unmounts when the user leaves Sources and remounts fresh when they return — a local `useState`
naturally resets to its initial `false` value with no extra code. No sessionStorage, no context,
no explicit "on screen re-entry" handler needed.

**Alternatives considered**: A `PreviewLayoutContext` — rejected as unnecessary machinery for a
single boolean scoped to one screen (YAGNI, constitution Principle III). Storing it in
`SourceDocumentPreview` and having `DataSourcesScreen` read it back via a ref/callback — rejected
because the component that needs to react to the value (the parent's grid layout) shouldn't have
to reach into a child for it; passing it down is the direct, standard React data-flow direction.

## §2. Extending vs. replacing the structured-preview endpoint

**Decision**: Extend `GET /api/chunking/structured-preview`'s existing response
(`StructuredPreviewResponse`) with two new fields — `pages: PagePosition[]` and
`chunkRanges: ChunkRange[]` — rather than adding a new endpoint or a new per-chunk-selection
network call.

**Rationale**: The endpoint already does the expensive work once per document (re-extracting
structure-preserving text, tokenizing into words, computing chunk/overlap ownership) — the page
boundaries and per-chunk ranges are cheap, incremental additions computed from data already in
hand inside `compute_structured_preview`. Returning them alongside `fullText`/`segments` lets the
frontend fetch a document's full context *once* (e.g., when the chunk list loads) and then handle
every subsequent chunk-selection click as pure client-side slicing — zero additional network
round-trips, directly satisfying SC-004's "no stale or mismatched page" and general responsiveness
expectation. It's also backward-compatible: existing consumers of the response gain two new
fields they can ignore.

**Alternatives considered**: A new `GET /api/chunking/chunk-in-context?documentId=&chunkIndex=`
endpoint computed fresh per selection — rejected as it would re-run the (currently O(document
length)) word-tokenization and ownership computation on every click, adding latency exactly where
the spec asks for instant switching, for no benefit over doing it once and slicing client-side.

## §3. Computing per-page character boundaries

**Decision**: Compute page boundaries against the *raw* joined page text (before
`.strip()`), then shift by however much was stripped from the start, and clip to the final
(stripped) length:

- Build `page_texts` as today (`extract_text_pages`).
- `raw = "\n".join(page_texts)`; record each page's `[start, end)` range in `raw` as pages are
  concatenated (page *i*'s start is the running character count so far; each page after the first
  is preceded by one `"\n"` joiner character).
- `stripped = raw.strip()`; `lstrip_len = len(raw) - len(raw.lstrip())`.
- Shift every page's `start`/`end` by `-lstrip_len`, then clip both to `[0, len(stripped)]`,
  dropping any page whose clipped `start >= end` (zero/negative width — e.g., a blank page,
  leading, trailing, or in the middle).
- **Re-stitch the survivors so they still fully partition `fullText` with no gaps.** Clipping only
  fixes each page's own extracted-text span — it does nothing about the `"\n"` joiner
  character(s) between one page and the next (or a dropped page's now-missing span in between),
  which still belong to `fullText` and must render as part of *some* page. So, in original page
  order, set every surviving page's `end` to the *next surviving* page's `start` (absorbing
  whatever falls between them — joiners, or an entire dropped blank page's gap), and the last
  surviving page's `end` to `len(stripped)`. (Traced by hand against a 3-page
  `["", "word"×10, "word"×10]` document: without this step, page 2 ends at 49 and page 3 starts at
  50 — a 1-character gap at the joiner between them. This is the exact same class of bug 022's
  `segments` computation already hit and fixed the same way — research.md there extends a run's
  end to the *next* word's start rather than its own last word's end.)
- The result is a list of `PagePosition {pageNumber, start, end}` in the same offset space as
  `fullText` (which is exactly `stripped`), one entry per surviving page, in original page order.
  `pageNumber` is the page's true 1-indexed position in the source PDF (matching how `react-pdf`'s
  `Page` component numbers pages, per existing `SourceDocumentPreview` usage) — a dropped blank
  page leaves a gap in the `pageNumber` sequence (e.g., `[1, 3]`) rather than being renumbered,
  so the displayed page label always matches what the user would see in the actual PDF.

**Rationale**: `full_text` is already defined as `"\n".join(pages).strip()` (existing code,
`compute_structured_preview`) — trailing/leading whitespace only ever gets removed from the very
start/end of the whole joined string, so a single shift-and-clip pass correctly re-aligns
raw-text page boundaries into `full_text`'s offset space without needing to change how `full_text`
itself is built (preserving the existing, already-tested behavior of `fullText`/`segments`).

**Alternatives considered**: Stripping each page's text individually before joining — rejected
because it would change `fullText`'s content/offsets (already relied upon by existing 022 tests
and the `segments` computation), and because inter-page whitespace is intentionally preserved
today as part of the continuous-flow rendering.

## §4. Computing a chunk's own character range

**Decision**: For each saved chunk, independently compute its own word range using the exact same
formula already used inside `compute_structured_preview`'s ownership loop —
`stride = chunk.chunk_size - chunk.overlap`, `start_word = chunk.index * stride`,
`end_word = min(start_word + chunk.chunk_size, n_words)` — then record
`ChunkRange {chunkIndex, start: word_tokens[start_word].start(), end: word_tokens[end_word-1].end()}`
(clipped when `end_word <= start_word`, i.e., an empty/out-of-range chunk, which is excluded).

**Rationale**: This is *not* derived from the merged `segments` list (which deliberately collapses
"owned by 2+ chunks" into a generic `"overlap"` kind, losing which specific chunks are involved) —
it's computed directly from each chunk's own persisted `chunk_size`/`overlap`/`index`, exactly like
the existing per-chunk ownership loop already does, just recording the range instead of only
marking ownership. No new algorithm — this reuses the same loop with one extra bit of bookkeeping.

**Alternatives considered**: Deriving a chunk's range by scanning `segments` for matching
`chunkIndex` — rejected because overlap-kind segments don't carry a `chunkIndex` (by design, per
022's research.md §2), so a chunk's true start/end would be unrecoverable wherever it overlaps a
neighbor — exactly the boundary case this feature cares about most.

## §5. Determining touched pages and slicing

**Decision**: A new pure frontend function, `computeChunkContextView(preview, selectedChunkIndex)`
(`frontend/src/lib/chunkContextView.ts`):

1. Look up `ChunkRange`s for `selectedChunkIndex - 1`, `selectedChunkIndex`, `selectedChunkIndex + 1`
   from `chunkRanges` (silently skip indices with no matching range — first/last chunk cases,
   Clarification-consistent with FR-012).
2. For each of those (up to 3) chunk ranges, find every `PagePosition` whose `[start, end)`
   overlaps the chunk range (`page.start < chunk.end && page.end > chunk.start`); union the
   resulting page numbers into a sorted, deduplicated list.
3. Compute one shared `colorByChunkIndex` map (via the existing `assignColorsByChunkIndex`) across
   *all* chunk indexes appearing in `segments` that fall within the touched pages' combined range
   — computed once, before per-page slicing, so the same chunk index gets the same color on every
   page it appears on (see §6).
4. For each touched page (in page-number order): slice `pageText = fullText.slice(page.start,
   page.end)`; filter+clip `segments` to that page's range and rebase them to page-relative
   offsets (`start - page.start`, `end - page.start`); run the existing, unmodified
   `classifyBlocks(pageText)` and `colorBlocks(blocks, clippedSegments, colorByChunkIndex)`.
5. Return `{ pageNumber, blocks, spansByBlock }[]` for the component to render, one group per page,
   in page order.

**Rationale**: Reuses `classifyBlocks`/`colorBlocks` completely unmodified in their per-block
logic — page-scoping is purely a matter of *what text and segments get passed in*, not a new
rendering algorithm. This keeps the well-tested 022 heuristic and coloring behavior identical;
only the new orchestration (§5 above) and one small addition to `colorBlocks`'s signature (§6) are
new surface area needing new tests.

## §6. Keeping a chunk's color consistent across pages

**Decision**: Give `colorBlocks` an optional third parameter,
`colorBlocks(blocks, segments, colorByChunkIndex?: Map<number, string>)`. When omitted, it computes
the map internally exactly as it does today (preserving existing behavior/tests for any other
caller). The new chunk-context flow always passes a pre-computed map (§5 step 3), computed once
across all pages being rendered together — not once per page.

**Rationale**: `colorBlocks` currently calls `assignColorsByChunkIndex` internally per invocation.
If the new flow called it once per page independently, a chunk spanning two pages could receive
two different random colors — one per page — which would defeat the purpose of "the selected
chunk... colored... consistent with how chunk/overlap colors are already assigned elsewhere"
(FR-011). Hoisting the color-map computation one level up and threading it through is the minimal
change that preserves color consistency without touching the (already-correct) per-block coloring
logic itself.

**Alternatives considered**: Recomputing colors deterministically from `chunkIndex` (e.g., a hash
instead of random-with-no-adjacent-repeat) — rejected as unnecessary scope creep; the existing
palette-assignment behavior is untouched and already tested, we just need to call it once instead
of N times.

## §7. Relocating and renaming the chunk-rendering component

**Decision**: Extract `ChunkedMarkdownView.tsx`'s internal `groupForRendering` + `ColoredSpans`
helpers into a new shared component, `frontend/src/components/shared/ColoredBlockGroups.tsx`,
taking `{ blocks, spansByBlock }` and rendering the same heading/paragraph/list output as today.
Build a new `frontend/src/components/chunking/ChunkInContextPreview.tsx` that calls
`fetchStructuredPreview` once per document, calls `computeChunkContextView` per chunk selection,
and renders one `ColoredBlockGroups` per touched page with a page-number divider between them.
Delete `ChunkedMarkdownView.tsx` and its dedicated test file entirely; remove its usage (and the
"Chunked Preview"/"Back to PDF" toggle) from `SourceDocumentPreview.tsx`.

**Rationale**: The user's request frames this as *relocating* the chunk-annotated view from
Sources to Chunking, not deleting the capability (spec.md Assumptions) — reusing the exact
block-rendering markup/styling keeps the visual language identical to what shipped in 022, while
avoiding two near-duplicate copies of `groupForRendering`/`ColoredSpans` living in two components.

**Alternatives considered**: Keeping `ChunkedMarkdownView.tsx` in place and having the new
Chunking-screen component import/wrap it — rejected because `ChunkedMarkdownView` owns its own
data-fetching (whole-document) and its own top-level empty/loading states, none of which fit the
page-scoped, chunk-selection-driven use case; wrapping would mean fighting its existing behavior
rather than reusing the genuinely shared part (the rendering).

## §8. In-context preview vs. an unsaved (not-yet-saved) chunking run

**Decision**: The in-context preview always reflects the document's *currently saved* chunk
configuration (the same data `GET /api/chunking/structured-preview` already only serves — it reads
`list_saved_chunks`, not any in-memory unsaved run). If the user has just run a new, unsaved
chunk-size/overlap configuration (`chunkOrigin === 'computed'`, not yet saved), the chunk list on
the left continues to show that fresh preview as it does today, but the right-hand in-context
preview shows a short explanatory state ("Save chunks to see this configuration in its page
context") instead of attempting to show mismatched data, and refreshes to the new configuration
once `Save Chunks` succeeds.

**Rationale**: `/structured-preview` already has this exact constraint from 022 (it 404s with "no
saved chunks" if nothing is saved at all) — extending the same "reflects saved state only" rule to
"reflects saved state, not a not-yet-saved fresh run" is a direct, consistent continuation of
already-accepted behavior, not a new ambiguity. Attempting to reconcile an unsaved run's chunk
indices against saved-chunk page/range data would risk silently showing the *wrong* page for a
chunk (undermining the whole feature's trustworthiness) for a case (viewing an unsaved
configuration's page context before saving) the user did not ask for.

**Alternatives considered**: Blocking `Re-Calculate Chunks` while Entire-Corpus/in-context preview
is open, or auto-saving on every recompute — both rejected as out-of-scope behavior changes to the
existing run/save flow, which this feature does not touch.
