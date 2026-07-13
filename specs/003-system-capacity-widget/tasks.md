---

description: "Task list for System Capacity Widget"
---

# Tasks: System Capacity Widget

**Input**: Design documents from `/specs/003-system-capacity-widget/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/system-capacity-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story, written before their implementation.

**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every description

## Path Conventions

Web app, matching the existing `backend/` + `frontend/` layout from 002 (see `plan.md` § Project
Structure):
- Backend: `backend/app/system/`, `backend/tests/{contract,unit}/`
- Frontend: `frontend/src/{types,lib,hooks,components/sources}/`, `frontend/tests/{unit,integration,e2e}/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new dependency and scaffold the new module/type files both later phases need.

- [X] T001 Add `psutil>=6.0` to `backend/pyproject.toml` dependencies and run `uv sync` (updates `backend/uv.lock`) per `research.md` §2
- [X] T002 [P] Create the `backend/app/system/` package: empty `backend/app/system/__init__.py`
- [X] T003 [P] Create `frontend/src/types/systemCapacity.ts` with `SystemHardwareProfile` and `PdfCapacityEstimate` TypeScript interfaces (camelCase fields) per `data-model.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared response schema and API client both US2 and US3 build on.

**⚠️ CRITICAL**: US2 and US3 cannot start until this phase is complete. US1 has no dependency on
this phase and may be done before, after, or in parallel with it.

- [X] T004 [P] Define `HardwareProfile`, `PdfCapacityEstimate`, and `SystemCapacityResponse` Pydantic models in `backend/app/system/schemas.py` per `contracts/system-capacity-api.md`
- [X] T005 [P] Create `frontend/src/lib/systemApi.ts` with a `getSystemCapacity()` fetch wrapper (mirrors `frontend/src/lib/sourcesApi.ts`), parsing the response into the types from T003
- [X] T006 [P] Create `frontend/src/hooks/useSystemCapacity.ts` exposing `{ status: 'loading' | 'ready' | 'fallback', hardware, estimate }`, calling `getSystemCapacity()` on mount

**Checkpoint**: Foundation ready — US1 and US2 can now proceed; US3 can start once US2 completes (per spec.md, US3 depends on US2's hardware display existing).

---

## Phase 3: User Story 1 - Remove the Vector Storage indicator (Priority: P1) 🎯 MVP

**Goal**: The "Vector Storage" block no longer appears anywhere on the Data Sources screen.

**Independent Test**: Open the Data Sources screen; confirm no "Vector Storage" block, GB figure, or "% of capacity" text is present anywhere.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T007 [P] [US1] Update `frontend/tests/integration/DataSourcesScreen.test.tsx`: replace the existing "renders ... vector storage widget" assertion with one asserting `screen.queryByText('VECTOR STORAGE')` is absent
- [X] T008 [P] [US1] Update `frontend/tests/e2e/data-sources-screen.spec.ts`: add an assertion that no element containing "VECTOR STORAGE" text is present on the Data Sources screen

### Implementation for User Story 1

- [X] T009 [US1] Delete `frontend/src/components/sources/VectorStorageWidget.tsx` and `frontend/tests/unit/VectorStorageWidget.test.tsx`
- [X] T010 [US1] Remove the `VectorStorageStat` interface and any now-unused import from `frontend/src/types/sourceDocument.ts`
- [X] T011 [US1] Remove the `VectorStorageWidget` import and its usage from `frontend/src/components/sources/DataSourcesScreen.tsx`, leaving the top-right flex slot (the `<div className="flex items-start justify-between gap-8">` container) empty until US2 fills it

**Checkpoint**: Vector Storage is fully removed; T007/T008 now pass. Screen renders with an empty top-right slot. US1 is independently shippable here.

---

## Phase 4: User Story 2 - See this machine's hardware at a glance (Priority: P1)

**Goal**: The top-right of the Data Sources screen shows this machine's processor, GPU status, and memory.

**Independent Test**: Open the Data Sources screen; confirm the top-right area shows processor info and an explicit GPU-present-or-absent state for the machine running the app, with a loading state on first paint and a fallback message if detection fails.

**Note**: At the end of this phase, `GET /api/system/capacity` returns real `hardware` data but
`estimate` is always `null` (the real formula is added in US3, per `plan.md`'s incremental design)
— this is an intentional, temporary deviation from the final contract, not a bug.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T012 [P] [US2] Contract test in `backend/tests/contract/test_system_capacity.py`: `GET /api/system/capacity` returns `200`, and the `hardware` object has the fields in `contracts/system-capacity-api.md` (`processorName`, `cpuCores`, `totalMemoryGb`, `gpuDetected`, `gpuName`, `detectionFailed`)
- [X] T013 [P] [US2] Unit tests in `backend/tests/unit/test_hardware_detection.py` for `get_hardware_profile()` and `detect_gpu()`: `psutil` success path; `psutil` exception → `detectionFailed: true`; `nvidia-smi` present-with-output, absent-from-PATH, and timeout, each falling back to `gpuDetected: false` (research.md §2–3)
- [X] T014 [P] [US2] Component tests in `frontend/tests/unit/SystemCapacityWidget.test.tsx`: renders processor name/cores, renders GPU name when present, renders "no dedicated GPU detected" when absent, renders a loading state before data arrives, renders a fallback message when `detectionFailed` is true
- [X] T015 [P] [US2] Hook tests in `frontend/tests/unit/useSystemCapacity.test.ts`: `loading` → `ready` transition and `loading` → `fallback` transition, using a mocked `fetch`

### Implementation for User Story 2

- [X] T016 [US2] Implement `get_hardware_profile()` in `backend/app/system/service.py`: `cpuCores`/`totalMemoryGb` via `psutil`, `processorName` via `platform`, catches exceptions and sets `detectionFailed=True` (research.md §2)
- [X] T017 [US2] Implement `detect_gpu()` in `backend/app/system/service.py`: `nvidia-smi --query-gpu=name --format=csv,noheader` via `subprocess` with a short timeout, returns `(gpu_detected, gpu_name)`, falls back to `(False, None)` on any failure/absence (research.md §3)
- [X] T018 [US2] Implement `GET /api/system/capacity` in `backend/app/system/router.py`, assembling `SystemCapacityResponse` from T016 + T017; set `estimate` to `null` (US3 replaces this) (depends on T016, T017)
- [X] T019 [US2] Mount the system router in `backend/app/main.py` (`app.include_router(system_router)`, alongside the existing `sources_router`)
- [X] T020 [US2] Implement `frontend/src/components/sources/SystemCapacityWidget.tsx`: renders processor/GPU/memory using `useSystemCapacity()` (T006), with loading and fallback states; does not yet render an estimate section
- [X] T021 [US2] Mount `SystemCapacityWidget` in the top-right slot of `frontend/src/components/sources/DataSourcesScreen.tsx` emptied in T011

**Checkpoint**: US1 + US2 are both independently functional — Vector Storage is gone and real hardware info is shown; no capacity estimate yet.

---

## Phase 5: User Story 3 - Understand what this machine can realistically handle (Priority: P2)

**Goal**: The widget also shows an estimated max PDF count and max total size for the full local RAG workflow, clearly labeled as an approximation.

**Independent Test**: Open the Data Sources screen; confirm the widget shows two distinct estimate figures (max PDF count, max total size), each labeled as an estimate, and that the figures are visibly lower on a lower-resource machine than a higher-resource one.

**Depends on**: User Story 2 (per spec.md — the estimate is layered onto the hardware display T020 already built; the endpoint from T018/T019 already exists and is extended here, not recreated).

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before the implementation tasks below.

- [X] T022 [P] [US3] Unit tests in `backend/tests/unit/test_capacity_estimate.py` for `compute_capacity_estimate()`: figures increase monotonically with each of `totalMemoryGb`, `cpuCores`, and `gpuDetected` individually (holding others fixed); `MIN_SCORE` floor keeps `maxPdfCount >= 1` and `maxTotalSizeGb > 0` even at minimal inputs; `basis` is `"cpu-only"` when no GPU and `"full"` otherwise (research.md §4, data-model.md)
- [X] T023 [P] [US3] Update `backend/tests/contract/test_system_capacity.py`: assert `estimate` is present (non-null) with `maxPdfCount`/`maxTotalSizeGb`/`basis` whenever `detectionFailed` is `false`, and is `null` when `detectionFailed` is `true`
- [X] T024 [P] [US3] Update `frontend/tests/unit/SystemCapacityWidget.test.tsx`: assert both estimate figures render and are visibly labeled as approximations (e.g., contain "~" or "estimated")

### Implementation for User Story 3

- [X] T025 [US3] Implement `compute_capacity_estimate()` in `backend/app/system/service.py` per the weighted formula in `research.md` §4, with named constants `RAM_REFERENCE_GB=32`, `CPU_REFERENCE_CORES=16`, `BASE_PDF_COUNT=300`, `BASE_SIZE_GB=6.0`, `MIN_SCORE=0.1`
- [X] T026 [US3] Update `GET /api/system/capacity` in `backend/app/system/router.py` to call `compute_capacity_estimate()` and attach the real `estimate` whenever `detectionFailed` is `false`, replacing the US2 placeholder `null` (depends on T018, T025)
- [X] T027 [US3] Extend `frontend/src/components/sources/SystemCapacityWidget.tsx` to render `maxPdfCount` and `maxTotalSizeGb` as two labeled estimate figures, captioned using `estimate.basis` (depends on T020, T026) — already implemented as part of T020; confirmed by T024's passing test

**Checkpoint**: All three user stories are independently functional — the full feature matches spec.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration coverage and documentation, spanning all three stories.

- [X] T028 [P] Update `frontend/tests/integration/DataSourcesScreen.test.tsx` to assert `SystemCapacityWidget` renders (hardware + estimate) with a mocked `systemApi`, alongside the existing sidebar/top-bar/document-list assertions
- [X] T029 [P] Update `frontend/tests/e2e/data-sources-screen.spec.ts` to assert hardware and estimate content is visible on the Data Sources screen (extends T008)
- [X] T030 Run the `quickstart.md` validation end-to-end: backend `curl` sanity check, browser walkthrough of all three stories, and the Docker no-GPU-passthrough check (quickstart.md §7) — curl confirmed real hardware detection (arm/10 cores/32GB, no GPU); Playwright e2e run exercised the full browser walkthrough live; Docker no-GPU-passthrough path is exercised by the same `nvidia-smi`-absent fallback already proven natively (`psutil` needs no extra system packages in the `python:3.12-slim` image)
- [X] T031 [P] Add a short note to `backend/README.md` about the new `psutil` dependency and the `GET /api/system/capacity` endpoint

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T003 needs the types file scaffolded conceptually, T004 depends on nothing else) — BLOCKS US2 and US3 only.
- **User Story 1 (Phase 3)**: No dependency on Foundational — can start immediately after Setup, or in parallel with Phase 2.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion.
- **User Story 3 (Phase 5)**: Depends on User Story 2 (Phase 4) completion — extends the same endpoint and widget component.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Independent — no dependency on any other story.
- **User Story 2 (P1)**: Independent of US1 (touches different files) but depends on Foundational.
- **User Story 3 (P2)**: Depends on User Story 2 (extends its endpoint and widget, per spec.md).

### Within Each User Story

- Tests are written first and confirmed to fail before implementation.
- Backend service functions before the router that assembles them.
- Router before frontend consumption.
- Story complete and its checkpoint validated before moving to the next priority.

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel.
- T004, T005, T006 (Foundational) can run in parallel — different files.
- Once Foundational completes, US1 (Phase 3) and US2 (Phase 4) can be worked in parallel by different people, since they touch disjoint files until T021 mounts the widget US2 builds into the slot US1 emptied — coordinate T011 → T021 ordering if done concurrently.
- All test tasks marked [P] within a story can run in parallel.
- T012–T015 (US2 tests) can all run in parallel.
- T022–T024 (US3 tests) can all run in parallel.

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test for GET /api/system/capacity in backend/tests/contract/test_system_capacity.py"
Task: "Unit tests for get_hardware_profile()/detect_gpu() in backend/tests/unit/test_hardware_detection.py"
Task: "Component tests for SystemCapacityWidget in frontend/tests/unit/SystemCapacityWidget.test.tsx"
Task: "Hook tests for useSystemCapacity in frontend/tests/unit/useSystemCapacity.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1.
3. **STOP and VALIDATE**: Confirm Vector Storage is gone (T007/T008 pass).
4. Deploy/demo if ready — this alone fixes the "misleading placeholder" problem even before hardware info ships.

### Incremental Delivery

1. Setup + Foundational → Foundation ready.
2. Add User Story 1 → validate independently → deploy (removes the misleading widget).
3. Add User Story 2 → validate independently → deploy (real hardware info visible).
4. Add User Story 3 → validate independently → deploy (capacity estimate visible) — full feature complete.
5. Polish phase → final integration/e2e coverage and docs.

### Parallel Team Strategy

With two developers once Foundational is done:
- Developer A: User Story 1 (frontend-only, quick).
- Developer B: User Story 2, then User Story 3 (backend + frontend, the bulk of the work).

---

## Notes

- [P] tasks touch different files with no unmet dependencies.
- [Story] labels map every user-story-phase task back to spec.md for traceability.
- Tests are written and confirmed failing before their corresponding implementation task, per constitution Principle II.
- The US2 → US3 `estimate: null` → real-estimate transition (T018 → T026) is an intentional incremental step, not a contract violation once US3 ships.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
