---

description: "Task list for Data Sources Screen feature implementation"
---

# Tasks: Data Sources Screen

**Input**: Design documents from `/specs/001-data-sources-screen/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at
Every Level, NON-NEGOTIABLE), tests are mandatory for every user story at
the appropriate level(s) — unit, integration, and end-to-end — including
shared/foundational components, not just story-specific behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All paths are relative to the repository root

## Path Conventions

- Web application, frontend-only for this feature: `frontend/src/`, `frontend/tests/` (see `plan.md` Project Structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `frontend/` project so component work can begin

- [X] T001 Create `frontend/` Vite + React + TypeScript project scaffold (`frontend/package.json`, `frontend/index.html`, `frontend/src/main.tsx`, `frontend/vite.config.ts`) per `plan.md` Project Structure
- [X] T002 [P] Install and configure Tailwind CSS with the design tokens from `assets/sources/DESIGN.md` in `frontend/src/styles/tailwind.css` (colors, Inter/JetBrains Mono fonts, 4px spacing scale, 4px/8px radii) — Tailwind v4's CSS-first `@theme` approach is used via `@tailwindcss/vite`, so no separate `tailwind.config.ts` is needed
- [X] T003 [P] Configure Vitest + React Testing Library in `frontend/vite.config.ts` (test block) and `frontend/tests/setup.ts`
- [X] T004 [P] Configure Playwright in `frontend/playwright.config.ts`
- [X] T005 [P] Configure linting/formatting for `frontend/` — kept Vite's default `oxlint` (already scaffolded, covers React/TS rules) instead of adding a redundant ESLint setup, plus added `.prettierrc.json` for formatting
- [X] T006 [P] Create `frontend/Dockerfile` (Node build stage → static file server) per `research.md` Containerization decision

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types, utilities, and app-shell scaffolding that every user story needs

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Create `SourceDocument`, `SourceDocumentStatus`, `UploadRejection`, `VectorStorageStat` types in `frontend/src/types/sourceDocument.ts` per `data-model.md`
- [X] T008 [P] Create `formatFileSize` utility in `frontend/src/lib/formatFileSize.ts`
- [X] T009 [P] Create `validateFile` utility in `frontend/src/lib/fileValidation.ts` per the contract in `contracts/ui-contracts.md` (depends on T007 for types)
- [X] T010 Create `useSourceDocuments` hook skeleton — `documents`/`rejections` state plus `addFiles`/`clearRejections` signatures; `addFiles` initially just appends every given file as a `document`, with no validation or status-transition logic yet (those are wired incrementally by US1/US2 below) — in `frontend/src/hooks/useSourceDocuments.ts` (depends on T007)
- [X] T011 [P] Create `SidebarNav` component (Sources/Experiments/Playground/Vector View/Logs, "Sources" active) in `frontend/src/components/layout/SidebarNav.tsx`
- [X] T012 [P] Create `TopBar` component (search icon, notifications icon, "Deploy Pipeline" placeholder button) in `frontend/src/components/layout/TopBar.tsx`
- [X] T013 [P] Create `VectorStorageWidget` static placeholder component (used/percent values from `data-model.md`) in `frontend/src/components/sources/VectorStorageWidget.tsx`
- [X] T014 Create `DataSourcesScreen` shell composing `SidebarNav` + `TopBar` + `VectorStorageWidget` (upload area and document list slotted in by later stories) in `frontend/src/components/sources/DataSourcesScreen.tsx` (depends on T011, T012, T013)
- [X] T015 Wire `DataSourcesScreen` into `frontend/src/app/App.tsx` and `frontend/src/main.tsx`

### Tests for Foundational Components (MANDATORY per constitution) ⚠️

> Per constitution Principle II, shared/static components are not exempt from test coverage just because they hold no business logic.

- [X] T016 [P] Render test for `SidebarNav`: all five sections render and "Sources" is marked active in `frontend/tests/unit/SidebarNav.test.tsx` (depends on T011)
- [X] T017 [P] Render test for `TopBar`: search icon, notifications icon, and "Deploy Pipeline" button all render in `frontend/tests/unit/TopBar.test.tsx` (depends on T012)
- [X] T018 [P] Render test for `VectorStorageWidget`: displays the placeholder used-amount and percent-of-capacity values in `frontend/tests/unit/VectorStorageWidget.test.tsx` (depends on T013)
- [X] T019 Composition test for `DataSourcesScreen`: renders `SidebarNav` + `TopBar` + `VectorStorageWidget` together without error in `frontend/tests/integration/DataSourcesScreen.test.tsx` (depends on T014, T015)

**Checkpoint**: Foundation ready — app shell renders and is test-covered, shared types/utilities/hook exist, user story implementation can now begin

---

## Phase 3: User Story 1 - Upload PDF Source Documents (Priority: P1) 🎯 MVP

**Goal**: User can drag-and-drop or browse to upload PDF files and see them appear in a document list with name, size, upload time, and a Processing→Processed status.

**Independent Test**: Drag a valid PDF onto the upload area (or pick one via browse) and confirm it appears in the document list within ~2s, showing correct name/size/time, with status starting at "Processing" and flipping to "Processed" shortly after.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US1] Unit test for `formatFileSize` (bytes/KB/MB boundary cases) in `frontend/tests/unit/formatFileSize.test.ts`
- [X] T021 [P] [US1] Unit test for `validateFile` accepting valid PDFs within the size limit in `frontend/tests/unit/fileValidation.test.ts`
- [X] T022 [P] [US1] Integration test: `UploadDropzone` calls `onFilesSelected` for drag-and-drop, browse, and multi-file selection in `frontend/tests/integration/UploadDropzone.test.tsx`
- [X] T023 [P] [US1] Integration test: `DocumentList` renders one row per document with name/size/date, and status transitions from "Processing" to "Processed" using fake timers in `frontend/tests/integration/DocumentList.test.tsx`

### Implementation for User Story 1

- [X] T024 [US1] Implement `UploadDropzone` component (native HTML5 drag-and-drop + hidden `<input type="file" multiple accept=".pdf">`, "Max size: 50MB"/"PDF only" constraint chips, calls `onFilesSelected`) in `frontend/src/components/sources/UploadDropzone.tsx` per contract in `contracts/ui-contracts.md` (depends on T007)
- [X] T025 [US1] Implement `DocumentList` component rendering rows (name, formatted size, formatted upload date/time, status chip) in `frontend/src/components/sources/DocumentList.tsx` (depends on T007, T008)
- [X] T026 [US1] Wire `addFiles` to append valid PDFs as `documents` with `processing` status, then transition each to `processed` after a short fixed delay (status simulation per `research.md`) in `frontend/src/hooks/useSourceDocuments.ts` (extends T010)
- [X] T027 [US1] Compose `UploadDropzone` + `DocumentList`, backed by `useSourceDocuments`, into `DataSourcesScreen` in `frontend/src/components/sources/DataSourcesScreen.tsx` (depends on T014, T024, T025, T026)
- [X] T028 [US1] Apply Tailwind styling to `UploadDropzone` and `DocumentList` to match `assets/sources/screen.png` (spacing, colors, typography, status-chip colors) using tokens configured in T002

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently — the MVP.

---

## Phase 4: User Story 2 - Reject Invalid Uploads (Priority: P2)

**Goal**: Non-PDF files and PDFs over 50MB are rejected with a clear, visible error message and never appear in the document list.

**Independent Test**: Attempt to upload a non-PDF file and a PDF over 50MB; confirm both are rejected with a visible error message identifying the file and reason, and neither appears in the document list. Also upload a mixed valid+invalid batch and confirm only the valid file is added.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T029 [US2] Add unit tests to `frontend/tests/unit/fileValidation.test.ts` for rejecting non-PDF files and files over 50MB (extends T021's file)
- [X] T030 [US2] Add integration test to `frontend/tests/integration/UploadDropzone.test.tsx` for displaying rejection messages on invalid-type, oversized, and mixed-batch uploads (extends T022's file)

### Implementation for User Story 2

- [X] T031 [US2] Add validation to `addFiles` using `validateFile` — validate every file in the batch, populate `rejections` for invalid ones, leave the valid-PDF acceptance path from T026 unchanged — in `frontend/src/hooks/useSourceDocuments.ts` (depends on T010, T026, T009)
- [X] T032 [US2] Implement rejection error message UI (names the file, states the reason) in `frontend/src/components/sources/UploadDropzone.tsx` (depends on T024, T031) — required adding an optional `rejections` prop to `UploadDropzoneProps`, extending it beyond `contracts/ui-contracts.md`'s original shape

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently — valid uploads succeed, invalid ones are clearly rejected.

---

## Phase 5: User Story 3 - Export the Document List (Priority: P3)

**Goal**: User can export the currently displayed document list to a CSV file.

**Independent Test**: With one or more documents listed, click "Export CSV" and confirm a downloaded CSV has one row per document with name/size/date/status; with an empty list, confirm the CSV has only the header row.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T033 [P] [US3] Unit test for `exportCsv` producing correct rows for a populated list and header-only output for an empty list in `frontend/tests/unit/exportCsv.test.ts`
- [X] T034 [US3] Add integration test to `frontend/tests/integration/DocumentList.test.tsx` confirming the "Export CSV" button invokes `exportCsv` with the currently displayed documents (extends T023's file)

### Implementation for User Story 3

- [X] T035 [P] [US3] Implement `exportCsv` utility (build CSV string, trigger download via `Blob` + temporary `<a download>`, no network call) in `frontend/src/lib/exportCsv.ts` per contract in `contracts/ui-contracts.md`
- [X] T036 [US3] Wire the "Export CSV" button in `DocumentList` to call `exportCsv(documents)` in `frontend/src/components/sources/DocumentList.tsx` (depends on T025, T035)
- [X] T037 [US3] Add the "View All" control as a static, non-functional visual element matching the design in `frontend/src/components/sources/DocumentList.tsx` (FR-014) — already added during T025 (no click handler)

**Checkpoint**: All user stories should now be independently functional — upload, validation/rejection, and CSV export all work end-to-end.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification and final visual/documentation pass across all stories

- [X] T038 [P] Playwright e2e test covering the full upload → list → export flow in `frontend/tests/e2e/data-sources-screen.spec.ts` per constitution Principle II, explicitly asserting: the uploaded file appears in the list within 2 seconds (SC-001), a rejected (invalid-type/oversized) upload never appears, CSV export completes in 2 clicks or fewer (SC-005), and reloading the page after uploading resets the document list to empty (FR-009)
- [X] T039 Visual QA pass comparing the rendered `DataSourcesScreen` against `assets/sources/screen.png` side-by-side (SC-006) — verified via live browser screenshot: layout, colors, typography, upload area, constraint chips, and status-chip colors (amber "PROCESSING" → teal "PROCESSED") all match the design
- [X] T040 [P] Add `dev`/`build`/`test`/`test:e2e` scripts to `frontend/package.json` and verify each runs cleanly
- [X] T041 Run all manual validation scenarios in `quickstart.md` and confirm they pass — scenarios 1–8 verified by the automated e2e test (T038) and component tests; scenario 9 (reload resets state) verified by T038

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 has no dependency on Stories 2/3
  - User Story 2 extends the `useSourceDocuments`/`UploadDropzone` files built in Story 1, so it is implemented after Story 1 in practice even though its acceptance criteria are independently testable
  - User Story 3 extends the `DocumentList` file built in Story 1, so it is implemented after Story 1 in practice even though its acceptance criteria are independently testable
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Shares files with US1 (`useSourceDocuments.ts`, `UploadDropzone.tsx`) so is sequenced after US1 to avoid merge conflicts, but its acceptance scenarios are independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Shares a file with US1 (`DocumentList.tsx`) so is sequenced after US1 to avoid merge conflicts, but its acceptance scenarios are independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/utilities before hook before components (Foundational)
- Hook/component logic before styling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] (T002–T006) can run in parallel once T001 completes
- Foundational implementation tasks marked [P] (T007, T008, T009, T011, T012, T013) can run in parallel; T010 needs only T007 (it does not yet use `validateFile`), T014 needs T011–T013
- Foundational test tasks T016–T018 can run in parallel once their respective components exist; T019 waits on T014+T015
- Within User Story 1, tests T020–T023 can run in parallel; implementation tasks T024–T026 touch different files and can largely run in parallel, with T027 waiting on all three
- Within User Story 3, T033 (new file) and T035 (new file) can run in parallel; T034/T036 touch shared files from earlier tasks and are sequential

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for formatFileSize in frontend/tests/unit/formatFileSize.test.ts"
Task: "Unit test for validateFile accepting valid PDFs in frontend/tests/unit/fileValidation.test.ts"
Task: "Integration test for UploadDropzone in frontend/tests/integration/UploadDropzone.test.tsx"
Task: "Integration test for DocumentList in frontend/tests/integration/DocumentList.test.tsx"

# Launch independent implementation files for User Story 1 together:
Task: "Implement UploadDropzone in frontend/src/components/sources/UploadDropzone.tsx"
Task: "Implement DocumentList in frontend/src/components/sources/DocumentList.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run `quickstart.md` scenarios 1–3 and 9
5. Demo the upload → list flow

### Incremental Delivery

1. Complete Setup + Foundational → app shell renders and is test-covered
2. Add User Story 1 → validate independently → MVP demo (upload + list)
3. Add User Story 2 → validate independently → invalid uploads are rejected
4. Add User Story 3 → validate independently → CSV export works
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Tests MUST be written and confirmed failing before their corresponding implementation task
- Shared/foundational components get tests in Phase 2 alongside their implementation, not deferred to a later story — no component is exempt from constitution Principle II
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts across parallel tasks, cross-story dependencies that break independent testability
