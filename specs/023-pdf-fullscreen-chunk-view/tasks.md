---

description: "Task list template for feature implementation"
---

# Tasks: PDF Fullscreen Reading & In-Context Chunk Preview

**Input**: Design documents from `/specs/023-pdf-fullscreen-chunk-view/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Web app per plan.md: `backend/app/...`, `backend/tests/...`, `frontend/src/...`, `frontend/tests/...`

---

## Phase 1: Setup (Shared Infrastructure)

No new dependencies are needed for this feature (plan.md Technical Context — no new backend or
frontend packages). Proceed directly to the Foundational phase below.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the chunk-block rendering logic both user stories touch — User Story 1
deletes its old container, User Story 2 builds a new one on top of the extracted piece — before
either story's own work begins, so the rendering logic is never in a state where it exists only in
the file about to be deleted.

**⚠️ CRITICAL**: Must complete before Phase 4 (User Story 2); User Story 1 only needs this phase's
component to exist by the time Phase 5 deletes `ChunkedMarkdownView.tsx`, but doing it first for
both keeps the sequence simple and avoids a "logic temporarily nowhere" window.

- [X] T001 [P] Unit test for `frontend/tests/unit/ColoredBlockGroups.test.tsx` — given `blocks`/`spansByBlock` matching what `classifyBlocks`/`colorBlocks` produce, renders consecutive `list-item` blocks sharing a `listGroupId` as one `<ul data-testid="chunked-preview-list">`, a `heading` block as `<h3 data-testid="chunked-preview-heading">`, everything else as `<p data-testid="chunked-preview-paragraph">`, each with inline colored `<span>` children per `spansByBlock` — adapt the equivalent rendering assertions from `frontend/tests/unit/ChunkedMarkdownView.test.tsx` (contracts/ui-contracts.md `ColoredBlockGroups`)
- [X] T002 Create `frontend/src/components/shared/ColoredBlockGroups.tsx` — extract `groupForRendering`/`ColoredSpans` out of `frontend/src/components/sources/ChunkedMarkdownView.tsx` unchanged in behavior, taking `{ blocks, spansByBlock }` props (research.md §7, data-model.md `ColoredBlockGroups`) — depends on T001 failing first

**Checkpoint**: Shared renderer ready — both user stories can now proceed independently.

---

## Phase 3: User Story 1 - Read a source PDF comfortably in Sources (Priority: P1) 🎯 MVP

**Goal**: The Sources screen's PDF preview pane loses its "Chunked Preview" toggle and gains a
fullscreen/restore toggle — normal (~50% width) ↔ fullscreen (100% width, document list hidden) —
resetting to normal on document change or screen re-entry.

**Independent Test**: Open Sources, select a document, expand its PDF preview to fullscreen,
scroll through it, restore it, and confirm no "Chunked Preview" button exists anywhere — without
touching chunking or embeddings at all.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US1] Unit test for `frontend/tests/unit/SourceDocumentPreview.test.tsx` — no "Chunked Preview"/"Back to PDF" button renders; a `data-testid="source-preview-fullscreen-toggle"` button renders labeled "Fullscreen" when `isFullscreen` is `false` and "Restore" when `true`, calling `onToggleFullscreen` on click; the PDF continues to render every page continuously regardless of `isFullscreen` (FR-002, FR-003, FR-005; contracts/ui-contracts.md `SourceDocumentPreview`)
- [X] T004 [P] [US1] Integration test update for `frontend/tests/integration/DataSourcesScreen.test.tsx` — clicking fullscreen hides the left document-list pane and the right pane becomes full width; clicking restore reverts to the ~50%/50% split; selecting a different document while fullscreen resets the layout to normal (FR-001, FR-002, FR-003, FR-004; contracts/ui-contracts.md `DataSourcesScreen`)

### Implementation for User Story 1

- [X] T005 [US1] Update `frontend/src/components/sources/SourceDocumentPreview.tsx` — remove the `mode` state, the `ChunkedMarkdownView` import/usage, and the "Chunked Preview"/"Back to PDF" button; accept new `isFullscreen: boolean` / `onToggleFullscreen: () => void` props; render the fullscreen/restore toggle button in its place — depends on T003 failing first
- [X] T006 [US1] Update `frontend/src/components/sources/DataSourcesScreen.tsx` — add `isFullscreen` local state (default `false`) with a `useEffect` resetting it to `false` on `selectedDocumentId` change; conditionally render the left pane only when `!isFullscreen`; toggle the right pane between `w-1/2` and `w-full`; pass `isFullscreen` and a toggle callback into `SourceDocumentPreview` — depends on T004 failing first, T005

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - See each chunk in its original page context during Fixed Size Chunking (Priority: P2)

**Goal**: Fixed Size Chunking shows the chunk list on the left and a new in-context preview pane on
the right; selecting a chunk shows it plus its one preceding/following neighbor rendered on their
real PDF page(s) (every touched page stacked in page order), with structure preserved and the
existing chunk/overlap coloring applied, reusing the extracted `ColoredBlockGroups` renderer.

**Independent Test**: Open Fixed Size Chunking for a document with saved chunks, select different
chunks from the list, and confirm the right-hand preview updates each time to the correct page(s)
with correct structure and color annotation — independent of any Sources-screen changes.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US2] Contract test update for `backend/tests/contract/test_chunking_structured_preview.py` — response now also includes `pages` (fully partitions `fullText`, 1-indexed `pageNumber`, ordered, no gaps/overlaps) and `chunkRanges` (one entry per saved chunk with non-empty content, ordered by `chunkIndex`); existing 404 cases (unknown document, zero saved chunks, missing file) remain unchanged and never include the new fields (contracts/chunking-structured-preview-page-mapping.md)
- [X] T008 [P] [US2] Unit test for `backend/tests/unit/test_structured_preview_page_mapping.py` — page-boundary strip-offset math: a document whose raw joined text has leading whitespace shifts every page boundary correctly, a document with a fully blank leading page collapses that page to zero width and omits it, a single-page document produces one page spanning the whole `fullText`, and boundaries always satisfy `pages[i].end == pages[i+1].start` with `pages[-1].end == len(fullText)` (research.md §3)
- [X] T009 [P] [US2] Unit test for `backend/tests/unit/test_structured_preview_page_mapping.py` — chunk-range computation: a chunk's own `start`/`end` matches its persisted `chunk_size`/`overlap`/`index`-derived word range independent of how the overlap-collapsing `segments` list would classify those same words, and a chunk whose computed range is empty/out-of-bounds is omitted from `chunkRanges` (research.md §4)
- [X] T010 [P] [US2] Unit test for `frontend/tests/unit/chunkContextView.test.ts` — `computeChunkContextView` omits a missing neighbor for the first/last chunk (no error), unions the pages touched by the selected chunk and its shown neighbor(s), correctly slices/rebases `fullText`/`segments` per touched page, and assigns the *same* color to a chunk index that appears in the segments of two different touched pages (research.md §5, §6)
- [X] T011 [P] [US2] Unit test for `frontend/tests/unit/ChunkInContextPreview.test.tsx` — renders one `data-testid="chunk-context-page"` group per touched page in page order, each with a `data-testid="chunk-context-page-number"` divider; renders `data-testid="chunked-preview-empty"` when the document has zero saved chunks; renders `data-testid="chunk-context-unsaved"` when `hasUnsavedChanges` is `true` instead of fetching/rendering (FR-012, FR-013, FR-014; contracts/ui-contracts.md `ChunkInContextPreview`)
- [X] T012 [P] [US2] Unit test update for `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` — in single-document scope, the `chunk-list` area splits into a left column of clickable chunk cards (clicking one sets `selectedChunkIndex`, which defaults to `0` whenever a new `result` loads) and a right `data-testid="chunk-context-preview"` pane; Entire-Corpus scope's existing `EntireCorpusSummaryList` rendering is unaffected (FR-006, FR-007; contracts/ui-contracts.md `FixedSizeChunkingScreen`)

### Implementation for User Story 2

- [X] T013 [US2] Add `PagePosition`/`ChunkRange` models and extend `StructuredPreviewResponse` with `pages`/`chunkRanges` fields in `backend/app/chunking/schemas.py` (data-model.md) — depends on T007 failing first
- [X] T014 [US2] Extend `compute_structured_preview` in `backend/app/chunking/service.py` to also compute and return `pages` (strip-offset-adjusted page boundaries, research.md §3) and `chunkRanges` (per-chunk character ranges computed independently of the ownership/ segments merge, research.md §4) — depends on T008 failing first, T009 failing first, T013
- [X] T015 [US2] Update `GET /api/chunking/structured-preview` in `backend/app/chunking/router.py` to include `pages`/`chunkRanges` in its response — depends on T014
- [X] T016 [P] [US2] Add `PagePosition`/`ChunkRange` types and extend the `StructuredPreview` type in `frontend/src/lib/chunkingApi.ts` — depends on T015
- [X] T017 [US2] Add an optional pre-computed `colorByChunkIndex` third parameter to `colorBlocks` in `frontend/src/lib/chunkStructure.ts`, defaulting to today's internal computation when omitted (research.md §6) — depends on T010 failing first
- [X] T018 [US2] Implement `computeChunkContextView` in `frontend/src/lib/chunkContextView.ts` — neighbor lookup, page union, per-page slicing/rebasing, shared color-map computation, returns `ChunkContextPage[]` (research.md §5, data-model.md `ChunkContextPage`) — depends on T010 failing first, T016, T017
- [X] T019 [US2] Implement `frontend/src/components/chunking/ChunkInContextPreview.tsx` — fetches/caches `fetchStructuredPreview` per `documentId`, calls `computeChunkContextView` per `selectedChunkIndex`, renders one `ColoredBlockGroups` per touched page with a page-number divider, and the empty/unsaved states (contracts/ui-contracts.md `ChunkInContextPreview`) — depends on T011 failing first, T002, T018
- [X] T020 [US2] Update `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` — add `selectedChunkIndex` state (default `0`, reset via `useEffect` on new `result`); in single-document scope, split the `chunk-list` area into a left clickable chunk-card column and a right `<ChunkInContextPreview documentId={activeDocumentId} selectedChunkIndex={selectedChunkIndex} hasUnsavedChanges={chunkOrigin === 'computed' && !isSaved} />` pane; leave Entire-Corpus scope's rendering untouched (contracts/ui-contracts.md `FixedSizeChunkingScreen`) — depends on T012 failing first, T019

**Checkpoint**: Both user stories are independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation across both stories

- [X] T021 [P] Delete `frontend/src/components/sources/ChunkedMarkdownView.tsx` and `frontend/tests/unit/ChunkedMarkdownView.test.tsx`, and grep the frontend source tree to confirm no remaining references to either — its rendering logic now lives in `ColoredBlockGroups.tsx` (T002) and its host-component role is now filled by `ChunkInContextPreview.tsx` (T019); Sources no longer imports it (T005) — depends on T002, T005, T019. Confirmed clean (`tsc --noEmit` passes, only a documentation-comment mention remains in `ColoredBlockGroups.tsx`).
- [X] T022 [P] Run every scenario in `specs/023-pdf-fullscreen-chunk-view/quickstart.md` end-to-end against the running stack — completed via `browser-harness` against the live dev stack with a real 200-chunk, multi-page document. Verified: US1 fullscreen expands to 100% width (document list hidden, no "Chunked Preview" button anywhere), Restore returns to the normal 50/50 split. US2 the two-column layout renders with chunk 0 selected by default and "Page 1"/"Page 2" divider labels already visible (chunk 0's neighbor, chunk 1, spans onto page 2); selecting a deep chunk (CHUNK_50) correctly updates the right pane to "Page 39" with fresh coloring and moves `aria-current` to the newly selected card; re-running chunking with a different chunk size *without* saving correctly shows "Save chunks to see this configuration in its page context." instead of stale/mismatched content (research.md §8), and the chunk-count/"Not saved yet" indicator updates correctly alongside it.
- [X] T023 Run the full backend (`pytest`) and frontend (`vitest run`) suites once more to confirm no regressions across both stories — frontend: 406/408 passing (2 pre-existing failures in `DataSourcesScreen.test.tsx`, attach/remove-from-corpus UI is commented out, unrelated to this feature); backend: 273/293 passing (20 failures are the pre-existing DB test-pollution issue on `documents_content_hash_key` affecting corpora/sources-listing tests, confirmed in earlier sessions to exist identically on `main`, none touching chunking)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A for this feature (no new dependencies)
- **Foundational (Phase 2)**: Blocks Phase 4 (User Story 2, which consumes `ColoredBlockGroups`);
  Phase 3 (User Story 1) has no functional dependency on it but Phase 2 is still sequenced first
  so the rendering logic is never only reachable from the file Phase 5 later deletes
- **User Stories (Phase 3–4)**: Independent of each other — US1 touches
  `SourceDocumentPreview.tsx`/`DataSourcesScreen.tsx`; US2 touches backend chunking
  files plus new/updated Chunking-screen frontend files. No shared files between them.
- **Polish (Phase 5)**: Depends on both user stories being complete (T021 specifically depends on
  both US1's T005 and US2's T019)

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2
- **User Story 2 (P2)**: No dependency on User Story 1; depends on Phase 2 Foundational for
  `ColoredBlockGroups.tsx`

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- US2: schemas before service logic (T013 before T014), service before router (T014 before T015),
  router before frontend API client (T015 before T016), palette/API-client updates before the
  slicing utility (T016/T017 before T018), slicing utility before the component that consumes it
  (T018 before T019), shared renderer before that same component (T002 before T019), component
  before the screen that adopts it (T019 before T020)
- Story complete before moving to Polish

### Parallel Opportunities

- All Foundational test tasks marked [P] run in parallel (there's only one, T001)
- Within US1: T003 and T004 (tests) run in parallel; T005 and T006 are sequential (same-ish layout
  concern, T006 depends on T005's new props existing)
- Within US2: T007–T012 (all tests) run in parallel with each other; T016 and T017 run in parallel
  with each other (different files) once T015 is done
- US1 (Phase 3) and US2 (Phase 4) can be implemented in parallel by different developers once
  Phase 2 is done — no shared files

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test update for backend/tests/contract/test_chunking_structured_preview.py"
Task: "Unit test for page-boundary math in backend/tests/unit/test_structured_preview_page_mapping.py"
Task: "Unit test for chunk-range computation in backend/tests/unit/test_structured_preview_page_mapping.py"
Task: "Unit test for computeChunkContextView in frontend/tests/unit/chunkContextView.test.ts"
Task: "Unit test for ChunkInContextPreview in frontend/tests/unit/ChunkInContextPreview.test.tsx"
Task: "Unit test update for FixedSizeChunkingScreen in frontend/tests/unit/FixedSizeChunkingScreen.test.tsx"

# Once backend tests are failing, implement the backend chain in order:
Task: "Add PagePosition/ChunkRange schemas in backend/app/chunking/schemas.py"
Task: "Extend compute_structured_preview in backend/app/chunking/service.py"
Task: "Update the structured-preview router in backend/app/chunking/router.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T002)
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Confirm fullscreen/restore works and no Chunked Preview button remains
4. Deploy/demo if ready

### Incremental Delivery

1. Foundational → User Story 1 → test independently → deploy/demo (MVP!)
2. Add User Story 2 → test independently → deploy/demo
3. Each story adds value without breaking the other

### Parallel Team Strategy

Once Phase 2 (Foundational) is done, both stories can proceed in parallel — no shared files:
- Developer A: User Story 1 (Sources fullscreen — frontend-only)
- Developer B: User Story 2 (backend page-mapping extension + Chunking-screen in-context preview)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
