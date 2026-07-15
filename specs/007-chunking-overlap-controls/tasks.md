---

description: "Task list template for feature implementation"
---

# Tasks: Functional Chunk Overlap Controls

**Input**: Design documents from `/specs/007-chunking-overlap-controls/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chunking-overlap-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included below for every user story, at unit, service, contract, and
end-to-end levels as appropriate.

**Organization**: Tasks are grouped by user story (US1, US2, US3 from spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Existing web-application layout (unchanged from `001`–`006`): `backend/app/...` +
`backend/tests/...`, `frontend/src/...` + `frontend/tests/...`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing environment runs before making changes. No new dependencies are
introduced by this feature (research.md, plan.md).

- [X] T001 [P] Verify the backend runs with existing dependencies: `cd backend && uv sync && pytest` (baseline green before any change)
- [X] T002 [P] Verify the frontend runs with existing dependencies: `cd frontend && npm install && npm test` (baseline green before any change)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**None required.** This feature only extends already-scaffolded modules from
`005-fixed-size-chunking`/`006-chunking-embeddings-redesign` (the `ChunkingStrategy` registry, the
`/api/chunking/run/stream` SSE endpoint, and the `FixedSizeChunkingScreen`/`useFixedSizeChunking`
frontend pair). Each user story below is additive to that existing scaffolding and does not share
any new blocking prerequisite with the others — proceed directly to user stories.

**Checkpoint**: Foundation ready (already true) — user story implementation can begin.

---

## Phase 3: User Story 1 - See how much overlap is set at a glance (Priority: P1) 🎯 MVP

**Goal**: The Overlap slider shows its current value as a visible, live-updating number.

**Independent Test**: Open the Fixed Size Chunking screen, drag the Overlap slider, and confirm a
numeric readout updates immediately to match the slider position — no chunking run required.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [US1] Add a test asserting a numeric overlap value is rendered next to the Overlap slider and updates immediately when the slider's value changes, in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`

### Implementation for User Story 1

- [X] T004 [US1] Render the current `overlapValue` state as a visible number alongside the Overlap slider (updating on every `onChange`) in `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` (depends on T003; makes T003 pass)

**Checkpoint**: User Story 1 is fully functional and independently testable — the perceived
"broken slider" now gives immediate visual feedback.

---

## Phase 4: User Story 2 - See the resulting chunk count near the controls (Priority: P2)

**Goal**: The total chunk count from the most recent successful run is displayed below the Overlap
slider, right-aligned with the Separators control.

**Independent Test**: Run chunking once, confirm a chunk count appears below the Overlap slider
right-aligned with Separators; confirm no count is shown before any run has completed; re-run with
different settings and confirm the count updates.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T005 [US2] Add tests asserting: (a) no chunk count is shown before any successful run, (b) the total chunk count (`result.totalChunks`) appears below the Overlap slider and is right-aligned with the Separators control after a successful run, and (c) the count updates after a subsequent successful re-run, in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` (same file as T003 — run after T004 completes, not in parallel)

### Implementation for User Story 2

- [X] T006 [US2] Add a chunk-count element below the Overlap slider, right-aligned with the Separators control, bound to `result.totalChunks` and only rendered when `status === 'success' && result`, in `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` (depends on T005; makes T005 pass)

**Checkpoint**: User Stories 1 AND 2 both work independently — glanceable overlap value and
glanceable result count, without requiring Overlap to be functional yet.

---

## Phase 5: User Story 3 - Chunks actually overlap by the configured amount (Priority: P1)

**Goal**: The Overlap value genuinely changes chunk boundaries and count — the functional core of
the feature (research.md §1–§3, data-model.md, contracts/chunking-overlap-api.md).

**Independent Test**: Chunk a document at a fixed Chunk Size with Overlap `0`, note the result;
re-run with a higher Overlap (still `< chunkSize`) and confirm adjacent chunks now share
trailing/leading text and the total chunk count increases; confirm `overlap >= chunkSize` is
blocked with a clear message.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T007 [P] [US3] Add unit tests for overlapping stride behavior — `overlap > 0` produces chunks that share trailing/leading words, `overlap == 0` is byte-identical to current non-overlapping behavior — in `backend/tests/unit/test_fixed_size_strategy.py`
- [X] T008 [P] [US3] Add unit tests asserting `resolve_run` raises `ValueError` when `overlap >= chunk_size` (or `overlap < 0`), and that `stream_chunking` produces a higher `totalChunks` for the same document/`chunk_size` when `overlap` increases, in `backend/tests/unit/test_chunking_service.py`
- [X] T009 [P] [US3] Add contract tests for `GET /api/chunking/run/stream`: `overlap` defaults to `0` when omitted, `400` response when `overlap >= chunkSize` or `overlap < 0`, and the terminal `result` event's payload includes `overlap`, in `backend/tests/contract/test_chunking_stream.py`
- [X] T010 [P] [US3] Add a test asserting `run(documentId, chunkSize, overlap)` forwards `overlap` into the constructed `EventSource` URL, in `frontend/tests/unit/useFixedSizeChunking.test.ts`
- [X] T011 [US3] Add tests asserting (a) attempting to run chunking with `overlapValue >= chunkSize` shows a clear validation message and does not call `run()`, and (b) a valid "Re-Calculate Chunks" click calls `run()` with the current `overlapValue`, in `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` (same file as T003/T005 — run after T006 completes, not in parallel)

### Implementation for User Story 3

- [X] T012 [US3] Add `overlap: int = 0` to the `ChunkingStrategy` protocol signature in `backend/app/chunking/strategies/base.py`
- [X] T013 [US3] Change `FixedSizeStrategy.chunk` to accept `overlap: int = 0` and slice with stride `chunk_size - overlap` instead of `chunk_size` in `backend/app/chunking/strategies/fixed_size.py` (depends on T012; makes T007 pass)
- [X] T014 [US3] Add `overlap: int = 0` parameter and `0 <= overlap < chunk_size` validation (raising `ValueError` on violation) to `resolve_run`, and forward `overlap` from `stream_chunking` into `strategy_impl.chunk(...)`, in `backend/app/chunking/service.py` (depends on T013; makes T008 pass)
- [X] T015 [US3] Add `overlap: int` field to `ChunkingResult` in `backend/app/chunking/schemas.py`, and set it from the run's `overlap` value in `stream_chunking`'s terminal `result` event in `backend/app/chunking/service.py` (depends on T014)
- [X] T016 [US3] Add `overlap: int = 0` query parameter to `run_chunking_stream` in `backend/app/chunking/router.py`, forwarded to both `service.resolve_run` and `service.stream_chunking`, with the existing `except ValueError` branch continuing to return `400` (depends on T015; makes T009 pass)
- [X] T017 [P] [US3] Add `overlap: number` field to the `ChunkingResult` interface in `frontend/src/types/chunking.ts`
- [X] T018 [US3] Add an `overlap` parameter to `runChunkingStream` and append it to the constructed `EventSource` query string in `frontend/src/lib/chunkingApi.ts` (depends on T017; makes T010 pass together with T019)
- [X] T019 [US3] Add an `overlap` parameter to `run()` in `frontend/src/hooks/useFixedSizeChunking.ts`, forwarded to `runChunkingStream` (depends on T018; makes T010 pass)
- [X] T020 [US3] In `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: pass the current `overlapValue` into `run(activeDocumentId, chunkSize, overlapValue)` in `handleRunChunking`, and add a client-side validation check that blocks the run and shows a clear message when `overlapValue >= chunkSize` (depends on T019, T011, and must be applied after T004/T006 since all three edit this same file; makes T011 pass)

**Checkpoint**: All three user stories are independently functional — Overlap is visibly readable
(US1), its result count is glanceable (US2), and it genuinely drives chunk boundaries and count
(US3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across all three stories together.

- [X] T021 [P] Extend the existing Playwright spec to change Overlap, re-run chunking, and confirm the chunk count below the slider updates and adjacent chunks visibly share content, in `frontend/tests/e2e/fixed-size-chunking.spec.ts`
- [X] T022 Walk through `specs/007-chunking-overlap-controls/quickstart.md` end-to-end (backend `curl` checks in §1, UI checks in §3–§5) and confirm every "Expected" outcome holds
- [X] T023 [P] Run the full suites and confirm no regressions: `cd backend && pytest` and `cd frontend && npm test && npm run test:e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: None — empty, see above.
- **User Stories (Phase 3–5)**: US1 and US2 have no dependency on US3 or on each other and could be
  built in either order or in parallel by different people; US3 is independent of US1/US2's
  display logic but, within the shared `FixedSizeChunkingScreen.tsx` file, its final wiring task
  (T020) must land after US1's (T004) and US2's (T006) edits to avoid merge conflicts in the same
  file — sequence US1 → US2 → US3 if worked by a single person/session (as ordered here); if
  parallelized across people, coordinate on that one file.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 or US3 — pure frontend display of existing local state.
- **User Story 2 (P2)**: No dependency on US1 or US3 — pure frontend display of existing `result.totalChunks`.
- **User Story 3 (P1)**: No functional dependency on US1/US2; shares one frontend file with both (see above).

### Within Each User Story

- Tests are written first and must fail before their corresponding implementation task.
- Backend layers proceed bottom-up: protocol (T012) → strategy (T013) → service (T014) → schema (T015) → router (T016).
- Frontend layers proceed bottom-up: types (T017) → api client (T018) → hook (T019) → screen (T020).

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T007, T008, T009 (backend tests, different files) in parallel; T010 (frontend hook test, different file) in parallel with those.
- T017 (frontend type) can proceed in parallel with the entire backend implementation chain (T012–T016), since it only depends on the already-agreed contract shape (data-model.md, contracts/chunking-overlap-api.md), not on the backend code being merged.
- T021 and T023 (Polish) in parallel; T022 is a manual walkthrough best done once T021/T023 are green.

---

## Parallel Example: User Story 3 tests

```bash
# Launch all independent US3 test-writing tasks together:
Task: "Unit tests for overlapping stride behavior in backend/tests/unit/test_fixed_size_strategy.py"
Task: "Unit tests for overlap validation and totalChunks effect in backend/tests/unit/test_chunking_service.py"
Task: "Contract tests for overlap query param + response field in backend/tests/contract/test_chunking_stream.py"
Task: "Hook test asserting overlap is forwarded to the EventSource URL in frontend/tests/unit/useFixedSizeChunking.test.ts"
```

---

## Implementation Strategy

### MVP Scope

Both **User Story 1** and **User Story 3** are P1 — together they resolve the reported bug: US1
makes the slider visibly respond, and US3 makes it actually work. Recommended MVP = **US1 + US3**
(skip US2's below-slider count initially if time-constrained; the chunk list itself already shows
results). Deliver US2 as the very next increment since it's small and purely additive.

### Incremental Delivery

1. Complete Setup (Phase 1) — confirm baseline green.
2. Foundational (Phase 2) — none; proceed directly.
3. Add User Story 1 (Phase 3) → validate independently → optional demo.
4. Add User Story 3 (Phase 5) → validate independently → this + US1 together resolve the reported
   bug end-to-end (numeric feedback + genuine overlap behavior).
5. Add User Story 2 (Phase 4) → validate independently → glanceable chunk count.
6. Polish (Phase 6) → full regression + quickstart walkthrough.

### Parallel Team Strategy

With multiple developers: one person can take US1 (frontend-only, T003–T004), another can take
US3's backend half (T007–T016) while a third preps US3's frontend half (T010, T017–T019) —
coordinate the single shared-file step (T020, plus T004/T006) as the last merge before Polish.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- Tasks touching `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` or
  `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` (T003/T004, T005/T006, T011/T020) are
  intentionally never marked `[P]` against each other — same-file edits, sequenced by phase order.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
