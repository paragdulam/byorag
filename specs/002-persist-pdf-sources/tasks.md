---

description: "Task list for persisting uploaded PDFs to the filesystem"
---

# Tasks: Persist Uploaded PDFs to Filesystem

**Input**: Design documents from `/specs/002-persist-pdf-sources/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sources-api.md, quickstart.md

**Tests**: Included and MANDATORY per this project's constitution (Principle II: Test-First, Test at Every Level).

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes an exact file path

## Path Conventions

Web app structure per `plan.md`: `backend/app/`, `backend/tests/{contract,integration,unit}/`, `frontend/src/`, `frontend/tests/{unit,integration,e2e}/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the repo's first backend project and the Docker wiring it needs.

- [X] T001 Create the `backend/` directory skeleton (`backend/app/`, `backend/app/sources/`, `backend/tests/contract/`, `backend/tests/integration/`, `backend/tests/unit/`) per `plan.md` Project Structure
- [X] T002 [P] Create `backend/pyproject.toml` declaring FastAPI, Uvicorn, `python-multipart`, `pytest`, and `httpx` as dependencies (Python 3.12, matching root `.python-version`)
- [X] T003 [P] Create `backend/Dockerfile` that installs `backend/pyproject.toml` dependencies and runs the app with Uvicorn
- [X] T004 [P] Create `docker-compose.yml` at the repo root wiring a `frontend` service and a `backend` service, with a named volume mounted at `/data/pdfs` on the backend service and `PDFS_DIR=/data/pdfs` set (research.md §2)
- [X] T005 [P] Add `pdfs/` (local default storage dir) and backend build artifacts (`backend/.venv/`, `__pycache__/`) to the root `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend scaffolding and frontend API client shared by every user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Create `backend/app/config.py` with a `Settings` object exposing `PDFS_DIR` (from the `PDFS_DIR` env var, default `./pdfs`) and an `ensure_pdfs_dir()` helper that creates the directory if it does not exist (FR-002)
- [X] T007 [P] Create `backend/app/sources/schemas.py` with `SourceDocument` and `UploadRejection` Pydantic models exactly per `data-model.md` (including the `"save-failed"` rejection reason)
- [X] T008 Create `backend/app/main.py`: instantiate the FastAPI app, add CORS middleware for the local frontend dev origin, and mount the (not-yet-implemented) sources router at `/api/sources` (depends on T006, T007)
- [X] T009 [P] Update `frontend/src/types/sourceDocument.ts`: document that `id`/`uploadedAt` are now server-sourced (on-disk filename / parsed ISO datetime) and add `"save-failed"` to `UploadRejectionReason`, per `data-model.md`
- [X] T010 [P] Create `frontend/src/lib/sourcesApi.ts` with `listSources()` and `uploadSources(files)` functions that call `${VITE_API_BASE_URL}/api/sources` and parse responses per `contracts/sources-api.md`. **`listSources()`/`uploadSources()` MUST parse each document's `uploadedAt` field from the API's ISO 8601 string into a JavaScript `Date`** (via `new Date(iso)`) before returning — `frontend/src/lib/exportCsv.ts` (`doc.uploadedAt.toISOString()`) and `frontend/src/components/sources/DocumentList.tsx` (`formatUploadedAt(date: Date)`) both require a real `Date`, not a raw string

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Uploaded PDFs Survive a Page Refresh (Priority: P1) 🎯 MVP

**Goal**: Uploaded PDFs are saved to the `pdfs` directory and the document list is populated from that directory on every load, so a refresh (or reopening the app) no longer loses uploaded sources.

**Independent Test**: Upload a valid PDF, confirm it appears in the list, refresh the page, and confirm the same document is still listed with the same name/size/upload time.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these tests FIRST; confirm they FAIL before implementing this phase.

- [X] T011 [P] [US1] Contract test: `GET /api/sources` returns `{"documents": []}` against an empty temp `PDFS_DIR`, then returns the saved document after a file is placed there, in `backend/tests/contract/test_list_sources.py`
- [X] T012 [P] [US1] Contract test: `POST /api/sources` with (a) one valid PDF and (b) three valid PDFs in a single request both return `200` with one `documents` entry per file, each entry's `name`/`sizeBytes`/`uploadedAt`/`status` matching its uploaded file (FR-010 multi-file coverage), in `backend/tests/contract/test_upload_sources_happy_path.py`
- [X] T013 [P] [US1] Integration test: upload via `POST /api/sources` then call `GET /api/sources` and confirm the file is reflected, against a temporary `PDFS_DIR`, in `backend/tests/integration/test_sources_persistence.py`
- [X] T014 [P] [US1] Unit test: mapping a file's `os.stat()` result to `SourceDocument` fields (`sizeBytes`, `uploadedAt` from `st_mtime`, `status="processed"`) in `backend/tests/unit/test_service_listing.py`
- [X] T015 [P] [US1] Unit test: `ensure_pdfs_dir()` creates the directory when it does not exist and is a no-op when it already exists, in `backend/tests/unit/test_config.py`
- [X] T016 [P] [US1] Integration test (FR-008): save two files to a temp `PDFS_DIR`, delete one directly from disk (not via the API), then call `GET /api/sources` and confirm only the remaining file is listed, in `backend/tests/integration/test_sources_removed_externally.py`
- [X] T017 [P] [US1] Frontend test: `useSourceDocuments` calls `listSources()` on mount to populate documents, and calls `uploadSources(files)` from `addFiles` instead of simulating locally, with `fetch` mocked. **Explicitly assert that documents returned by the mount-time `listSources()` call render with `status: 'processed'` immediately** (FR-007 — no simulated processing delay applies to already-saved documents), in `frontend/tests/unit/useSourceDocuments.test.ts`
- [X] T018 [P] [US1] E2E test: upload a PDF, reload the page, confirm the document is still listed, added to `frontend/tests/e2e/data-sources-screen.spec.ts`
- [X] T019 [P] [US1] Regression test (FR-011): extend `frontend/tests/unit/exportCsv.test.ts` so `buildCsv`/`exportCsv` are exercised against a `SourceDocument` whose `uploadedAt` is a `Date` parsed from an ISO string (i.e., shaped exactly as `sourcesApi.listSources()` now produces it per T010), confirming `doc.uploadedAt.toISOString()` does not throw and the CSV still renders the date correctly

### Implementation for User Story 1

- [X] T020 [US1] Implement `backend/app/sources/service.py` with `save_file(upload)` (writes to `PDFS_DIR`, happy path, supports being called once per file in a multi-file request) and `list_documents()` (lists `PDFS_DIR`, maps each entry via `os.stat()` to `SourceDocument`, excludes any name no longer present on disk) (depends on T006, T007, T015)
- [X] T021 [US1] Implement `backend/app/sources/router.py` with `GET /api/sources` and `POST /api/sources` (happy path, iterating over all files submitted under the `files` field) calling `service.py`, wired into `backend/app/main.py` (depends on T008, T020)
- [X] T022 [US1] Update `frontend/src/hooks/useSourceDocuments.ts`: fetch the list via `sourcesApi.listSources()` on mount, call `sourcesApi.uploadSources(files)` from `addFiles`, and remove the local-only `crypto.randomUUID()` / simulated-delay logic entirely — mount-fetched and upload-response documents are both already `"processed"` per the API contract, so no client-side delay timer remains anywhere in this hook (depends on T010)
- [X] T023 [US1] Update `frontend/src/components/sources/DataSourcesScreen.tsx` to show a brief loading state while the initial `listSources()` fetch (from `useSourceDocuments`) is in flight (depends on T022)

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Reject Invalid Uploads Before They Reach Disk (Priority: P2)

**Goal**: Non-PDF and over-50MB files are rejected server-side before any write, and a failed disk write never leaves a partial file or a phantom list entry.

**Independent Test**: Upload a non-PDF file and an over-50MB PDF; confirm neither is written to `pdfs/` or listed (before or after a refresh), and each is reported with a specific rejection reason.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T024 [P] [US2] Contract test: `POST /api/sources` rejects a non-PDF file (`reason: "invalid-type"`) and a >50MB PDF (`reason: "too-large"`), with neither written to disk, in `backend/tests/contract/test_upload_sources_validation.py`
- [X] T025 [P] [US2] Integration test: a request mixing one valid and one invalid file results in only the valid file saved and listed, with the invalid one reported individually, in `backend/tests/integration/test_sources_validation_persistence.py`
- [X] T026 [P] [US2] Integration test (FR-009/SC-005): drive an actual disk-write failure through `POST /api/sources` (e.g., point `PDFS_DIR` at a read-only directory for this test) and confirm the response contains a `"save-failed"` rejection, no file is left on disk, and a subsequent `GET /api/sources` shows no corresponding entry, in `backend/tests/integration/test_sources_save_failure_persistence.py`
- [X] T027 [P] [US2] Unit test: `validate_file()` returns `"invalid-type"`/`"too-large"`/valid for the relevant PDF-only/50MB cases, in `backend/tests/unit/test_service_validation.py`
- [X] T028 [P] [US2] Unit test: when the filesystem write raises `OSError`, `save_file()` returns a `"save-failed"` rejection (does not raise) and leaves no partial file on disk, in `backend/tests/unit/test_service_save_failure.py`

### Implementation for User Story 2

- [X] T029 [US2] Add `validate_file()` to `backend/app/sources/service.py` (PDF-only + 50MB checks) and wrap the disk write in `save_file()` in a `try`/`except OSError` that cleans up any partial file and returns a `"save-failed"` rejection (depends on T020)
- [X] T030 [US2] Update `backend/app/sources/router.py`'s `POST /api/sources` handler to call `validate_file()` per file before saving, collecting results into `documents`/`rejections` (depends on T021, T029)
- [X] T031 [US2] Update `frontend/src/hooks/useSourceDocuments.ts` / `frontend/src/components/sources/UploadDropzone.tsx` to surface server-returned rejections (`invalid-type`/`too-large`/`save-failed`) alongside the existing client-side pre-check messages (depends on T022)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Re-uploading a File With the Same Name (Priority: P3)

**Goal**: Uploading a file whose name collides with an existing saved file never overwrites it — the new file is saved under a distinct, suffixed name.

**Independent Test**: Upload a PDF named `report.pdf`, then upload a different PDF also named `report.pdf`; confirm both remain on disk and listed under distinct names.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T032 [P] [US3] Contract test: uploading the same filename twice saves the second under a suffixed name (e.g. `report (1).pdf`) and both appear in a subsequent `GET /api/sources`, in `backend/tests/contract/test_upload_sources_collisions.py`
- [X] T033 [P] [US3] Integration test: two sequential uploads with identical filenames leave two distinct files in a temporary `PDFS_DIR`, neither overwriting the other, in `backend/tests/integration/test_sources_collision_persistence.py`
- [X] T034 [P] [US3] Unit test: `resolve_collision_name("report.pdf", existing_names)` returns `"report.pdf"` when free, `"report (1).pdf"` when taken, `"report (2).pdf"` when both taken, etc., in `backend/tests/unit/test_service_collision_naming.py`

### Implementation for User Story 3

- [X] T035 [US3] Add `resolve_collision_name()` to `backend/app/sources/service.py` and call it from `save_file()` before writing, so collisions are always suffixed rather than overwritten (depends on T020)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Wrap-up validation and documentation that spans all stories.

- [X] T036 [P] Update the root `README.md` "Running the app" section to describe running the backend (`uvicorn`) and `docker compose up`, per `quickstart.md`
- [X] T037 [P] Run `ruff` over `backend/` and `oxlint`/`prettier` over changed `frontend/` files, fixing any violations
- [X] T038 Walk through `quickstart.md` steps 1–6 end-to-end manually and fix any discrepancy found between the documented steps and actual behavior
- [X] T039 Walk through `quickstart.md` step 7 (Docker volume persistence: upload, `docker compose restart backend`, confirm the document is still listed) and fix any discrepancy found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User Story 1 (P1) has no dependency on US2/US3.
  - User Story 2 (P2) builds on the `service.py`/`router.py` files US1 creates (T020, T021) but is independently testable once US1's happy path exists.
  - User Story 3 (P3) likewise builds on `service.py`/`router.py` from US1 but is independently testable on its own.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on other stories.
- **User Story 2 (P2)**: Can start after Foundational; touches the same `service.py`/`router.py` files as US1, so implement sequentially after US1's implementation tasks (T020–T021) land, even though its tests (T024–T028) can be written in parallel with US1's.
- **User Story 3 (P3)**: Same relationship as US2 — tests can be written any time after Foundational, implementation (T035) lands after T020.

### Within Each User Story

- Tests are written first and must fail before implementation.
- `service.py` changes precede `router.py` changes, which precede frontend wiring.
- Story is complete and independently testable before moving to the next priority.

### Parallel Opportunities

- All Setup tasks marked [P] (T002–T005) can run in parallel once T001 exists.
- Foundational tasks T007, T009, T010 can run in parallel; T006 and T008 are sequential (T008 depends on T006 and T007).
- All test tasks within a story phase (marked [P]) can be written in parallel, since each targets a distinct file.
- Across stories, test-writing (not implementation) can proceed in parallel: e.g. US2's and US3's test files (T024–T028, T032–T034) can be drafted while US1's implementation (T020–T023) is underway, since they live in separate files.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test GET /api/sources in backend/tests/contract/test_list_sources.py"
Task: "Contract test POST /api/sources happy path (single + multi-file) in backend/tests/contract/test_upload_sources_happy_path.py"
Task: "Integration test save->list round trip in backend/tests/integration/test_sources_persistence.py"
Task: "Unit test stat->model mapping in backend/tests/unit/test_service_listing.py"
Task: "Unit test ensure_pdfs_dir in backend/tests/unit/test_config.py"
Task: "Integration test removed-externally file excluded from list in backend/tests/integration/test_sources_removed_externally.py"
Task: "Frontend hook test in frontend/tests/unit/useSourceDocuments.test.ts"
Task: "E2E reload-persists test in frontend/tests/e2e/data-sources-screen.spec.ts"
Task: "exportCsv regression test against API-shaped dates in frontend/tests/unit/exportCsv.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run `quickstart.md` steps 1–3 independently
5. Deploy/demo if ready — this alone fixes the refresh-loses-documents problem the feature exists for

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → MVP
3. Add User Story 2 → validate independently (invalid uploads never reach disk)
4. Add User Story 3 → validate independently (same-name collisions never overwrite)
5. Polish → README, lint, full quickstart walkthrough including Docker volume persistence

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: User Story 1 (backend `service.py`/`router.py` happy path + frontend wiring)
- Developer B: drafts User Story 2 tests against the contract, then adds validation once US1's `service.py`/`router.py` exist
- Developer C: drafts User Story 3 tests against the contract, then adds collision-naming once US1's `service.py`/`router.py` exist

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- US2 and US3 share `backend/app/sources/service.py` and `router.py` with US1 — their **tests** are independent (separate files, can be written any time), but their **implementation** tasks are sequenced after US1's implementation to avoid conflicting edits to the same files.
- `uploadedAt` crosses the wire as an ISO 8601 string but is used as a `Date` on the frontend (`exportCsv.ts`, `DocumentList.tsx`) — T010 and T022 both call this out explicitly; T019 guards against a regression here.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
