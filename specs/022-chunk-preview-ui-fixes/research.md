# Research: Chunk Preview Structure & UI Fixes

## 1. Why "preserve the original document structure" needs a backend change, not just a frontend re-render

**Finding**: `FixedSizeStrategy.chunk()` (`backend/app/chunking/strategies/fixed_size.py`) computes chunks via
`text.split()` (splits on *any* whitespace, discarding it) and rejoins each chunk's words with a single space:
`" ".join(words[i:i+chunk_size])`. This means the `content` already saved on every `Chunk` row has **already lost
all original paragraph breaks, line breaks, and spacing** by the time it reaches the frontend — there is no
newline information left to run a heading/paragraph/list heuristic against, and no way to reconstruct "the
document as it reads" from saved chunk `content` strings alone.

**Decision**: Add a new read-only backend capability that re-extracts a document's full text with its original
structure intact (real newlines, not word-rejoined) and computes each saved chunk's *character offsets* within
that structure-preserving text — computed on demand from data already persisted (`chunk_size`, `overlap`,
`strategy` are stored per `Chunk` row today, per `007-chunking-overlap-controls`/`012-save-chunks-button`), not
by adding new persisted columns.

**Rationale**: `Chunk.chunk_size`/`Chunk.overlap`/`Chunk.strategy` are already saved and shared across every chunk
of a document's current save (a re-run fully replaces the previous set, `research.md §9` of `005-fixed-size-
chunking`). Given those three values plus a structure-preserving re-extraction of the same PDF, the exact same
`stride = chunk_size - overlap` / windowing math the strategy already uses can be re-run against a
*position-tracked* word tokenization (e.g., `re.finditer(r'\S+', text)`, which yields each word's `(start, end)`
character offsets in the untouched text) to deterministically recover which character range of the
structure-preserving text belongs to which chunk index — without persisting anything new and without changing
what `Chunk.content` means for any existing consumer (embeddings generation, Vector View, etc. all keep reading
the existing word-joined `content` field unchanged).

**Alternatives considered**:
- Reconstruct structure from `Chunk.content` alone (frontend-only) — rejected; the whitespace is already gone by
  the time chunks are saved, so no heuristic can recover it after the fact.
- Change `FixedSizeStrategy.chunk()` to preserve original spacing in `content` itself — rejected; this changes the
  content used by embeddings/comparison features (013-bert-pgvector-embeddings) that depend on today's
  normalized-whitespace chunk text, and would require re-chunking/re-embedding every existing saved document to
  stay consistent. Recomputing offsets on demand, read-only, for this one preview feature is a much smaller,
  fully backward-compatible change.
- Persist per-chunk character offsets as new DB columns at chunk-save time — rejected; the offsets are fully
  derivable on demand from already-persisted data (research.md's "recompute, don't store" default for this
  project — no migration needed, no risk of stored offsets drifting from a since-changed file).

## 2. Where chunk vs. overlap "ownership" per character range is computed

**Decision**: Backend computes, once per Chunked Preview v2 request: (a) the structure-preserving `fullText`; (b)
word tokens with `(start, end)` offsets via `re.finditer(r"\S+", fullText)`; (c) for each saved chunk index `i`,
its word range `[i*stride, i*stride+chunk_size)` (clamped to the available word count), mapped to a character
range via the first/last word's offsets; (d) a flattened, ordered, non-overlapping list of **segments** covering
the chunked portion of `fullText`, each tagged either with the one chunk index that exclusively owns it, or with
a generic `"overlap"` tag when two or more chunks' word ranges cover the same character range.

**Rationale**: A word can be claimed by more than two chunks in a pathological configuration (overlap very close
to chunk size, e.g. `chunk_size=10, overlap=9` → `stride=1`, so a single word can fall inside many consecutive
chunks' ranges) — the spec's Clarifications only require a *single* distinct "overlap" indicator regardless of
how many chunks share a span, so ownership resolves to exactly two states per segment: "exactly one chunk" (that
chunk's own color) or "two-or-more chunks" (the shared overlap color) — no need to track *which* chunks overlap
a given span, only whether more than one does.

**Alternatives considered**: Only supporting exactly one prior/next neighbor overlap (2-way) — rejected; the
existing overlap control's only constraint is `overlap < chunk_size` (007-chunking-overlap-controls), which does
not prevent 3+-way overlap, so the design must handle it rather than assume it can't happen.

## 3. Where the heading/list heuristic (FR-007) runs

**Decision**: Runs entirely in the frontend, over the structure-preserving `fullText` string the backend returns
— a pure string→blocks classification (paragraph vs. heading vs. list item) with no backend/file dependency.

**Rationale**: Once `fullText` (with real newlines) is available, classifying lines is a presentation concern
that benefits from fast iteration without an API change every time the heuristic is tuned — consistent with
keeping the backend endpoint minimal (structure + offsets only) and heuristic/rendering logic in one place
(frontend), matching how `chunkColorPalette.ts`'s per-chunk color logic already lives frontend-side.

**Heuristic** (lightweight, per Clarifications): a line is a **heading** if it stands alone (blank lines before
and after, or is the first/last line of the extracted text) and is short (an upper bound on character count, not
requiring terminal punctuation); a line is a **list item** if it starts with a bullet marker (`-`, `*`, `•`) or a
number/letter followed by `.` or `)`; consecutive list-item lines group into one list; everything else is a
paragraph (consecutive non-blank lines merge into one paragraph, matching typical PDF text extraction where a
paragraph's wrapped lines are separated by single newlines and paragraphs by blank lines).

**Alternatives considered**: Running the heuristic on the backend and returning pre-classified blocks — rejected
per the rationale above; also would entangle offset math (needed for chunk-color segments) with presentation
classification (needed for headings/lists) in the same endpoint response shape, when they're better decoupled
(offsets are exact/derived math, block classification is a fuzzy heuristic that will likely need future tuning).

## 4. Rendering colored, structure-aware text without producing invalid nested HTML

**Decision**: Do not route the final render through `react-markdown` at all for this view. Instead: (1) classify
`fullText` into an ordered list of **blocks** (`{ kind: "heading" | "paragraph" | "list-item", text, startOffset,
endOffset }`) via the heuristic above; (2) intersect the backend's chunk/overlap **segments** with each block's
`[startOffset, endOffset)` range, splitting a block's text into an ordered list of colored inline spans local to
that block; (3) render each block as its own semantic element (`<h3>`, `<p>`, `<li>` grouped into `<ul>`/`<ol>`),
with its colored spans as children.

**Rationale**: A single chunk's color may need to span across multiple blocks (e.g., a chunk that starts mid-
paragraph, includes a heading, and continues into the next paragraph) — but color transitions only ever need to
occur *within* a block's own inline content, never straddling two block-level elements, since each block renders
as its own independent, valid HTML element. This satisfies "color changes exactly at the boundary, even mid-word"
(Clarifications) without ever needing an inline `<span>` to open inside one block element and close inside
another, which isn't expressible in valid HTML/JSX. The visual result is identical either way — colors still
appear to "continue" across a heading or paragraph break exactly where the chunk data says they should.

**Alternatives considered**: Using `react-markdown`'s AST and a custom `rehype`/`remark` plugin to inject
colored spans — rejected as significantly more complex for the same visual outcome, and still runs into the same
block-boundary constraint internally; going directly from classified blocks to React elements is simpler and
gives full control over span splitting.

## 5. New "overlap" color

**Decision**: Add one new reserved constant color (visually distinct from every entry in the existing
`CHUNK_COLOR_PALETTE`, e.g. a muted grey/hatch-adjacent tone) alongside the existing palette in
`chunkColorPalette.ts`, used exclusively for overlap segments — never assigned to a chunk's own (non-shared)
text, and never randomly selected the way per-chunk colors are.

**Rationale**: The overlap indicator's purpose is to be recognizable as "shared," not to blend in with the
per-chunk palette; a single fixed, reserved color (rather than another random pick) makes every overlap region
immediately recognizable as the same *kind* of thing across the whole document, which a randomly-assigned color
would not.

## 6. Unifying "Entire Corpus" presentation between Fixed Size Chunking and Embeddings

**Decision**: Extract three shared, purely presentational components used by both `FixedSizeChunkingScreen` and
`EmbeddingsScreen`: a combined batch-progress bar (today's `computeCombinedPercent`/`formatBatchProgressLabel`
pairing), a single-line "already done" indicator (today's Chunking-only "already chunked" pattern, parameterized
by verb/noun so Embeddings can say "embeddings" instead of "chunks"), and a per-document results summary list
(today's `entire-corpus-summary` list, parameterized by how each row's success count is labeled). Embeddings'
current bespoke `existingEmbeddingsSummary` per-document breakdown block is replaced by the shared single-line
indicator (matching Chunking's simpler pattern, per the spec's Assumption that Chunking is the reference
presentation) — the underlying `existingEmbeddingsSummary` data itself is unchanged and still available for
future consumers (e.g., Vector View's document-exclusion messaging), only its *display* on the Embeddings screen
changes.

**Rationale**: Constitution Principle I favors shared, registered behavior over parallel hand-maintained copies;
extracting shared components is the direct way to guarantee both screens render identically for equivalent
states going forward, rather than visually matching them once and letting them drift again on the next change to
either screen.

**Alternatives considered**: Copy-pasting matching JSX/classNames into `EmbeddingsScreen.tsx` without extracting
shared components — rejected; it would re-create the exact drift risk that caused this spec to exist in the
first place (021-sources-chunking-embeddings-refresh's `useChunkEmbeddings` split introduced a new
`existingEmbeddingsSummary` concept that visibly diverged from Chunking's pattern).
