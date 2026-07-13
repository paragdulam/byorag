---

description: "Task list for Delete Source Documents"
---

# Tasks: Delete Source Documents

**Input**: Design documents from `/specs/004-delete-source-documents/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/delete-sources-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story, written before their implementation.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Exact file paths are included in every description

## Path Conventions

Web app, matching the existing `backend/` + `frontend/` layout (see `plan.md` § Project
Structure):
- Backend: `backend/app/sources/`, `backend/tests/{contract,unit}/`
- Frontend: `frontend/src/{types,lib,hooks,components/sources}/`, `frontend/tests/{unit,integration,e2e}/`

---

## Phase 1: Setup

**Purpose**: N/A — this feature adds no new dependencies, packages, or scaffolding. It extends the
existing `backend/app/sources/` module and the existing frontend sources component/hook/lib trio
in place. No Setup tasks are required; numbering begins at Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Per `research.md` §1, a single backend endpoint and a single frontend hook function
handle both single-document and bulk delete identically (the only difference is how many ids the
caller passes) — so the entire backend implementation and the shared frontend plumbing are
genuinely common to both user stories, not story-specific.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Define `DeletionResult`, `DeleteSourcesRequest`, `DeleteSourcesResponse` Pydantic models in `backend/app/sources/schemas.py` per `contracts/delete-sources-api.md`
- [X] T002 Implement a path-safety guard and `delete_documents(ids: list[str], pdfs_dir: Path | None = None) -> list[DeletionResult]` in `backend/app/sources/service.py` per `research.md` §3: rejects any id containing `/` or `\` or resolving outside `pdfs_dir` as `status: "failed", reason: "invalid id"` without touching the filesystem; `FileNotFoundError` on unlink → `status: "deleted"` (already-absent, FR-006); any other `OSError` → `status: "failed"` with `reason` set to the error message
- [X] T003 Implement `POST /api/sources/delete` in `backend/app/sources/router.py`, always returning `200` with `DeleteSourcesResponse`, delegating to `service.delete_documents()` (depends on T001, T002)
- [X] T004 [P] Add a `DeletionResult` TypeScript interface to `frontend/src/types/sourceDocument.ts` per `data-model.md`
- [X] T005 [P] Add `deleteSources(ids: string[]): Promise<DeletionResult[]>` to `frontend/src/lib/sourcesApi.ts`, POSTing `{ ids }` to `/api/sources/delete` and returning `body.results` (depends on T004)
- [X] T006 Add `deleteDocuments(ids: string[])` and a `deletionErrors: DeletionResult[]` state to `frontend/src/hooks/useSourceDocuments.ts`: calls `deleteSources`, removes every `status: "deleted"` id from `documents`, and appends every `status: "failed"` result to `deletionErrors` (depends on T005)

**Checkpoint**: Foundation ready — both US1 and US2 can now proceed; each only adds UI wiring in `DocumentList.tsx` against this same shared `deleteDocuments` function.

---

## Phase 3: User Story 1 - Delete a single document from my corpus (Priority: P1) 🎯 MVP

**Goal**: The user can delete one document from the Document List, with a required confirmation
step, and the deletion is permanent and persisted.

**Independent Test**: Upload a document, trigger delete on it, confirm, and verify it no longer
appears in the list and no longer exists in backend storage (including after a page reload).

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T007 [P] [US1] Contract test in `backend/tests/contract/test_delete_sources.py`: `POST /api/sources/delete` returns `200` with one `DeletionResult` per requested id; an already-absent id is reported as `status: "deleted"`, not an error, per `contracts/delete-sources-api.md`
- [X] T008 [P] [US1] Unit tests in `backend/tests/unit/test_service_deletion.py` for `delete_documents()`: a real file is removed and reported `"deleted"`; an already-absent file is reported `"deleted"` without raising; a mocked `OSError` (e.g., permission denied) is reported `"failed"` with a `reason`; an id containing `/` or resolving outside `pdfs_dir` is reported `"failed", reason: "invalid id"` and the filesystem is never touched
- [X] T009 [P] [US1] Component tests in `frontend/tests/unit/DocumentList.test.tsx`: a delete control renders only for rows with `status === 'processed'` (never for `'processing'`, FR-007); clicking it and confirming (`window.confirm` mocked to return `true`) calls `onDeleteDocuments([id])`; clicking it and cancelling (`window.confirm` mocked to return `false`) does not call `onDeleteDocuments`
- [X] T010 [P] [US1] Hook tests in `frontend/tests/unit/useSourceDocuments.test.ts`: `deleteDocuments(['a.pdf'])` on a successful response removes `'a.pdf'` from `documents`; a `"failed"` result leaves the document in `documents` and adds an entry to `deletionErrors`

### Implementation for User Story 1

- [X] T011 [US1] Add a per-row delete control to `frontend/src/components/sources/DocumentList.tsx`, rendered only when `doc.status === 'processed'`, that calls `window.confirm(\`Delete ${doc.name}?\`)` and, if confirmed, invokes a new `onDeleteDocuments(ids: string[])` prop with `[doc.id]`
- [X] T012 [US1] Wire `DocumentList`'s `onDeleteDocuments` prop to `useSourceDocuments().deleteDocuments` in `frontend/src/components/sources/DataSourcesScreen.tsx` (depends on T006, T011)
- [X] T013 [US1] Render `deletionErrors` as inline error messages near the Document List in `frontend/src/components/sources/DataSourcesScreen.tsx`, matching the existing upload-rejection message style (FR-005) (depends on T012)

**Checkpoint**: Single-document delete works end-to-end — T007–T010 now pass. US1 is independently shippable here (MVP).

---

## Phase 4: User Story 2 - Delete multiple documents at once (Priority: P2)

**Goal**: The user can select several documents and delete them together in one confirmed action.

**Independent Test**: Upload several documents, select more than one, trigger bulk delete, confirm
once, and verify all selected documents are removed while unselected ones remain.

**Depends on**: User Story 1's `DocumentList.tsx` delete affordance and the shared
`deleteDocuments` function from Foundational — this story only adds selection UI and reuses both.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T014 [P] [US2] Component tests in `frontend/tests/unit/DocumentList.test.tsx`: a checkbox renders per `status === 'processed'` row; "Delete Selected" is disabled when nothing is selected and enabled once ≥1 row is checked; clicking it with multiple rows selected calls `window.confirm` exactly once and, if confirmed, invokes `onDeleteDocuments` with all selected ids
- [X] T015 [P] [US2] Unit test in `backend/tests/unit/test_service_deletion.py`: `delete_documents()` called with a mixed list (one real file, one already-absent id, one id that raises `OSError`) returns exactly one `DeletionResult` per id, in the same order as the request, each with its own independent outcome (FR-009)

### Implementation for User Story 2

- [X] T016 [US2] Add a checkbox column and local selection state (for `status === 'processed'` rows only) to `frontend/src/components/sources/DocumentList.tsx`
- [X] T017 [US2] Add a "Delete Selected" button next to "Export CSV"/"View All" in `frontend/src/components/sources/DocumentList.tsx`, disabled with zero selections, calling `window.confirm(\`Delete ${count} documents?\`)` then `onDeleteDocuments(selectedIds)`, clearing the selection once the call resolves (depends on T016)

**Checkpoint**: All user stories are independently functional — the full feature matches spec.md.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final integration coverage, spanning both stories.

- [X] T018 [P] Update `frontend/tests/integration/DataSourcesScreen.test.tsx`: upload a document then delete it (mocked `systemApi`/`sourcesApi`), asserting the row is removed end-to-end
- [X] T019 [P] Update `frontend/tests/e2e/data-sources-screen.spec.ts`: extend the existing flow with upload → delete → reload → confirm the document is gone
- [X] T020 Run the `quickstart.md` validation end-to-end: backend `curl` sanity check (already-absent id → `"deleted"`), browser walkthrough of both stories, and the partial-failure scenario (quickstart.md §5) — curl confirmed already-absent and bulk-delete behavior live against the running dev backend; the Playwright e2e run exercised the full US1 browser walkthrough (upload → delete → reload-confirms-gone); bulk delete (US2) and the partial-failure/path-traversal cases are covered by T008/T014/T015's automated tests rather than a second live e2e pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A — no tasks.
- **Foundational (Phase 2)**: BLOCKS US1 and US2 — both stories call the same backend endpoint and the same `deleteDocuments` hook function built here.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion, and reuses the `DocumentList.tsx` delete affordance introduced in User Story 1 (Phase 3) — practically sequential after US1 even though the backend requires nothing further.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent once Foundational is done — no dependency on User Story 2.
- **User Story 2 (P2)**: Builds on the same `DocumentList.tsx` file and delete affordance User Story 1 adds; implement after US1 to avoid rework, even though the backend already supports both from Foundational.

### Within Each User Story

- Tests are written first and confirmed to fail before implementation.
- Backend service/router changes (Foundational, this feature) before frontend consumption.
- Story complete and its checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T001 and T004 (Foundational, different files/languages) can run in parallel.
- T007–T010 (US1 tests) can all run in parallel — different files.
- T014–T015 (US2 tests) can run in parallel — different files.
- T018 and T019 (Polish) can run in parallel — different files.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for POST /api/sources/delete in backend/tests/contract/test_delete_sources.py"
Task: "Unit tests for delete_documents() in backend/tests/unit/test_service_deletion.py"
Task: "Component tests for delete control in frontend/tests/unit/DocumentList.test.tsx"
Task: "Hook tests for deleteDocuments in frontend/tests/unit/useSourceDocuments.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: Confirm single-document delete works end-to-end (T007–T010 pass, quickstart.md §3).
4. Deploy/demo if ready — this alone satisfies the original request ("delete PDFs on demand").

### Incremental Delivery

1. Foundational → shared backend endpoint and hook function ready.
2. Add User Story 1 → validate independently → deploy (single-document delete).
3. Add User Story 2 → validate independently → deploy (bulk delete convenience) — full feature complete.
4. Polish phase → final integration/e2e coverage.

### Parallel Team Strategy

With two developers once Foundational is done:
- Developer A: User Story 1 (the `DocumentList.tsx` delete affordance + wiring).
- Developer B: waits for US1's `DocumentList.tsx` changes to land (same file), then picks up User Story 2's selection UI on top of it — genuine parallelism here is limited by both stories touching the same component; the backend (Foundational) is the truly parallelizable half of this feature.

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- [Story] labels map every user-story-phase task back to spec.md for traceability.
- Tests are written and confirmed failing before their corresponding implementation task, per constitution Principle II.
- Unlike a typical layered feature, the backend here is fully built once (Foundational) and never revisited by either story — both stories are frontend-only from that point on, per research.md §1's single-endpoint design.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
