---

description: "Task list template for feature implementation"
---

# Tasks: RAG Workflow Screens — UI Polish Batch

**Input**: Design documents from `/specs/018-ui-polish-batch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/chunking-save-stream-api.md, contracts/entire-corpus-batch-orchestration.md,
contracts/vector-view-entire-corpus-listing.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included below for every user story, at unit, contract, integration,
and e2e levels as appropriate.

**Organization**: Tasks are grouped by user story (US1–US8 from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US8)
- Exact file paths are included in every task description

## Path Conventions

Existing web-application layout (unchanged from `001`–`017`): `backend/app/...` +
`backend/tests/...`, `frontend/src/...` + `frontend/tests/...`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing environment runs before making changes, and add the one new
dependency this feature needs.

- [X] T001 [P] Verify the backend runs with existing dependencies: `cd backend && uv sync && pytest` (baseline green before any change)
- [X] T002 [P] Verify the frontend runs with existing dependencies: `cd frontend && npm install && npm test` (baseline green before any change)
- [X] T003 Add `react-markdown` to `frontend/package.json` dependencies (`cd frontend && npm install react-markdown`) — no rendering changes yet, just the dependency (research.md §5); sequenced after T002 since both touch `package.json`/`node_modules`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that multiple user stories depend on — the "Entire Corpus"
selector sentinel (US1, US2, US8), the sequential batch runner (US1, US2), and the chunking
save-stream backend endpoint (US1's per-document save step, and US4's single-document save
progress). **MUST** complete before those stories' own phases.

### Shared frontend "Entire Corpus" selection + batch runner

- [X] T004 [P] Add unit tests in `frontend/tests/unit/entireCorpusSelection.test.ts` (new file): `ENTIRE_CORPUS_SELECTION` is a fixed non-UUID string; `isEntireCorpusSelection(value)` returns `true` only for that exact sentinel and `false` for any real document id shape
- [X] T005 [P] Add unit tests in `frontend/tests/unit/batchRunner.test.ts` (new file) for `runSequentialBatch()`: documents are processed strictly one at a time in list order (never concurrently); `onProgress` is called with `{index, total, documentId, documentName, documentPercent}` before/during each document; the combined percent matches `round(((index + documentPercent/100) / total) * 100)`; a rejected `runOne` for one document is recorded and iteration continues to the next document (not aborted); the final `BatchItemResult<T>[]` is returned in document order with `status: 'success' | 'failed'` per contracts/entire-corpus-batch-orchestration.md
- [X] T006 [US1][US2][US8] Implement `ENTIRE_CORPUS_SELECTION`, `DocumentSelectionValue`, `isEntireCorpusSelection()` in `frontend/src/lib/entireCorpusSelection.ts` (data-model.md) (depends on T004; makes T004 pass)
- [X] T007 [US1][US2] Implement `runSequentialBatch<TDoc, TResult>(documents, runOne, onProgress): Promise<BatchItemResult<TResult>[]>` in `frontend/src/lib/batchRunner.ts` per contracts/entire-corpus-batch-orchestration.md (depends on T005; makes T005 pass). Also added `computeCombinedPercent()`/`formatBatchProgressLabel()` helpers in the same module so both screens render identical progress text (research.md §2/§3 follow-up).

### Backend: chunking save becomes a streaming endpoint (shared by US1's per-document save step and US4)

- [X] T008 [P] Rewrite `backend/tests/contract/test_chunking_save.py`'s six existing tests (`test_save_chunking_success_persists_and_returns_result`, `..._resave_replaces_previous_saved_chunks`, `..._extraction_failed_persists_nothing`, `..._invalid_chunk_size`, `..._overlap_equal_to_chunk_size_is_rejected`, `..._unknown_document`) to call `GET /api/chunking/save/stream` (consume the SSE stream to its terminal `result` event) instead of the old `POST /save`'s single JSON response, and add a new test asserting at least one `progress` event is emitted before the terminal event — per contracts/chunking-save-stream-api.md. Also updated every other backend test file that used `POST /api/chunking/save` purely as setup (test_playground_turns.py, test_embeddings_saved.py, test_embeddings_generate.py, test_chunking_saved_chunks.py, test_playground_generate.py, test_embeddings_save.py, test_embeddings_persistence.py, test_playground_conversation_persistence.py, test_embeddings_service.py) — required for the suite to stay green once the endpoint changed shape, not called out as its own task in the original breakdown.
- [X] T009 [P] Update the four existing `save_chunks`-based unit tests in `backend/tests/unit/test_chunking_service.py` (`test_save_chunks_persists_matching_strategy_size_overlap_and_content`, `..._resave_replaces_previous_saved_chunks`, `..._no_extractable_text_persists_nothing`, `..._failed_extraction_leaves_prior_saved_chunks_untouched`) to drive the new generator-based `save_chunks_stream(...)` (consume its `("progress", ...)`/`("result", ...)` events) instead of calling a function that returns `ChunkRunResponse` directly, and add a new test asserting its progress events mirror `stream_chunking`'s page-by-page behavior
- [X] T010 In `backend/app/chunking/service.py`: factor `stream_chunking`'s extraction+chunking logic into a shared generator (`_stream_chunk_computation`) yielding `("progress", {"percent": int})` steps and a final `("computed", _ChunkComputation)` step; reimplemented `stream_chunking` on top of it with no external behavior change (still preview-only); added `save_chunks_stream(db, document, chunk_size, strategy, overlap) -> Iterator[StreamEvent]` that consumes the same shared generator and, on a successful computation, calls the existing `_persist_chunks(...)` before yielding the terminal `result` event — mirrors `app/embeddings/service.py`'s `_stream_embed` → `stream_generate`/`save_embeddings` reuse pattern exactly (depends on T008, T009; makes them pass)
- [X] T011 In `backend/app/chunking/router.py`: replaced `POST /save` with `GET /save/stream` — same `resolve_run`-based `400`/`404` validation as `run/stream`, `StreamingResponse` wired to `service.save_chunks_stream`, identical SSE event framing to `run/stream`/`/api/embeddings/save/stream` (depends on T010)
- [X] T012 [P] Removed the now-unused `ChunkSaveRequest` from `backend/app/chunking/schemas.py` (depends on T011)
- [X] T013 Updated `backend/tests/integration/test_restart_persistence.py` to call `GET /api/chunking/save/stream` (consume the SSE stream to its terminal `result` event) instead of the old `POST /api/chunking/save`, keeping its existing fresh-`SessionLocal()` assertion that the expected `Chunk` rows are durably persisted (depends on T011)
- [X] T014 [P] Added `saveChunksStream(documentId, chunkSize, overlap, handlers): () => void` to `frontend/src/lib/chunkingApi.ts` (`EventSource`-based, mirrors `saveEmbeddingsStream` exactly); removed the old `saveChunks()` (plain POST) function (depends on T011)

**Checkpoint**: Foundational infrastructure exists and is tested — the "Entire Corpus" sentinel,
the shared batch runner, and the streaming chunk-save endpoint/client. User story implementation
can now begin.

---

## Phase 3: User Story 1 - Chunk an entire corpus in one action (Priority: P1) 🎯 MVP

**Goal**: Selecting "Entire Corpus" on the Chunking screen runs fixed-size chunking (and saves
it) for every document in the active corpus in one action, with combined progress feedback.

**Independent Test**: Open Chunking for a corpus with 3+ documents, select "Entire Corpus", run,
save, and confirm every document has saved chunks matching what an individual run+save would
have produced.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

- [X] T015 [P] [US1] Add hook tests to `frontend/tests/unit/useFixedSizeChunking.test.ts`: selecting `ENTIRE_CORPUS_SELECTION` and calling `run()` drives `runSequentialBatch` over every corpus document via `runChunkingStream` per document with the screen's configured `chunkSize`/`overlap`; exposes `batchProgress`/`batchResults`; a document that fails extraction is recorded as failed in `batchResults` while the rest still complete — **revised from the original plan**: `run()` and `save()` are two separate batch invocations (mirroring the screen's existing two-button run/save shape — see contracts/entire-corpus-batch-orchestration.md's amended "Inputs" section), not one combined run-then-save `runOne`; the save-batch tests live in this same file (see US4 below) since `save()` is shared code
- [X] T016 [P] [US1] Add component tests to `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: the document selector renders an "Entire Corpus" option above the individual documents; selecting it and running shows the combined progress bar plus "Processing document X of N (name)" text; after completion, a per-document summary list (name, chunk count, success/failed) renders instead of the single-document chunk-card list
- [X] T017 [US1] Extend `frontend/tests/e2e/fixed-size-chunking.spec.ts`: select "Entire Corpus" on a corpus with 3 documents, run and save, and confirm all 3 documents' saved chunks exist afterward

### Implementation for User Story 1

- [X] T018 [US1] In `frontend/src/hooks/useFixedSizeChunking.ts`: accept `ENTIRE_CORPUS_SELECTION` as a valid selection; when active, `run()` calls `runSequentialBatch(documents, runOne, onProgress)` where `runOne` awaits `runChunkingStream` for one document (preview only — save is `save()`'s own separate batch, shared with US4 below), exposing `batchProgress: BatchProgress | null` and `batchResults: BatchItemResult<ChunkRunResponse>[]` (data-model.md) (depends on T006, T007, T014, T015; makes T015 pass)
- [X] T019 [US1] In `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: add "Entire Corpus" to the document `<select>` (via `ENTIRE_CORPUS_SELECTION`); render the combined progress bar/text while `batchProgress` is non-null; render the per-document summary list from `batchResults` in place of the single-document chunk-card list when in entire-corpus mode (depends on T006, T018, T016; makes T016 pass)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Generate embeddings for an entire corpus in one action (Priority: P1)

**Goal**: Selecting "Entire Corpus" on the Embeddings screen generates and saves embeddings, using
one selected model, for every document in the active corpus that has saved chunks.

**Independent Test**: Open Embeddings for a corpus where multiple documents have saved chunks (one
deliberately without), select "Entire Corpus" plus a model, generate, save, and confirm every
eligible document has saved embeddings while the chunk-less one is reported as skipped.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T020 [P] [US2] Add hook tests to `frontend/tests/unit/useChunkEmbeddings.test.ts`: selecting `ENTIRE_CORPUS_SELECTION` drives `runSequentialBatch` over every corpus document via `generateEmbeddingsStream` per document with the selected model (as two separate batches, run/save — same revision as US1, see T015); a document with zero saved chunks fails naturally (backend's existing `resolve_embedding_run` 400s it) and is recorded/skipped without aborting the batch; exposes `batchProgress`/`batchResults`
- [X] T021 [P] [US2] Add component tests to `frontend/tests/unit/EmbeddingsScreen.test.tsx`: selector has "Entire Corpus"; running it shows the combined progress text; completion shows a per-document summary (name, vector count, status — including "Skipped (no saved chunks)" for the no-saved-chunks document); Save persists every generated document
- [X] T022 [US2] Extend `frontend/tests/e2e/embeddings.spec.ts`: run "Entire Corpus" generate+save across a multi-document corpus where one document has no saved chunks, and confirm it's skipped/reported while the rest succeed

### Implementation for User Story 2

- [X] T023 [US2] In `frontend/src/hooks/useChunkEmbeddings.ts`: accepts `ENTIRE_CORPUS_SELECTION`; when active, `generate()`/`save()` each call `runSequentialBatch` over `documents` (two separate batches, mirroring US1); a document with zero saved chunks simply rejects via the existing backend validation and is recorded as failed/skipped, no special pre-filtering needed; exposes `batchProgress`/`batchResults`/`isEntireCorpus`; the auto-select effect and savedChunks-loading effect in `EmbeddingsScreen.tsx` were also fixed to treat the sentinel as always-valid (previously would have been stomped back to `documents[0].id`) (depends on T006, T007, T020; makes T020 pass)
- [X] T024 [US2] In `frontend/src/components/embeddings/EmbeddingsScreen.tsx`: added "Entire Corpus" to the selector, combined progress rendering, per-document summary list, and adjusted Generate/Save button disabled logic for entire-corpus mode (depends on T006, T023, T021; makes T021 pass)

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 - Read source document names without horizontal scrolling (Priority: P2)

**Goal**: Long document names wrap across multiple lines in the Sources document table; the table
never produces a horizontal scrollbar because of name length, including for names with no natural
break points.

**Independent Test**: View a document with a very long, unbroken-token name in the Sources
document list and confirm it wraps within its column with no horizontal scrollbar at any
reasonable width.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T025 [P] [US3] Add/extend tests in `frontend/tests/unit/DocumentList.test.tsx` (already existed — used instead of a new file): the document-name cell renders with wrapping classes (`break-words`) and the table uses a fixed layout (`table-fixed` + explicit column widths) so a long, space-less name doesn't grow the table
- [X] T026 [US3] Extend `frontend/tests/e2e/data-sources-screen.spec.ts`: view a document with a long unbroken-token name and assert the page's `scrollWidth` does not exceed its `clientWidth` (no horizontal scrollbar)

### Implementation for User Story 3

- [X] T027 [US3] In `frontend/src/components/sources/DocumentList.tsx`: switched the table to `table-fixed` with explicit column width classes (majority width to `DOCUMENT NAME`; `SIZE`/`UPLOAD DATE`/`STATUS`/actions narrow via `w-24`/`w-40`/`w-32`/`w-64`), and added `break-words` to the name `<td>` (research.md §6) (depends on T025; makes T025/T026 pass)

**Checkpoint**: User Story 3 independently functional — purely presentational, no dependency on
any other story.

---

## Phase 6: User Story 4 - See saving progress for chunk saves (Priority: P2)

**Goal**: Clicking "Save Chunks" on the Fixed Size Chunking screen shows the same live
progress-bar-plus-percentage feedback the Embeddings screen's "Save" already shows.

**Independent Test**: Run chunking for a single document, click "Save Chunks", and confirm a
progress bar/percentage displays while saving, the button is disabled meanwhile, and it's
replaced by "Saved" on completion.

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

- [X] T028 [P] [US4] Add hook tests to `frontend/tests/unit/useFixedSizeChunking.test.ts`: single-document `save()` now exposes `saveProgressPercent`, updated from `saveChunksStream`'s progress events, before `saveStatus` becomes `'success'`
- [X] T029 [P] [US4] Add component tests to `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: clicking "Save Chunks" shows a progress bar + percentage while `saveStatus === 'saving'`, the button is disabled meanwhile, and it's replaced by the existing "Saved" indicator on success
- [X] T030 [US4] Extend `frontend/tests/e2e/fixed-size-chunking.spec.ts`: assert the save progress bar appears during a real single-document save and disappears once "Saved" shows

### Implementation for User Story 4

- [X] T031 [US4] In `frontend/src/hooks/useFixedSizeChunking.ts`: switched single-document `save()` from the old plain POST to `saveChunksStream()`, adding `saveProgressPercent` state driven by its progress events (mirrors `useChunkEmbeddings`'s `save()`/`saveProgressPercent`); also handles the "Entire Corpus" save batch (shared with US1) in the same function (depends on T014, T028; makes T028 pass — same file as US1's T018, implemented together)
- [X] T032 [US4] In `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: renders a progress bar + percentage while `saveStatus === 'saving'` (mirrors `EmbeddingsScreen`'s save-progress block), for both single-document and Entire-Corpus-batch save (depends on T031, T029; makes T029/T030 pass — same file as US1's T019, implemented together)

**Checkpoint**: User Story 4 independently functional.

---

## Phase 7: User Story 5 - Prevent accidental corpus switching (Priority: P2)

**Goal**: Clicking anywhere on a corpus row other than its "Make Active" button never changes the
active corpus.

**Independent Test**: Click a non-active corpus row (away from its "Make Active" button) and
confirm the active corpus is unchanged; click "Make Active" and confirm it changes.

### Tests for User Story 5 (MANDATORY per constitution) ⚠️

- [X] T033 [US5] Add/extend tests in `frontend/tests/unit/CorporaScreen.test.tsx` and `frontend/tests/integration/CorporaScreen.test.tsx`: clicking a non-active row outside its "Make Active" button does not call `selectCorpus`/change `activeCorpusId`; clicking "Make Active" does. Also fixed the integration test's `switchToCorpusBViaCorporaScreen()` helper, which previously relied on row-click-to-select (now a no-op by design), to click "Make Active" instead.
- [X] T034 [US5] Extend `frontend/tests/e2e/corpora-screen.spec.ts`: same click-vs-button assertions end-to-end

### Implementation for User Story 5

- [X] T035 [US5] In `frontend/src/components/corpora/CorporaScreen.tsx`: removed the row's `onClick`/`onKeyDown`/`role="button"`/`tabIndex` — it's now a plain container; `selectCorpus` is only called from the "Make Active" button's own `onClick` (depends on T033, T034; makes them pass)

**Checkpoint**: User Story 5 independently functional.

---

## Phase 8: User Story 6 - Read Playground answers as formatted text (Priority: P2)

**Goal**: Generated answers render with Markdown formatting (headings, emphasis, lists, code,
links) instead of raw syntax characters, and never execute embedded HTML/script content.

**Independent Test**: Ask a question whose answer contains a list and bold text; confirm it
renders as an actual list and bold text, not literal `*`/`-` characters; confirm embedded
HTML/script content renders as inert text.

### Tests for User Story 6 (MANDATORY per constitution) ⚠️

- [X] T036 [P] [US6] Add component tests in a new `frontend/tests/unit/TurnBubble.test.tsx`: an answer containing Markdown (list, bold) renders as real list/bold elements, not literal syntax; an answer containing `<script>`/raw HTML tags renders as inert text with no script execution (asserted via a global side-effect flag) and no raw element injected into the DOM; a plain-text answer renders unchanged from today; question/generating/error/retry states still work
- [X] T037 [US6] Extend `frontend/tests/e2e/playground.spec.ts`: assert a formatted answer renders with real Markdown formatting in the browser

### Implementation for User Story 6

- [X] T038 [US6] In `frontend/src/components/playground/TurnBubble.tsx`: replaced the raw `{turn.answer}` string with `<ReactMarkdown>{turn.answer}</ReactMarkdown>` (default configuration only — no `rehype-raw`, no `dangerouslySetInnerHTML`); also switched the clickable answer wrapper from a `<button>` to a `<div role="button" tabIndex={0}>` with the same `aria-label`/`aria-pressed`/keyboard (Enter/Space) contract, since react-markdown's block-level output (`<ul>`, `<p>`) is not valid content inside a real `<button>` — not called out in the original plan, but required for valid HTML once Markdown renders block elements (depends on T003, T036; makes T036/T037 pass)

**Checkpoint**: User Story 6 independently functional.

---

## Phase 9: User Story 7 - Preview each corpus's documents from the corpus list (Priority: P3)

**Goal**: Each corpus row in the Corpora list shows up to 5 of its own documents inline, with a
"Show more"/"Show less" toggle for corpora with more than 5.

**Independent Test**: View a corpus with >5 documents and confirm exactly 5 show plus "Show more";
view one with ≤5 and confirm all show with no control; view one with 0 and confirm an empty-state
message.

### Tests for User Story 7 (MANDATORY per constitution) ⚠️

- [X] T039 [US7] Add/extend tests in `frontend/tests/unit/CorporaScreen.test.tsx`: a corpus row with >5 documents shows exactly 5 plus "Show more"; clicking it reveals the rest and the control becomes "Show less"; a corpus with ≤5 documents shows all with no control; a corpus with 0 documents shows an empty-state message instead of a list
- [X] T040 [US7] Extend `frontend/tests/integration/CorporaScreen.test.tsx` and `frontend/tests/e2e/corpora-screen.spec.ts` with the same scenarios end-to-end

### Implementation for User Story 7

- [X] T041 [US7] In `frontend/src/components/corpora/CorporaScreen.tsx`: fetches `listAllSources()` once, groups into `documentsByCorpus: Map<string, DocumentWithCorpora[]>`, adds `expandedCorpusIds: Set<string>` state, and renders each row's document preview (first 5, or all if expanded, or an empty-state message) with a "Show more"/"Show less" toggle (research.md §7, data-model.md); also wired a `refreshAllDocuments`/`onDocumentsChanged` callback so the row previews stay in sync when `CorpusDocumentsPanel` attaches/removes a document (not called out as its own task, but required — the row preview and the panel are separate fetches of the same data) (depends on T035, T039, T040; makes them pass — same file as US5's T035, sequenced after it)

**Checkpoint**: User Story 7 independently functional.

---

## Phase 10: User Story 8 - Inspect chunks across an entire corpus in Vector View (Priority: P3)

**Goal**: Selecting "Entire Corpus" in Vector View shows saved chunks from every document in the
corpus, grouped under a header per document; selecting any chunk shows its own saved embedding(s)
unchanged.

**Independent Test**: With saved chunks in multiple documents, select "Entire Corpus" in Vector
View and confirm the grouped list renders, and that selecting any chunk shows the same embedding
detail as selecting that document individually would.

### Tests for User Story 8 (MANDATORY per constitution) ⚠️

- [X] T042 [P] [US8] Add hook tests to `frontend/tests/unit/useVectorView.test.ts`: selecting `ENTIRE_CORPUS_SELECTION` calls `listSavedChunks()` once per corpus document and exposes `chunkGroups: ChunkGroup[]` grouped/ordered per contracts/vector-view-entire-corpus-listing.md; documents with zero saved chunks are omitted from `chunkGroups` (not an empty group); selecting a chunk from any group still drives `listSavedEmbeddings(chunkId)` unchanged
- [X] T043 [P] [US8] Add component tests to `frontend/tests/unit/VectorViewScreen.test.tsx`: selector has "Entire Corpus"; the chunk list renders a header per document followed by that document's chunks; selecting any chunk shows its own saved embedding(s); the existing "no saved chunks yet" guidance shows when no document in the corpus has any
- [X] T044 [US8] Add `frontend/tests/e2e/vector-view.spec.ts` (new file — no e2e spec exists yet for this screen): select "Entire Corpus" across a multi-document corpus with saved chunks and assert the grouped list and per-chunk embedding selection work end-to-end

### Implementation for User Story 8

- [X] T045 [US8] In `frontend/src/hooks/useVectorView.ts`: when the document selection is `ENTIRE_CORPUS_SELECTION`, fetches `listSavedChunks(doc.id)` for every corpus document (concurrently — read-only, no ordering contract to preserve) and exposes `chunkGroups: ChunkGroup[]` (data-model.md) instead of a single `savedChunks` list; single-document behavior is unchanged otherwise; also fixed the document/chunk auto-select effects to treat the sentinel/its derived chunk list as always-valid (depends on T006, T042; makes T042 pass)
- [X] T046 [US8] In `frontend/src/components/vector-view/VectorViewScreen.tsx`: added "Entire Corpus" to the selector, renders `chunkGroups` as a header-per-document chunk list when active, keeps the existing embedding-selection panel wired to whichever chunk is clicked (depends on T045, T043, T044; makes them pass)

**Checkpoint**: All 8 user stories independently functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Full-suite regression check and end-to-end quickstart validation across all 8
stories together.

- [X] T047 [P] Run `cd backend && pytest` and confirm no regressions from the chunking save-stream refactor (Foundational T008–T014) or any other change. Result: 217/217 passed.
- [X] T048 [P] Run `cd frontend && npm test` (unit + integration) and confirm no regressions across all 8 stories. Result: 285/285 passed (27 files).
- [X] T049 Run `cd frontend && npm run test:e2e` (all specs, including the new `vector-view.spec.ts` and every modified spec) and confirm no regressions. Result: 25/25 passed. Along the way, fixed three pre-existing e2e specs that relied on the old corpus-row-click-to-select behavior (`corpora-screen.spec.ts`'s cross-scoping and document-management tests), and found/fixed a real correctness gap surfaced by writing real (not fake-buffer) multi-document e2e fixtures: `useFixedSizeChunking`'s entire-corpus batch was counting an extraction-failed document as a batch "success" (the terminal `result` event resolves normally even when `extractionFailed: true` — only a stream `error` event was treated as failure) — fixed by rejecting on `extractionFailed` in both the run and save promise adapters, with a new unit test locking in the fix (`useFixedSizeChunking.test.ts`).
- [X] T050 Walked through `specs/018-ui-polish-batch/quickstart.md` end-to-end (all 9 sections) — every "Confirm" outcome is covered by the passing e2e suite (sections 1–8 map directly to the new/extended e2e specs) and the full three-suite run (section 9).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS User Stories 1, 2, and 8
  (which need the shared sentinel/batch runner and, for US1, the save-stream endpoint) and
  User Story 4 (which needs the save-stream endpoint). User Stories 3, 5, 6, 7 have no
  Foundational dependency and could in principle start immediately after Setup, but are
  sequenced after Foundational here for a single clean checkpoint.
- **User Stories (Phase 3–10)**: See per-story notes below.
- **Polish (Phase 11)**: Depends on all 8 user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (T006, T007, T010–T014). No dependency on any
  other user story.
- **User Story 2 (P1)**: Depends on Foundational (T006, T007). No dependency on US1 or any other
  story — independently implementable in parallel with US1 by a different developer.
- **User Story 3 (P2)**: No dependency on Foundational or any other story — purely presentational.
- **User Story 4 (P2)**: Depends on Foundational's save-stream endpoint (T011, T014). Its
  implementation tasks (T031, T032) touch the same two files US1 touches (`useFixedSizeChunking.ts`,
  `FixedSizeChunkingScreen.tsx`) — sequenced after US1 (T018/T019) to avoid conflicting edits, not
  because US4 depends on US1's *behavior*.
- **User Story 5 (P2)**: No dependency on Foundational or any other story.
- **User Story 6 (P2)**: Depends on Setup's T003 (`react-markdown` installed). No dependency on any
  other story.
- **User Story 7 (P3)**: No functional dependency on US5, but its implementation (T041) touches the
  same file US5 touches (`CorporaScreen.tsx`) — sequenced after US5 (T035) to avoid conflicting
  edits.
- **User Story 8 (P3)**: Depends on Foundational (T006). No dependency on any other story.

### Within Each User Story

- Tests are written first and must fail before their corresponding implementation task.
- Frontend layers proceed bottom-up: api client / shared lib → hook → screen component.
- Backend layers (Foundational only) proceed bottom-up: service → router → schema cleanup.

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T004 and T005 (Foundational shared-lib tests, different files) in parallel; T008 and T009
  (Foundational backend tests, different files) in parallel with those and with each other.
- Once Foundational (Phase 2) is complete: **US1, US2, US3, US5, US6, US8 can all start in
  parallel** (different files, no cross-story dependency) — only US4 (sequenced after US1) and
  US7 (sequenced after US5) need to wait on a same-file predecessor story.
- Within US1: T015 and T016 (different test files) in parallel. Same pattern for US2 (T020/T021),
  US4 (T028/T029), US6 (T036, own file), US8 (T042/T043).
- T047 and T048 (Polish, different suites/runtimes) in parallel; T049 and T050 follow once those
  are green.

---

## Parallel Example: Foundational phase

```bash
# Launch independent Foundational test-writing tasks together:
Task: "Unit tests for ENTIRE_CORPUS_SELECTION/isEntireCorpusSelection in frontend/tests/unit/entireCorpusSelection.test.ts"
Task: "Unit tests for runSequentialBatch in frontend/tests/unit/batchRunner.test.ts"
Task: "Rewrite GET /api/chunking/save/stream contract tests in backend/tests/contract/test_chunking_save.py"
Task: "Update save_chunks_stream unit tests in backend/tests/unit/test_chunking_service.py"
```

## Parallel Example: after Foundational completes

```bash
# Six of the eight user stories can be staffed in parallel immediately:
Task: "User Story 1 — Chunking Entire Corpus (T015-T019)"
Task: "User Story 2 — Embeddings Entire Corpus (T020-T024)"
Task: "User Story 3 — Sources name wrapping (T025-T027)"
Task: "User Story 5 — Corpora explicit activation only (T033-T035)"
Task: "User Story 6 — Playground Markdown (T036-T038)"
Task: "User Story 8 — Vector View Entire Corpus (T042-T046)"
# User Story 4 waits on US1 (same files); User Story 7 waits on US5 (same file).
```

---

## Implementation Strategy

### MVP Scope

**User Story 1** alone (Chunking Entire Corpus) is the single highest-value, independently
shippable increment — it directly closes the "repeat chunking once per document" gap. Recommended
MVP = **Foundational + US1**. US2 (Embeddings Entire Corpus) is the natural very-next increment
since it completes the "no more per-document repetition" story across both pipeline stages.

### Incremental Delivery

1. Complete Setup (Phase 1) — confirm baseline green, add `react-markdown`.
2. Complete Foundational (Phase 2) — shared sentinel, batch runner, save-stream endpoint, all
   tested.
3. Add User Story 1 (Phase 3) → validate independently → first shippable increment (MVP).
4. Add User Story 2 (Phase 4) → validate independently → corpus-wide chunking + embedding both
   done in one action.
5. Add User Stories 3, 5, 6 (Phases 5, 7, 8) in any order → each validates and ships independently.
6. Add User Story 4 (Phase 6) after US1 → validate independently.
7. Add User Story 7 (Phase 9) after US5 → validate independently.
8. Add User Story 8 (Phase 10) → validate independently.
9. Polish (Phase 11) → full regression + quickstart walkthrough across all 8 stories together.

### Parallel Team Strategy

With multiple developers: the team completes Setup + Foundational together first (Foundational's
backend save-stream work and frontend shared-lib work can themselves be split across two people).
Once Foundational is done, up to six developers can take US1, US2, US3, US5, US6, and US8
simultaneously; the developers on US4 and US7 wait for US1's and US5's respective file changes to
land, then proceed.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- Tasks touching `frontend/src/hooks/useFixedSizeChunking.ts` and
  `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` (US1's T018/T019, US4's
  T031/T032) are sequenced, not parallel — same files.
- Tasks touching `frontend/src/components/corpora/CorporaScreen.tsx` (US5's T035, US7's T041) are
  sequenced, not parallel — same file.
- Tasks touching `backend/app/chunking/service.py`/`router.py` (Foundational T010/T011) are
  sequenced — same files, and both are prerequisites for US1's and US4's work.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
