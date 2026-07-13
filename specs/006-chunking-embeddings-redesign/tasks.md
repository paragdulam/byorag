---

description: "Task list for Chunking Section Redesign & Embeddings Entry Point"
---

# Tasks: Chunking Section Redesign & Embeddings Entry Point

**Input**: Design documents from `/specs/006-chunking-embeddings-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chunking-stream-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story, written before their implementation.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

Web app, matching the existing `backend/` + `frontend/` layout (see `plan.md` § Project
Structure):
- Backend: `backend/app/chunking/`, `backend/tests/{contract,unit}/`
- Frontend: `frontend/src/{types,lib,hooks,components/{layout,chunking}}/`, `frontend/tests/{unit,e2e}/`

---

## Phase 1: Setup

**Purpose**: Rename the component directory to match the new nav section and scaffold the type/
schema changes every later phase builds on.

- [X] T001 Rename `frontend/src/components/experiments/` to `frontend/src/components/chunking/`
      (`git mv frontend/src/components/experiments/FixedSizeChunkingScreen.tsx
      frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`) and update its import path in
      `frontend/src/app/App.tsx` (plan.md § Structure Decision)
- [X] T002 [P] Add a `ChunkProgressEvent` type (`{ percent: number }`) to
      `frontend/src/types/chunking.ts` per `data-model.md`
- [X] T003 [P] Remove `ChunkRunRequest` from `backend/app/chunking/schemas.py` — `documentId`/
      `chunkSize` become query parameters on the new streaming endpoint instead of a JSON body
      (`contracts/chunking-stream-api.md`); `Chunk`, `ChunkingResult`, `ChunkRunResponse` are
      unchanged

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — no work here blocks all three stories at once. The streaming backend/hook
rewrite that every story's "run" action depends on is scoped into User Story 1 below, since US1's
acceptance scenarios already require "Re-calculate Chunks" to work end-to-end. See Dependencies
below for the real (partial) ordering.

---

## Phase 3: User Story 1 - Configure and recalculate chunks from a single control bar (Priority: P1) 🎯 MVP

**Goal**: The "Experiments" nav section is renamed "Chunking"; the algorithm-picker (Recursive
Character / Semantic Chunking / Fixed Size radio group) is gone entirely; a single horizontal
control bar (Select Document, Chunk Size, Overlap, Separators) sits directly below the sub-header;
"Re-calculate Chunks" runs fixed-size chunking end-to-end via the new streaming endpoint and
refreshes the chunk list (the live progress bar itself is added in User Story 2).

**Independent Test**: Open the app, expand "Chunking" in the sidebar (not "Experiments"), open
"Fixed Size Chunking", confirm the horizontal bar order and the absence of any algorithm-selection
control, change the document/chunk size/overlap/separator values, click "Re-calculate Chunks", and
confirm the chunk list updates.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T004 [P] [US1] Contract test in `backend/tests/contract/test_chunking_stream.py`:
      `GET /api/chunking/run/stream` returns `400`/`404` (unchanged semantics from 005) before any
      stream bytes are sent for an invalid `chunkSize`/unknown `documentId`; a valid request's
      stream ends with exactly one `result` event shaped per `contracts/chunking-stream-api.md`
      (`chunks` capped at 200, `totalChunks`, `strategy` always `"fixed-size"`, `chunkSize` echoed)
- [X] T005 [P] [US1] Unit tests in `backend/tests/unit/test_chunking_service.py`:
      `stream_chunking()` enforces the 200-chunk cap while still reporting the true `totalChunks`;
      a document with no extractable text yields a terminal event with `extractionFailed: true,
      result: None`; an unregistered strategy name is rejected before streaming starts (updated
      from 005's `run_chunking()` tests)
- [X] T006 [P] [US1] Component tests in `frontend/tests/unit/SidebarNav.test.tsx`: the section
      previously labeled "Experiments" now reads "Chunking"; expanding it still reveals
      "Fixed Size Chunking", which navigates to the same `'fixed-size-chunking'` screen id as before
- [X] T007 [P] [US1] Component tests in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: a
      single horizontal bar directly below the "Configure how documents are partitioned"
      sub-header contains, in order, Select Document / Chunk Size / Overlap / Separators; no
      "Recursive Character", "Semantic Chunking", or algorithm-radio control exists anywhere on the
      screen; changing values and clicking "Re-calculate Chunks" updates the chunk list; an empty
      or invalid (`0`/negative) chunk size still shows the existing validation message and makes no
      request
- [X] T008 [P] [US1] Hook tests in `frontend/tests/unit/useFixedSizeChunking.test.ts`: `run()`
      against a mocked `EventSource` resolves to `'success'` / `'extraction-failed'` / `'error'`
      status with the expected `result`, driven by stubbed `progress`/`result`/`error` events

### Implementation for User Story 1

- [X] T009 [US1] Rework `extract_text()` into a page-by-page generator
      (`extract_text_pages()`) in `backend/app/chunking/service.py`, preserving the existing
      safe-document-id and not-found checks unchanged (research.md §1)
- [X] T010 [US1] Implement `stream_chunking()` in `backend/app/chunking/service.py`: consumes
      `extract_text_pages()`, yields progress values scaled `0`–`90` by pages processed so far,
      then runs the existing `"fixed-size"` strategy + `MAX_CHUNKS` cap (unchanged from 005) and
      yields the terminal `ChunkRunResponse` (research.md §1, §3) (depends on T009)
- [X] T011 [US1] Implement `GET /api/chunking/run/stream` in `backend/app/chunking/router.py`:
      synchronous `400`/`404` validation unchanged from 005, then a `StreamingResponse`
      (`text/event-stream`) formatting each `stream_chunking()` yield as an SSE `event:`/`data:`
      frame, wrapping any unexpected mid-stream exception as a terminal `error` event
      (`contracts/chunking-stream-api.md`); remove the old `POST /run` route (depends on T010)
- [X] T012 [US1] Implement `runChunkingStream(documentId, chunkSize, { onProgress, onResult,
      onError })` in `frontend/src/lib/chunkingApi.ts` using `EventSource` against
      `/api/chunking/run/stream?documentId=...&chunkSize=...`, replacing the old `runChunking()`
      fetch wrapper (research.md §4) (depends on T002)
- [X] T013 [US1] Rewrite `frontend/src/hooks/useFixedSizeChunking.ts`: `run()` now calls
      `runChunkingStream()`; add `progressPercent` (reset to `0` when a run starts, updated on each
      progress event) and `hasSucceededOnce` (one-way latch set `true` on the first successful run,
      research.md §7) to the hook's returned state (depends on T012)
- [X] T014 [US1] Update `frontend/src/components/layout/SidebarNav.tsx`: rename the "Experiments"
      label to "Chunking" (FR-001) — sub-items unchanged for now ("Embeddings" is added in US3)
- [X] T015 [US1] Rewrite `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: delete the
      algorithm-radio-group block and its `inertAlgorithm` state entirely (FR-002); rearrange
      Select Document / Chunk Size / Overlap / Separators into one horizontal bar directly below
      the sub-header (FR-005); wire "Re-calculate Chunks" to the rewritten hook's `run()` (depends
      on T001, T013, T014)

**Checkpoint**: T004–T008 pass — nav rename, control bar layout, and the recalculate flow work
end-to-end via the new streaming endpoint. US1 is independently verified here (the progress bar
display itself is added by User Story 2 on top of this).

---

## Phase 4: User Story 2 - See chunking progress and review results without losing screen context (Priority: P2)

**Goal**: A progress bar visibly advances from 0% to 100% — driven by the real per-page progress
events User Story 1's streaming endpoint/hook already emit — while a run is in flight; the chunk
list scrolls internally while the control bar and bottom bar stay fixed and visible.

**Independent Test**: Trigger a chunking run on a multi-page document and confirm the progress bar
passes through intermediate percentages (not an instant 0→100 jump) before the chunk list appears;
produce a chunk list longer than the visible area and confirm it scrolls independently while the
control bar and bottom bar remain in place.

**Depends on**: User Story 1's rewritten screen and streaming hook (`progressPercent` already
exists on the hook from US1; this story surfaces it in the UI and adds the scroll-contained
layout).

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T016 [P] [US2] Component tests in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`
      (extends US1's file): a progress bar is visible and reflects intermediate `progressPercent`
      values while `status === 'running'`, and is hidden once a terminal status is reached; the
      chunk list container has independent-scroll styling (e.g. `overflow-y-auto` within a
      `flex-1` region) distinct from the rest of the page
- [X] T017 [P] [US2] Unit tests in `backend/tests/unit/test_chunking_service.py` (extends US1's
      file): `stream_chunking()` emits multiple, non-decreasing `progress` events for a multi-page
      document, and at least one `progress` event for a single-page document, before the terminal
      event (research.md §1)

### Implementation for User Story 2

- [X] T018 [US2] Add a progress-bar element to
      `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`, bound to the hook's
      `progressPercent` and visible only while `status === 'running'` (FR-010) (depends on T015)
- [X] T019 [US2] Apply the fixed three-region flex layout to
      `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` — control bar and bottom bar
      fixed height, chunk list region `flex-1 min-h-0 overflow-y-auto` — so only the chunk list
      scrolls (FR-011, FR-012, FR-016, research.md §6) (depends on T015)

**Checkpoint**: User Stories 1 AND 2 both independently functional — real progress is visible and
the layout stays contained within the viewport.

---

## Phase 5: User Story 3 - Move from Chunking to Embeddings (Priority: P3)

**Goal**: A bottom action bar shows "Re-calculate Chunks" and "Move to Embeddings" (the latter
disabled until a chunk run has succeeded at least once this session); a new "Embeddings" sidebar
sub-item and a minimal "coming soon" placeholder screen exist as the next-stage entry point.

**Independent Test**: Before ever running chunking, confirm "Move to Embeddings" is disabled; run
chunking successfully, confirm it becomes enabled, click it, and confirm the Embeddings placeholder
screen opens; separately, click the "Embeddings" sidebar sub-item and confirm it also reaches the
placeholder regardless of run state.

**Depends on**: User Story 1's control bar/hook (`hasSucceededOnce` already exists on the hook from
US1) and the renamed "Chunking" sidebar section (US1).

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T020 [P] [US3] Component tests in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`
      (extends US1/US2's file): the bottom bar shows exactly two buttons; "Move to Embeddings" is
      disabled until `hasSucceededOnce` becomes `true`, then enabled, and calls
      `onNavigate('embeddings')` when clicked
- [X] T021 [P] [US3] Component tests in `frontend/tests/unit/SidebarNav.test.tsx` (extends US1's
      file): expanding "Chunking" also lists "Embeddings", which navigates to the `'embeddings'`
      screen id regardless of any chunk-run state
- [X] T022 [P] [US3] Component tests in `frontend/tests/unit/EmbeddingsScreen.test.tsx` (new file):
      renders within the standard `AppShell`/nav and shows a short "coming soon" style message with
      no functional controls

### Implementation for User Story 3

- [X] T023 [US3] Update `frontend/src/components/layout/SidebarNav.tsx`: add the "Embeddings"
      sub-item (`screen: 'embeddings'`) alongside "Fixed Size Chunking" under "Chunking"; extend
      `ScreenId` to include `'embeddings'` (FR-003) (depends on T014)
- [X] T024 [P] [US3] Create `frontend/src/components/chunking/EmbeddingsScreen.tsx`: a minimal
      `AppShell`-wrapped placeholder with a short "coming soon" message, no controls, no
      carried-over state (FR-015a, research.md §8)
- [X] T025 [US3] Add the bottom action bar (Re-calculate Chunks + Move to Embeddings) to
      `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`, gating "Move to Embeddings"
      on the hook's `hasSucceededOnce` and calling `onNavigate('embeddings')` when clicked
      (FR-013, FR-015) (depends on T015, T013)
- [X] T026 [US3] Update `frontend/src/app/App.tsx`: render `EmbeddingsScreen` for the `'embeddings'`
      screen id (depends on T023, T024)

**Checkpoint**: All three user stories independently functional — the full feature matches
spec.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration coverage and cleanup, spanning all three stories.

- [X] T027 [P] Update `frontend/tests/e2e/fixed-size-chunking.spec.ts`: upload a document,
      navigate via "Chunking" → "Fixed Size Chunking", adjust the horizontal bar, run chunking, see
      the progress bar and resulting chunks, click "Move to Embeddings" once enabled, and confirm
      the placeholder screen (quickstart.md §3–6)
- [X] T028 [P] Delete `backend/tests/contract/test_chunking_run.py` (superseded by
      `test_chunking_stream.py`, research.md §2) and remove any remaining reference to the old
      `POST /api/chunking/run` endpoint
- [X] T029 Run `quickstart.md` validation end-to-end: backend `curl -N` checks against the stream
      (success, invalid chunk size, unknown document), and the full browser walkthrough of all
      three user stories including the no-page-scroll layout check (quickstart.md §4)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: N/A — no tasks (see phase note above).
- **User Story 1 (Phase 3)**: Depends on Setup (T001–T003).
- **User Story 2 (Phase 4)**: Depends on User Story 1's rewritten screen and hook (T013, T015) —
  surfaces the `progressPercent` state US1 already produces.
- **User Story 3 (Phase 5)**: Depends on User Story 1's hook/`SidebarNav` rename (T013, T014); its
  own `EmbeddingsScreen.tsx` (T024) is independent of User Story 2.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent — no dependency on User Story 2 or 3.
- **User Story 2 (P2)**: Depends on User Story 1 (surfaces its `progressPercent`/layout on the same
  screen file).
- **User Story 3 (P3)**: Depends on User Story 1 (`hasSucceededOnce`, renamed nav section); does
  not depend on User Story 2.

### Within Each User Story

- Tests are written first and confirmed to fail before implementation.
- Backend service generator before the router that streams it.
- Router before frontend consumption.
- Story complete and its checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel.
- T004–T008 (US1 tests) can all run in parallel — different files.
- T016–T017 (US2 tests) can run in parallel.
- T020–T022 (US3 tests) can run in parallel.
- **T024 (US3's new `EmbeddingsScreen.tsx` + its test T022)** can be built in parallel with User
  Story 2 entirely, since neither touches `FixedSizeChunkingScreen.tsx`.
- T027 and T028 (Polish) can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for GET /api/chunking/run/stream in backend/tests/contract/test_chunking_stream.py"
Task: "Unit tests for stream_chunking() cap/extraction-failure/validation in backend/tests/unit/test_chunking_service.py"
Task: "Component tests for the renamed Chunking section in frontend/tests/unit/SidebarNav.test.tsx"
Task: "Component tests for the horizontal control bar and no-picker layout in frontend/tests/unit/FixedSizeChunkingScreen.test.tsx"
Task: "Hook tests for useFixedSizeChunking against a mocked EventSource in frontend/tests/unit/useFixedSizeChunking.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

User Story 1 alone is a real, demoable slice: the renamed nav section, the horizontal control bar,
the algorithm-picker gone, and a working recalculate flow against the new streaming endpoint (just
without a live-updating progress bar yet).

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: Confirm the nav rename, control bar layout, and recalculate flow
   (quickstart.md §3).
4. Deploy/demo if ready.

### Incremental Delivery

1. Setup → renamed directory/types/schema ready.
2. Add User Story 1 → validate independently → deploy (MVP: control bar + working recalculate).
3. Add User Story 2 → validate independently → deploy (live progress + contained scrolling).
4. Add User Story 3 → validate independently → deploy (gated "Move to Embeddings" + placeholder).
5. Polish phase → e2e coverage, dead-code removal, quickstart validation.

### Parallel Team Strategy

With two developers once Setup is done:
- Developer A: User Story 1 (backend streaming endpoint + hook + screen rewrite).
- Developer B: waits for User Story 1's T013/T015 to land, then picks up User Story 2 (progress
  bar + layout) while Developer A starts User Story 3's independent `EmbeddingsScreen.tsx` (T024)
  in parallel.

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- [Story] labels map every user-story-phase task back to spec.md for traceability.
- Tests are written and confirmed failing before their corresponding implementation task, per
  constitution Principle II.
- T015 (rewriting `FixedSizeChunkingScreen.tsx`) is touched again by US2 (T018, T019) and US3
  (T025) — these are sequential extensions of the same file across phases, not conflicting
  parallel edits.
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently.
