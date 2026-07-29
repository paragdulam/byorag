---

description: "Task list template for feature implementation"
---

# Tasks: Chunk Preview Structure & UI Fixes

**Input**: Design documents from `/specs/022-chunk-preview-ui-fixes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app per plan.md: `backend/app/...`, `backend/tests/...`, `frontend/src/...`, `frontend/tests/...`

---

## Phase 1: Setup (Shared Infrastructure)

No new dependencies are needed for this feature (plan.md Technical Context — no new backend or
frontend packages). Proceed directly to the user story phases below.

---

## Phase 2: Foundational (Blocking Prerequisites)

No cross-story blocking prerequisites are required. Each user story touches independent files: US1
is a self-contained CSS/layout fix, US2 adds a new backend endpoint plus new frontend modules, and
US3 introduces new shared components consumed by (but not blocking) the other two stories. Proceed
directly from Phase 1 to the user story phases below.

---

## Phase 3: User Story 1 - Readable Document List in Sources (Priority: P1) 🎯 MVP

**Goal**: Document names wrap onto multiple lines instead of clipping/overflowing; rows grow to fit
wrapped content.

**Independent Test**: Open Sources with a long-named document and confirm it wraps fully within its
column with no truncation/overflow, and the row grows to fit it.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T001 [P] [US1] Unit test for `frontend/tests/unit/DocumentList.test.tsx` — a long document name wraps onto multiple lines (no truncation, no horizontal overflow), a row with a wrapped name grows taller than a row with a short name, and other cells stay aligned per row (contracts/ui-contracts.md `DocumentList`)

### Implementation for User Story 1

- [X] T002 [US1] Update `frontend/src/components/sources/DocumentList.tsx` so the document-name column wraps long names (adjust/remove `table-fixed` column-width assumptions, shrink the now-oversized actions column now that attach/remove-from-corpus controls are commented out, and wrap the table in an `overflow-x-auto` container as a safety net for unbroken long tokens) — depends on T001 failing first

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Chunked Preview Shows the Document as a Continuous, Structured Read (Priority: P2)

**Goal**: Chunked Preview renders as one continuous, structurally-classified document with chunk
boundaries shown purely via inline background color (including a distinct overlap color), backed by
a new backend endpoint that recomputes structure-preserving text and chunk offsets on demand.

**Independent Test**: Open Chunked Preview for a document chunked with `overlap > 0` and confirm a
continuous flow (no cards/borders/gaps), colors changing exactly at chunk boundaries (even mid-word),
and a distinct color for the overlapping span.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US2] Contract test for `GET /api/chunking/structured-preview` in `backend/tests/contract/test_chunking_structured_preview.py` — a document chunked with `overlap > 0` returns `fullText` plus ordered, contiguous, non-overlapping `segments` including at least one `"overlap"`-kind segment; `overlap = 0` produces zero `"overlap"` segments; unknown `documentId` → `404`; a document with zero saved chunks → `404`; a document whose stored file is missing → `404` (contracts/chunking-structured-preview-api.md)
- [X] T004 [P] [US2] Unit test for `classifyBlocks` in `frontend/tests/unit/chunkStructure.test.ts` — a standalone short line becomes a `heading` block, consecutive bullet/number-prefixed lines become `list-item` blocks sharing one `listGroupId`, consecutive non-blank lines merge into one `paragraph` block, and every block's `[startOffset, endOffset)` is a valid slice of the input text (contracts/ui-contracts.md `classifyBlocks`)
- [X] T005 [P] [US2] Unit test for `colorBlocks` in `frontend/tests/unit/chunkStructure.test.ts` — a block spanning two `chunkIndex` segments splits into two correctly-colored spans at the exact boundary (including mid-word), a block containing an `"overlap"` segment renders that portion with the reserved overlap color, and the same `chunkIndex` resolves to the same color across separate blocks (contracts/ui-contracts.md `colorBlocks`)
- [X] T006 [P] [US2] Rewrite unit tests for `frontend/tests/unit/ChunkedMarkdownView.test.tsx` — renders one continuous flow with no per-chunk containers/borders/gaps, colors change exactly at chunk boundaries, a heading/list cue renders as such, an overlap span uses the reserved color, the existing "no chunks yet" empty state is unchanged, and the PDF/Chunked Preview toggle is unchanged

### Implementation for User Story 2

- [X] T007 [US2] Implement structured-preview computation in `backend/app/chunking/service.py` — re-extract the document's text preserving original structure (reuse `extract_text_pages`, joined without collapsing whitespace), tokenize words with `re.finditer(r"\S+", fullText)` to get position-tracked word offsets, recompute each saved chunk's word range via its persisted `chunk_size`/`overlap`/`strategy` (`stride = chunk_size - overlap`), and build the ordered, non-overlapping `segments` list (a word claimed by 2+ chunks resolves to a single `"overlap"` segment, per research.md §2) — depends on T003 failing first
- [X] T008 [US2] Implement `GET /api/chunking/structured-preview` in `backend/app/chunking/router.py`, plus `StructuredPreviewResponse`/`PreviewSegment` in `backend/app/chunking/schemas.py` — wires the three `404` cases (unknown document, zero saved chunks, missing file) from contracts/chunking-structured-preview-api.md — depends on T007
- [X] T009 [P] [US2] Add `fetchStructuredPreview` to `frontend/src/lib/chunkingApi.ts`
- [X] T010 [P] [US2] Add `OVERLAP_COLOR`/`OVERLAP_TEXT_COLOR` constants and `assignColorsByChunkIndex` to `frontend/src/lib/chunkColorPalette.ts` (data-model.md `ChunkColorAssignment`) — depends on T005 failing first
- [X] T011 [US2] Implement `classifyBlocks` in `frontend/src/lib/chunkStructure.ts` (lightweight heading/list/paragraph heuristic per research.md §3) — depends on T004 failing first
- [X] T012 [US2] Implement `colorBlocks` in `frontend/src/lib/chunkStructure.ts` (intersects each block's offset range with `segments` to produce ordered `BlockColorSpan[]` per block, per research.md §4) — depends on T005 failing first, T010, T011
- [X] T013 [US2] Rewrite `frontend/src/components/sources/ChunkedMarkdownView.tsx` to fetch `GET /api/chunking/structured-preview` (via T009), classify blocks (T011) and color them (T012), and render one continuous flow of semantic elements (`<h3>`, `<p>`, grouped `<ul>`/`<li>`) with inline colored `<span>` children — no `react-markdown`, no per-chunk containers — preserving the existing empty state and PDF/Chunked-Preview toggle — depends on T006 failing first, T008, T009, T012

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Consistent "Entire Corpus" Experience Across Chunking and Embeddings (Priority: P3)

**Goal**: Embeddings' "Entire Corpus" progress, already-done, and results presentation match Fixed
Size Chunking's, via three new shared components (Chunking is the reference design).

**Independent Test**: Select "Entire Corpus" on both screens for equivalent states (already-done,
in-progress, completed-with-results, per-document failure) and confirm identical presentation.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T014 [P] [US3] Unit test for `frontend/tests/unit/BatchProgressBar.test.tsx` — renders the combined percentage and "Processing document X of N (name)" label from a `BatchProgress` value (contracts/ui-contracts.md `BatchProgressBar`)
- [X] T015 [P] [US3] Unit test for `frontend/tests/unit/AlreadyDoneIndicator.test.tsx` — renders a single line using the given `verb`/`noun`/`scope` props (e.g. "Chunking already performed for this document/corpus…", "Embedding generation already performed for this document/corpus…")
- [X] T016 [P] [US3] Unit test for `frontend/tests/unit/EntireCorpusSummaryList.test.tsx` — renders one row per `BatchItemResult`, success rows using the caller's `formatSuccessLabel`, failure rows showing the error message, identically regardless of caller
- [X] T017 [P] [US3] Update `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` for the shared-component refactor — same observable behavior/testids as today, now rendered via `BatchProgressBar`/`AlreadyDoneIndicator`/`EntireCorpusSummaryList`
- [X] T018 [P] [US3] Update `frontend/tests/unit/EmbeddingsScreen.test.tsx` — the previous bespoke per-document `existingEmbeddingsSummary` breakdown block is replaced by the shared `AlreadyDoneIndicator` (single line, matching Chunking's pattern), and progress/results use the same shared components as Chunking

### Implementation for User Story 3

- [X] T019 [P] [US3] Create `frontend/src/components/shared/BatchProgressBar.tsx` (data-model.md shared component table) — depends on T014 failing first
- [X] T020 [P] [US3] Create `frontend/src/components/shared/AlreadyDoneIndicator.tsx` — depends on T015 failing first
- [X] T021 [P] [US3] Create `frontend/src/components/shared/EntireCorpusSummaryList.tsx` — depends on T016 failing first
- [X] T022 [US3] Update `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` to render its Entire Corpus progress/already-done/results via the three shared components instead of inline markup (behavior-preserving refactor — Chunking is the reference design, its observable behavior does not change) — depends on T017 failing first, T019, T020, T021
- [X] T023 [US3] Update `frontend/src/components/embeddings/EmbeddingsScreen.tsx` to render via the same three shared components, replacing the bespoke `existingEmbeddingsSummary` per-document breakdown with `AlreadyDoneIndicator` driven by a boolean ("does at least one document/chunk already have data for the selected model") derived from `existingEmbeddingsSummary` — depends on T018 failing first, T019, T020, T021

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories

- [X] T024 [P] Run every scenario in `specs/022-chunk-preview-ui-fixes/quickstart.md` end-to-end against the running stack — completed via `browser-harness` against the live dev stack (localhost:5173/8000), a real corpus, and a real chunked-with-overlap document. Found and fixed two real bugs the unit-test-only pass had missed:
  1. **US1**: the document-name `<button>` (rendered when `onSelectDocument` is provided) is `display: inline-block` by default, so it shrink-to-fit its content instead of respecting the `<td>`'s width — the name overflowed horizontally into the SIZE/UPLOAD DATE/STATUS columns and the action buttons instead of wrapping. Fixed in `DocumentList.tsx` by adding `block w-full` to the button's className. Also widened the STATUS column (`w-24` → `w-32`) since the "PROCESSED" chip (~104px) didn't fit in 96px and was spilling into the actions column; DOCUMENT NAME switched to `w-auto` so it still gets all the leftover space.
  2. **US3**: on Embeddings with Entire Corpus selected and no fresh generate/save run yet this session, the correct `AlreadyDoneIndicator` rendered, but the single-document fallback block (`savedChunks`/`preview`) rendered unconditionally underneath it, showing a confusing "No saved chunks for this document yet. Save chunks from the Chunking screen first." — wrong, since a corpus was selected, not a document. Fixed in `EmbeddingsScreen.tsx` by gating that fallback branch on `!isEntireCorpus`. Added a regression test to `EmbeddingsScreen.test.tsx`.
  US2 (structured preview) was verified directly against a real document: continuous flow confirmed (no per-chunk containers), overlap color observed at ~10.7% of rendered text against an analytically-expected ~10.76% for this document's `chunk_size=512`/`overlap=50`/200 chunks, and list-item blocks detected (28); no heading blocks occurred in this particular document's text (plausible given its structure, not re-tested against a heading-rich fixture).

  **Follow-up correction (post-QA, user-reported)**: the fix above only removed the stray message —
  it left the Entire Corpus "already done" state showing the indicator with nothing below it, which
  the user pointed out still didn't match Chunking's screen (which shows the indicator *and* an
  immediate per-document chunk-count list, with no action required). FR-011 was corrected to require
  both. Fixed in `EmbeddingsScreen.tsx` by adding a third branch to the `embeddings-chunk-list`
  render (after the `saveBatchResults`/`generateBatchResults` branches, before the `!isEntireCorpus`
  fallback): when `isEntireCorpus && existingEmbeddingsSummary.length > 0`, map
  `existingEmbeddingsSummary` into `EntireCorpusSummaryList`'s `BatchItemResult`-shaped input
  (`status: 'success'`, `result: item`) with `formatSuccessLabel` rendering
  `"${existingCount} of ${totalChunks} embeddings saved"`. Verified visually against the live stack
  with 7 real documents — output now matches Chunking's list exactly (one row per document, correct
  counts, no fresh run required). `quickstart.md` and `spec.md` FR-011 updated to describe the full
  (indicator + list) expected behavior instead of indicator-only.
- [X] T025 Run the full backend (`pytest`) and frontend (`vitest run`) suites once more to confirm no regressions across all three stories, after the T024 fixes (including the FR-011 follow-up) — frontend: 387/389 passing (2 pre-existing failures in `DataSourcesScreen.test.tsx` unrelated to this feature, attach/remove-from-corpus UI is commented out); backend: 261/282 passing (21 failures are the pre-existing DB test-pollution issue on `documents_content_hash_key`, confirmed via `git stash` to exist identically on `main`, unrelated to this feature)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A for this feature (no new dependencies)
- **Foundational (Phase 2)**: N/A for this feature (no cross-story blocking prerequisites)
- **User Stories (Phase 3-5)**: Fully independent of each other — US1, US2, and US3 touch disjoint
  files (Sources list CSS; chunking backend + `ChunkedMarkdownView`; shared components + the two
  screens that consume them)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories
- **User Story 2 (P2)**: No dependency on other stories
- **User Story 3 (P3)**: No dependency on other stories — note that `FixedSizeChunkingScreen.tsx`
  (touched by T022) is read but not modified by User Story 1 or 2, so no file conflict exists

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend computation before the endpoint that exposes it (US2: T007 before T008)
- API client / palette / block-classification helpers before the component that consumes them
  (US2: T009/T010/T011 before T012, T012 before T013)
- Shared components before the screens that adopt them (US3: T019-T021 before T022/T023)
- Story complete before moving to the next priority

### Parallel Opportunities

- All test tasks within a story marked [P] run in parallel with each other
- US1, US2, and US3 can be implemented in parallel by different developers — no shared files
- Within US2: T009 and T010 run in parallel with each other and with T011 (different files)
- Within US3: T019, T020, and T021 run in parallel with each other

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test for GET /api/chunking/structured-preview in backend/tests/contract/test_chunking_structured_preview.py"
Task: "Unit test for classifyBlocks in frontend/tests/unit/chunkStructure.test.ts"
Task: "Unit test for colorBlocks in frontend/tests/unit/chunkStructure.test.ts"
Task: "Rewrite unit tests for ChunkedMarkdownView in frontend/tests/unit/ChunkedMarkdownView.test.tsx"

# Once tests are failing, launch independent implementation pieces together:
Task: "Add fetchStructuredPreview to frontend/src/lib/chunkingApi.ts"
Task: "Add OVERLAP_COLOR/OVERLAP_TEXT_COLOR and assignColorsByChunkIndex to frontend/src/lib/chunkColorPalette.ts"
Task: "Implement classifyBlocks in frontend/src/lib/chunkStructure.ts"
```

## Parallel Example: User Story 3

```bash
# Launch all tests for User Story 3 together:
Task: "Unit test for BatchProgressBar in frontend/tests/unit/BatchProgressBar.test.tsx"
Task: "Unit test for AlreadyDoneIndicator in frontend/tests/unit/AlreadyDoneIndicator.test.tsx"
Task: "Unit test for EntireCorpusSummaryList in frontend/tests/unit/EntireCorpusSummaryList.test.tsx"

# Once failing, build all three shared components together:
Task: "Create frontend/src/components/shared/BatchProgressBar.tsx"
Task: "Create frontend/src/components/shared/AlreadyDoneIndicator.tsx"
Task: "Create frontend/src/components/shared/EntireCorpusSummaryList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1
2. **STOP and VALIDATE**: Confirm long document names wrap and rows resize independently
3. Deploy/demo if ready

### Incremental Delivery

1. Add User Story 1 → test independently → deploy/demo (MVP!)
2. Add User Story 2 → test independently → deploy/demo
3. Add User Story 3 → test independently → deploy/demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers, all three stories can start immediately (no shared files):
- Developer A: User Story 1 (fastest to ship — isolated CSS fix)
- Developer B: User Story 2 (backend endpoint + new frontend structure/color modules + component rewrite)
- Developer C: User Story 3 (three shared components + refactor of both screens)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
