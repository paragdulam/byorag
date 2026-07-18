# Phase 0 Research: RAG Workflow Screens — UI Polish Batch

Resolved by inspecting the current implementations of `DataSourcesScreen`/`DocumentList`,
`CorporaScreen`/`CorpusContext`, `FixedSizeChunkingScreen`/`useFixedSizeChunking`,
`EmbeddingsScreen`/`useChunkEmbeddings`, `VectorViewScreen`/`useVectorView`,
`PlaygroundScreen`/`TurnBubble`, their backing API clients, and the backend
`chunking`/`embeddings` routers and services. Three architectural questions were already resolved
via `/speckit-clarify` (batch orchestration model, progress display format, Vector View grouping)
and are recorded in spec.md's Clarifications section, not repeated here. This file covers the
remaining decisions needed to move from spec to design.

## 1. How does "Entire Corpus" fit into today's document-selector `<select>` elements?

**Decision**: A single shared sentinel string constant, `ENTIRE_CORPUS_SELECTION` (exported from a
new `frontend/src/lib/entireCorpusSelection.ts`), rendered as one extra `<option>` at the top of
the existing document `<select>` in `FixedSizeChunkingScreen`, `EmbeddingsScreen`, and
`VectorViewScreen`. The sentinel is a fixed literal (e.g. `"__entire-corpus__"`) that can never
collide with a real `Document.id` (server-generated UUIDs), so no schema or API change is needed
to distinguish "a document" from "the whole corpus" — the distinction is made entirely in
frontend selection state.

**Rationale**: All three screens already share the identical `<select>` markup pattern
(`documents.map(doc => <option value={doc.id}>{doc.name}</option>)`). A shared constant plus a
tiny `isEntireCorpus(value)` guard keeps the three screens' selectors visibly consistent and
avoids three independently-invented sentinel values drifting apart over time.

**Alternatives considered**: A separate boolean toggle next to the dropdown ("Entire Corpus"
checkbox/switch) instead of an in-dropdown option — rejected because the spec's acceptance
scenarios (User Stories 1, 2, 8) explicitly describe "Entire Corpus" as a selector *option*
("the document selector includes an Entire Corpus option"), and a second control would be a
bigger UI change than requested.

## 2. How does the shared sequential batch runner work, and what does it report?

**Decision**: One small utility, `runSequentialBatch<TDoc, TResult>(documents, runOne, onProgress)`
in `frontend/src/lib/batchRunner.ts`. It iterates `documents` in the order the corpus's existing
document list already returns them, `await`s `runOne(doc)` for each one in turn (never
concurrently), and calls `onProgress({ index, total, documentName })` before starting each
document. `runOne` wraps a screen's existing single-document operation (already a
Promise/callback-based streaming call) and resolves/rejects per document; a rejection is caught
by the runner, recorded against that document, and iteration continues to the next document
(never aborts the batch) — this is what satisfies FR-007/FR-021 ("skip and report", "complete and
save the documents that succeeded"). The overall percent shown to the user is computed as
`round(((index + currentDocPercent / 100) / total) * 100)`, combining the runner's document
position with that one document's own real backend-streamed progress — exactly the format
resolved by `/speckit-clarify` ("Processing document 3 of 12 (name.pdf)… 42%").

**Rationale**: `useFixedSizeChunking` and `useChunkEmbeddings` already each expose a per-document
streaming call with its own `onProgress`/`onResult`/`onError` callbacks
(`runChunkingStream`/`saveChunksStream`, `generateEmbeddingsStream`/`saveEmbeddingsStream`). A
generic runner that only needs "a function that resolves per document, with progress" is the
smallest abstraction that lets both hooks reuse one tested implementation of the loop, the
progress formula, and the partial-failure bookkeeping — instead of duplicating that logic twice
with a high chance of the two copies drifting (e.g. one hook aborting on first failure while the
other doesn't).

**Alternatives considered**: Duplicate the loop inline in each hook — rejected as unnecessary
duplication of non-trivial control flow (sequencing, progress math, partial-failure collection)
that both hooks need identically. A generator-based (`async function*`) runner was also
considered instead of a callback-based one; a plain callback (`onProgress`) was kept because it
matches the existing hooks' own callback-based streaming style more closely and needs no consumer
to understand `for await` iteration.

## 3. What does the Chunking/Embeddings screen show *while*, and *after*, an "Entire Corpus" run?

**Decision**: *While* running: the existing single-document progress bar area is replaced by one
combined progress bar plus the "Processing document X of N (name)" text (per clarification).
*After* completion: instead of rendering every chunk of every document (which would be
impractically long for a real multi-document corpus), the result area shows one summary row per
document — name, resulting chunk/embedding count, and a success or failure indicator (with the
failure reason, per FR-007/FR-021). Saving persists per-document exactly as a normal save would.

**Rationale**: The spec's User Story 1/2 acceptance scenarios describe the *outcome* ("every
document currently in the active corpus" gets chunked/embedded and saved) and the *progress feed*,
never a requirement to display every chunk's raw content simultaneously across documents — that
would not scale readably past a handful of documents and duplicates what the Vector View's new
per-document-grouped view (User Story 8) already exists to do once chunks are saved. This keeps
the change scoped to what the acceptance criteria actually require (YAGNI, Constitution Principle
III).

**Alternatives considered**: Rendering the full existing chunk-card list once per document,
concatenated — rejected as unreadable/unscalable for realistic corpus sizes and not required by
any acceptance scenario.

## 4. Why does "Save Chunks" progress require a backend contract change, while "Entire Corpus" does not?

**Decision**: Convert `POST /api/chunking/save` into `GET /api/chunking/save/stream` (SSE),
mirroring `/api/embeddings/save/stream` exactly: `documentId`/`chunkSize`/`overlap` become query
parameters (not a JSON body — `EventSource` can only issue GET requests), and the backend emits
`progress` events during the same page-by-page text-extraction work `run/stream` already reports
real progress for, then a terminal `result` event carrying the same `ChunkRunResponse` shape
`POST /save` used to return synchronously. `app/chunking/service.py`'s `stream_chunking` is
refactored to share its extraction+chunking generator with a new `save_chunks_stream`, which adds
persistence at the end — the exact reuse shape `app/embeddings/service.py`'s `_stream_embed` /
`stream_generate` / `save_embeddings` already establishes.

**Rationale**: FR-014 requires Save Chunks to show "the same" progress pattern the Embeddings
screen's Save already has, and the Assumptions section pins that down to "the same
progress-bar-plus-percentage pattern." Embeddings' save is genuinely streamed because it re-runs
per-chunk embedding computation; chunking's save re-runs the identical page-by-page PDF text
extraction that `run/stream` already streams progress for (see `stream_chunking`) — so making
`save` streamed too isn't cosmetic, it reuses real, already-measured progress rather than
inventing a fake animation. This is the one place in this feature where a backend contract
changes, and it's scoped narrowly to a single existing single-document endpoint — unlike "Entire
Corpus," which per `/speckit-clarify` stays a pure frontend loop over endpoints that already
exist unchanged.

**Alternatives considered**: Keep `POST /api/chunking/save` as a plain synchronous call and fake
an indeterminate/simulated progress bar client-side while awaiting it — rejected because it would
show progress percentages disconnected from real work, which is misleading for larger documents
where extraction genuinely takes time, and because the embeddings save/stream pattern already
proves the real-streaming approach is cheap to replicate here.

## 5. What library renders the Playground answer as Markdown, and how is script/HTML execution prevented?

**Decision**: `react-markdown` (latest major, compatible with React 19), used with its default
configuration — no `rehype-raw` plugin, no `dangerouslySetInnerHTML` anywhere in the rendering
path. `TurnBubble.tsx` renders `<ReactMarkdown>{turn.answer}</ReactMarkdown>` in place of the raw
`{turn.answer}` string.

**Rationale**: `react-markdown` parses Markdown into a syntax tree and renders it directly to React
elements — it does not interpret embedded raw HTML unless the `rehype-raw` plugin is explicitly
added, and it never uses `dangerouslySetInnerHTML`. That default behavior is exactly what FR-027
requires (embedded HTML/script content must render as inert text, never execute) with zero extra
sanitization code. Standard formatting — headings, emphasis, lists, inline/fenced code, links —
is supported out of the box, covering everything FR-026 lists as a minimum.

**Alternatives considered**: `marked` or `markdown-it` + `dangerouslySetInnerHTML` (optionally
with `dompurify`) — rejected as strictly more code and more attack surface (a sanitizer allowlist
to get right and keep right) for the same outcome `react-markdown`'s default AST-to-React
rendering already gives for free.

## 6. How does the Sources document table wrap long names without a bounded-width column to wrap into?

**Decision**: Switch the table from browser-default auto layout to `table-fixed`, with explicit
proportional width classes on the header cells (`DOCUMENT NAME` gets the majority share; `SIZE`,
`UPLOAD DATE`, `STATUS`, and the actions column stay narrow/fixed), and add `break-words` (Tailwind
for `overflow-wrap: break-word`) to the document-name `<td>`.

**Rationale**: The table today (`className="w-full text-left"`, default auto layout) lets columns
grow to fit their longest content — for an ordinary long name (with spaces) this alone would
usually wrap acceptably, but the edge case the spec calls out (one long unbroken token, e.g. a
filename with no spaces) has no natural break point, so the browser stretches the column instead
of wrapping, which is what forces the horizontal scroll. `table-fixed` gives the name column a
bounded width regardless of content length; `break-words` then lets even an unbroken token wrap
inside that bound rather than overflow it. This directly satisfies the Edge Case in spec.md.

**Alternatives considered**: `overflow-x: auto` on the table's container (keep horizontal
scrolling but scope it to the table) — rejected outright, since removing horizontal scrolling
entirely is the explicit ask (FR-002). Truncating with an ellipsis and a hover tooltip — rejected
because the spec explicitly asks for the name to wrap ("multiline"), not be shortened
(FR-001 says "full name... wrapped," not truncated).

## 7. How does the Corpora screen get each corpus's document list for the new per-row preview?

**Decision**: Reuse the existing `GET /api/sources/all` endpoint (already called once by
`CorpusDocumentsPanel` via `listAllSources()`, which returns every document with its
`corpusIds`), fetched once at the `CorporaScreen` level and grouped client-side by corpus id. Each
row slices its own group to the first 5 (by the existing list order) for display, with a
`Set<string>` of "expanded" corpus ids (local component state) controlling which rows show the
full list instead of the 5-item preview.

**Rationale**: No new backend endpoint or query parameter is needed — `listAllSources()` already
returns exactly the corpus-membership data every row's preview needs in one round trip, avoiding
N per-corpus requests just to render the list. This mirrors `CorpusDocumentsPanel`'s existing use
of the same call and keeps the change entirely presentational.

**Alternatives considered**: Call `listSources(corpusId)` once per row (N requests for N corpora)
— rejected as strictly worse (more round trips) for data the single existing `all` endpoint
already provides.
