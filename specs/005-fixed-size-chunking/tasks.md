---

description: "Task list for Fixed Size Chunking Experiment"
---

# Tasks: Fixed Size Chunking Experiment

**Input**: Design documents from `/specs/005-fixed-size-chunking/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chunking-api.md, quickstart.md

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
- Frontend: `frontend/src/{types,lib,hooks,components/{layout,sources,experiments}}/`, `frontend/tests/{unit,integration,e2e}/`

---

## Phase 1: Setup

**Purpose**: Add the new dependency and scaffold the new module/type files later phases need.

- [X] T001 Add `pypdf` to `backend/pyproject.toml` dependencies and run `uv sync` (updates `backend/uv.lock`) per `research.md` §2
- [X] T002 [P] Create the `backend/app/chunking/` package: empty `backend/app/chunking/__init__.py` and `backend/app/chunking/strategies/__init__.py`
- [X] T003 [P] Create `frontend/src/types/chunking.ts` with `Chunk` and `ChunkingResult` TypeScript interfaces per `data-model.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A — no work here blocks *all three* stories at once. User Story 1 is pure frontend
navigation with no dependency on the backend `pypdf`/chunking work at all; User Stories 2 and 3
build on Setup's scaffolding directly. See Dependencies below for the real (partial) ordering.

---

## Phase 3: User Story 1 - Reach Fixed Size Chunking from the sidebar (Priority: P1)

**Goal**: Selecting "Experiments" in the sidebar reveals sub-options with "Fixed Size Chunking"
first; selecting it opens a (for now, empty) Fixed Size Chunking screen.

**Independent Test**: Open the app, select "Experiments" in the sidebar, confirm sub-options
appear with "Fixed Size Chunking" listed first, select it, and confirm the Fixed Size Chunking
screen opens.

**Note**: This story only needs to satisfy its own Acceptance Scenarios (spec.md), which test
navigation only — the screen it opens does not need real chunking functionality yet (User Story 2
fills that in on top of the shell this story builds).

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T004 [P] [US1] Component tests in `frontend/tests/unit/SidebarNav.test.tsx`: selecting "Experiments" reveals sub-options with "Fixed Size Chunking" listed first; selecting the sub-item calls the `onNavigate` prop with the expected screen identifier
- [X] T005 [P] [US1] Integration test in `frontend/tests/integration/App.test.tsx` (new file): selecting "Fixed Size Chunking" from the sidebar renders the Fixed Size Chunking screen instead of the Data Sources screen

### Implementation for User Story 1

- [X] T006 [US1] Update `frontend/src/components/layout/SidebarNav.tsx`: accept `activeScreen` + `onNavigate` props, add `subItems` support to the nav item model, and give "Experiments" one sub-item, "Fixed Size Chunking" (research.md §6)
- [X] T007 [US1] Extract `frontend/src/components/layout/AppShell.tsx` (the `SidebarNav` + `TopBar` + content wrapper currently inlined in `DataSourcesScreen.tsx`) and update `frontend/src/components/sources/DataSourcesScreen.tsx` to render through it instead of duplicating the shell markup — both screens need identical chrome once a second screen exists
- [X] T008 [US1] Create a minimal `frontend/src/components/experiments/FixedSizeChunkingScreen.tsx` placeholder rendered through `AppShell` (heading only; real content added in User Story 2/3) (depends on T007)
- [X] T009 [US1] Add `activeScreen` state and navigation wiring in `frontend/src/app/App.tsx`: renders `DataSourcesScreen` or `FixedSizeChunkingScreen` based on the sidebar selection (depends on T006, T007, T008)

**Checkpoint**: T004/T005 pass — sidebar navigation works end-to-end, opening an (empty) Fixed Size Chunking screen. US1 is independently verified here.

---

## Phase 4: User Story 2 - Chunk a selected document and view the results (Priority: P1)

**Goal**: The user picks a document, enters a chunk size, triggers chunking, and sees the
resulting chunks — the actual value of the feature.

**Independent Test**: Open the Fixed Size Chunking screen, select an already-uploaded document,
enter a chunk size, trigger chunking, and confirm a list of chunks appears reflecting that
document's content (including validation, extraction-failure, and 200-chunk-cap behavior).

**Depends on**: User Story 1's `FixedSizeChunkingScreen.tsx` placeholder and `AppShell` — this
story fills in real content on the shell US1 built, rather than creating a new screen file.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T010 [P] [US2] Contract test in `backend/tests/contract/test_chunking_run.py`: `POST /api/chunking/run` returns `200` with `extractionFailed: false` and a `result` shaped per `contracts/chunking-api.md`; `400` for an invalid `chunkSize` (zero/negative/missing) and for an unsupported `strategy`; `404` for an unknown `documentId`
- [X] T011 [P] [US2] Unit tests in `backend/tests/unit/test_fixed_size_strategy.py`: word-count splitting produces the expected chunk boundaries/count for known input text; a larger chunk size on the same text yields fewer, larger chunks than a smaller one (research.md §3)
- [X] T012 [P] [US2] Unit tests in `backend/tests/unit/test_chunking_service.py`: the 200-chunk cap is enforced while `totalChunks` still reports the true count; a document with no extractable text returns `extractionFailed: true, result: None`; an unregistered strategy name is rejected (research.md §1, §4)
- [X] T013 [P] [US2] Component tests in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: the document picker lists uploaded documents; entering a chunk size and triggering chunking calls the chunking API and renders the returned chunks with their position/content; an empty or invalid (`0`/negative) chunk size shows a validation message and makes no API call (FR-010); an `extractionFailed: true` response shows a clear error message (FR-012); a result where `totalChunks > chunks.length` shows a "more chunks exist" note (SC-005)
- [X] T014 [P] [US2] Hook tests in `frontend/tests/unit/useFixedSizeChunking.test.ts`: run success, run failure (extraction failed), and validation-rejected states, using a mocked `fetch`

### Implementation for User Story 2

- [X] T015 [US2] Implement `ChunkRunRequest`, `Chunk`, `ChunkingResult`, `ChunkRunResponse` Pydantic models in `backend/app/chunking/schemas.py` per `contracts/chunking-api.md`
- [X] T016 [US2] Implement the `ChunkingStrategy` protocol and a `STRATEGIES` name-keyed registry in `backend/app/chunking/strategies/base.py` (research.md §1)
- [X] T017 [US2] Implement the `"fixed-size"` word-count-based splitting strategy in `backend/app/chunking/strategies/fixed_size.py`, registered into `STRATEGIES` (research.md §3) (depends on T016)
- [X] T018 [US2] Implement `extract_text()` (via `pypdf`) and `run_chunking()` (strategy lookup, 200-chunk cap + `totalChunks`, extraction-failure handling) in `backend/app/chunking/service.py`, reading the selected document's bytes from `PDFS_DIR` (research.md §2, §4) (depends on T015, T017) — also adds a path-safety guard mirroring `004-delete-source-documents`'s precedent, not originally called out in the task description but a direct application of established practice in this codebase
- [X] T019 [US2] Implement `POST /api/chunking/run` in `backend/app/chunking/router.py`: `400` for invalid `chunkSize`/unsupported `strategy`, `404` for an unknown `documentId`, delegates to `service.run_chunking()` (depends on T018)
- [X] T020 [US2] Mount the chunking router in `backend/app/main.py` (`app.include_router(chunking_router)`)
- [X] T021 [US2] Create `frontend/src/lib/chunkingApi.ts` with a `runChunking(documentId, chunkSize, strategy)` fetch wrapper mirroring the existing `sourcesApi.ts`/`systemApi.ts` pattern (depends on T003)
- [X] T022 [US2] Create `frontend/src/hooks/useFixedSizeChunking.ts` exposing the document list (reusing `listSources()` from `sourcesApi.ts`), run status/result/error state, and a `run(documentId, chunkSize)` action (depends on T021)
- [X] T023 [US2] Fill in `frontend/src/components/experiments/FixedSizeChunkingScreen.tsx` (from the US1 placeholder) with: document picker, chunk-size input with client-side validation, a trigger action, the chunk list (position + content), the capped-result note, and extraction-failure/empty-corpus messaging (FR-003–FR-007a, FR-010–FR-012) (depends on T008, T022)

**Checkpoint**: US1 + US2 are both independently functional — a user can navigate to the screen and produce/view real chunks end-to-end.

---

## Phase 5: User Story 3 - See the rest of the reference design without it doing anything yet (Priority: P3)

**Goal**: The reference design's other controls (alternate algorithms, overlap, separators) are
visible but inert; the "Comparison" section is absent entirely.

**Independent Test**: Open the Fixed Size Chunking screen, confirm the extra controls are visible,
interact with them, and confirm they have no effect on the chunk size input, extraction, or
displayed results; confirm no "Comparison" section exists anywhere on the screen.

**Depends on**: User Story 2's completed `FixedSizeChunkingScreen.tsx` — this story only adds
additional, non-functional UI to the same screen.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T024 [P] [US3] Component tests in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: the alternate algorithm options, overlap control, and separator options are visible; interacting with them does not change the chunk size input, does not trigger an API call, and does not alter any displayed chunk results; no element resembling a "Comparison" section is present anywhere on the screen (FR-008, FR-009)

### Implementation for User Story 3

- [X] T025 [US3] Add the inert reference-design controls (algorithm radio group defaulting to "Fixed Size", overlap slider, separator buttons) to `frontend/src/components/experiments/FixedSizeChunkingScreen.tsx`, backed only by local UI state that has no effect on chunking behavior (depends on T023)

**Checkpoint**: All three user stories are independently functional — the full feature matches spec.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration coverage and documentation, spanning all three stories.

- [X] T026 [P] Create `frontend/tests/e2e/fixed-size-chunking.spec.ts`: upload a document, navigate to "Experiments" → "Fixed Size Chunking", run chunking, and confirm chunks appear on screen — required a new real (pypdf-parseable) fixture, `frontend/tests/e2e/fixtures/chunking-sample.pdf`, since the existing `valid.pdf` fixture is not a genuine parseable PDF
- [X] T027 [P] Add a short note to `backend/README.md` about the new `pypdf` dependency and the `POST /api/chunking/run` endpoint
- [X] T028 Run the `quickstart.md` validation end-to-end: backend `curl` checks (success, invalid chunk size, unknown document), browser walkthrough of all three user stories, and the 200-chunk cap verification (quickstart.md §5) — curl confirmed all four scenarios live, including the cap against a real 20MB PDF (115,359 total chunks correctly capped to 200 returned); the Playwright e2e run exercised the full browser walkthrough (upload → navigate → run → see chunks → no Comparison section)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: N/A — no tasks (see phase note above).
- **User Story 1 (Phase 3)**: Depends on Setup's T003 (`chunking.ts`) only insofar as later stories need it; US1 itself only needs the existing frontend scaffolding and can start immediately after Setup.
- **User Story 2 (Phase 4)**: Backend tasks (T010–T020) depend only on Setup (T001–T003) and can proceed in parallel with User Story 1. Frontend tasks (T021–T023) depend on User Story 1's `FixedSizeChunkingScreen.tsx` placeholder (T008) existing, since they fill in the same file.
- **User Story 3 (Phase 5)**: Depends on User Story 2 (Phase 4) completion — extends the same screen file.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent — no dependency on User Story 2 or 3's functionality, only shares files with them sequentially.
- **User Story 2 (P1)**: Backend half is independent of User Story 1 entirely; frontend half depends on User Story 1's screen shell existing.
- **User Story 3 (P3)**: Depends on User Story 2 (extends its screen).

### Within Each User Story

- Tests are written first and confirmed to fail before implementation.
- Backend service functions before the router that assembles them.
- Router before frontend consumption.
- Story complete and its checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel.
- T004 and T005 (US1 tests) can run in parallel.
- **T010–T020 (US2 backend, entirely)** can be worked in parallel with **T004–T009 (US1, entirely)** by a second developer, since the backend has no dependency on the sidebar/screen-shell work.
- T010–T014 (US2 tests) can all run in parallel — different files.
- T026 and T027 (Polish) can run in parallel.

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test for POST /api/chunking/run in backend/tests/contract/test_chunking_run.py"
Task: "Unit tests for the fixed-size strategy in backend/tests/unit/test_fixed_size_strategy.py"
Task: "Unit tests for the chunking service (cap, extraction failure) in backend/tests/unit/test_chunking_service.py"
Task: "Component tests for FixedSizeChunkingScreen in frontend/tests/unit/FixedSizeChunkingScreen.test.tsx"
Task: "Hook tests for useFixedSizeChunking in frontend/tests/unit/useFixedSizeChunking.test.ts"
```

---

## Implementation Strategy

### MVP First

User Story 1 alone is a real but modest slice (navigation to an empty screen); the feature's
actual requested value ("let user input chunk size... a list of chunks show up") requires **User
Story 1 + User Story 2 together**. Treat that combination as the MVP:

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. Complete Phase 4: User Story 2.
4. **STOP and VALIDATE**: Confirm the full navigate → select document → chunk → view flow works (quickstart.md §3–4).
5. Deploy/demo if ready — this satisfies the core feature request in full.

### Incremental Delivery

1. Setup → shared types/scaffolding ready.
2. Add User Story 1 → validate independently (navigation only).
3. Add User Story 2 → validate independently → deploy (full chunking flow — MVP complete).
4. Add User Story 3 → validate independently → deploy (visual completeness against the reference design).
5. Polish phase → e2e coverage and docs.

### Parallel Team Strategy

With two developers once Setup is done:
- Developer A: User Story 1 (sidebar + shell + screen wiring).
- Developer B: User Story 2's backend (T010–T020) in parallel — no dependency on Developer A's work — then picks up User Story 2's frontend (T021–T023) once Developer A's `FixedSizeChunkingScreen.tsx` placeholder (T008) lands.

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- [Story] labels map every user-story-phase task back to spec.md for traceability.
- Tests are written and confirmed failing before their corresponding implementation task, per constitution Principle II.
- T007 (extracting `AppShell`) is a small in-place refactor of `DataSourcesScreen.tsx`, not new behavior — existing Data Sources tests must continue passing unchanged after it.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
