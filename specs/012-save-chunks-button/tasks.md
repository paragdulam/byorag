---

description: "Task list template for feature implementation"
---

# Tasks: Explicit Save Chunks to Database

**Input**: Design documents from `/specs/012-save-chunks-button/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chunking-save-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included below for every user story, at unit, contract, integration, and
component levels as appropriate.

**Organization**: Tasks are grouped by user story (US1, US2, US3 from spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Existing web-application layout (unchanged from `001`–`011`): `backend/app/...` +
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

**None required.** This feature only extends the already-scaffolded `chunking` vertical slice
(`STRATEGIES` registry, `Chunk` DB model, `resolve_run` validation, `/api/chunking/run/stream`
endpoint, `FixedSizeChunkingScreen`/`useFixedSizeChunking` frontend pair) from
`005`–`008`/`011`. No schema migration, new dependency, or shared scaffolding is needed before user
story work can start — proceed directly to user stories.

**Checkpoint**: Foundation ready (already true) — user story implementation can begin.

---

## Phase 3: User Story 1 - Preview chunks without persisting them (Priority: P1) 🎯 MVP

**Goal**: "Re-Calculate Chunks" computes and displays chunks for a document without writing
anything to the database, no matter how many times it's re-run.

**Independent Test**: Run a chunking preview for a document multiple times with different chunk
sizes, then query the `chunks` table directly for that document and confirm zero rows exist.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [US1] Replace `test_stream_chunking_persists_chunks_for_the_document` and `test_stream_chunking_rerun_replaces_previous_chunks` in `backend/tests/unit/test_chunking_service.py` with tests asserting `stream_chunking` (via the existing `_run` helper) writes **zero** `ChunkRow` rows for a document, both after a single run and after several successive runs with different `chunk_size`/`overlap` values

### Implementation for User Story 1

- [X] T004 [US1] Remove the `_persist_chunks(...)` call and its surrounding try/except persistence-error branch from `stream_chunking` in `backend/app/chunking/service.py`, so it only extracts text, computes chunks, and yields `progress`/`result` events (depends on T003; makes T003 pass). Also dropped the now-unused `db` parameter from `stream_chunking` and updated its call site in `backend/app/chunking/router.py` and the `_run` test helper.

**Checkpoint**: User Story 1 is fully functional and independently testable — previewing chunks any
number of times never touches the database.

---

## Phase 4: User Story 2 - Explicitly save previewed chunks to the database (Priority: P1)

**Goal**: A new "Save Chunks" action persists the currently previewed chunks — content, chunking
technique, and parameters — to the database, fully replacing any prior saved set for that
document; it's unavailable until a preview has succeeded, and "Move to Embeddings" now requires a
save (not just a preview) to be enabled (research.md §6, data-model.md's Move-to-Embeddings Gate).

**Independent Test**: Preview chunks for a document, click "Save Chunks", and confirm via the
database that the chunk content, strategy, chunk size, and overlap match exactly what was on
screen; save again with different settings and confirm the prior saved set is fully replaced, not
accumulated.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T005 [P] [US2] Add unit tests for a new `service.save_chunks(...)` in `backend/tests/unit/test_chunking_service.py`: persists chunks matching the strategy/chunk_size/overlap/content it computed, a second call with different settings fully replaces the first call's rows (no accumulation, no duplicate `index`), and an extraction-failed document persists nothing (existing rows, if any, are left untouched)
- [X] T006 [P] [US2] Add `backend/tests/contract/test_chunking_save.py` (new file) with contract tests for `POST /api/chunking/save`: success returns `200` with a `ChunkRunResponse` body and persists rows queryable via a fresh `db_session`; a second save with different `chunkSize`/`overlap` replaces the first's rows; extraction-failed document returns `{"extractionFailed": true, "result": null}` and persists nothing; `400` for `chunkSize <= 0` and for `overlap` negative or `>= chunkSize`; `404` for an unknown `documentId` — per `contracts/chunking-save-api.md`
- [X] T007 [US2] Update `backend/tests/integration/test_restart_persistence.py` to call `POST /api/chunking/save` (JSON body `{"documentId", "chunkSize": 5}`) instead of `GET /api/chunking/run/stream`, keeping its existing fresh-`SessionLocal()` assertion that 4 `Chunk` rows are durably persisted. Also fixed a latent bug found while doing this: the pre-existing `assert save.status_code == 200` (and corpus/upload calls) sat outside the `try/finally`, so any failure before the `try` permanently leaked a real, uniquely-named "Restart Test Corpus" row (this test uses `real_client`, which commits for real) — moved corpus creation through assertions inside `try/finally` with `corpus_id`/`document_id` guarded as optional so cleanup is safe even on early failure.
- [X] T008 [P] [US2] Add hook tests to `frontend/tests/unit/useFixedSizeChunking.test.ts`: `save()` POSTs the last `run()` call's `documentId`/`chunkSize`/`overlap` to the save endpoint, `saveStatus` transitions `'idle' → 'saving' → 'success'`/`'error'`; and update the existing `hasSucceededOnce`-named tests (rename to `hasSavedOnce`) so the latch stays `false` after a successful **preview** alone and only flips `true` after a successful **save**, remaining `true` thereafter even if a later preview or save fails (one-way latch, same shape as before, re-keyed to save)
- [X] T009 [US2] Update `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: add tests asserting a "Save Chunks" button exists in the bottom action bar, is disabled when `status !== 'success'` or while `saveStatus === 'saving'`, calls `save()` when clicked and enabled, and shows a clear error message when `saveStatus === 'error'`; update the existing "shows exactly two buttons" test to expect three; update the `hasSucceededOnce`-based Move-to-Embeddings gating tests to use `hasSavedOnce` instead (same file as T004's downstream consumer — no conflict, this is the first edit to this file in this feature)

### Implementation for User Story 2

- [X] T010 [US2] Add `ChunkSaveRequest` (`documentId: str`, `chunkSize: int`, `overlap: int = 0`) to `backend/app/chunking/schemas.py`
- [X] T011 [US2] Add `save_chunks(db: Session, document: Document, chunk_size: int, strategy: str, overlap: int = 0) -> ChunkRunResponse` to `backend/app/chunking/service.py`: extracts the document's full text (reusing `extract_text_pages`, no progress reporting needed), runs `STRATEGIES[strategy].chunk(...)`, caps at `MAX_CHUNKS`, returns `ChunkRunResponse(extractionFailed=True, result=None)` with nothing persisted when there's no text, otherwise calls the existing `_persist_chunks(...)` and returns the populated `ChunkRunResponse` (depends on T004 — the persist call now lives in exactly one place after that removal; makes T005 pass)
- [X] T012 [US2] Add `POST /api/chunking/save` to `backend/app/chunking/router.py`: accepts a `ChunkSaveRequest` body, validates via the existing `service.resolve_run` (same `400`/`404` mapping as `/run/stream`), calls `service.save_chunks`, returns the `ChunkRunResponse`, and maps any persistence exception to `500` with a `"Failed to save chunks: ..."` detail (depends on T010, T011; makes T006 and T007 pass)
- [X] T013 [US2] Add `saveChunks(documentId: string, chunkSize: number, overlap: number): Promise<ChunkRunResponse>` to `frontend/src/lib/chunkingApi.ts`, POSTing a JSON body to `/api/chunking/save` and throwing with the response's `detail` on a non-OK status (depends on T012; makes part of T008 pass)
- [X] T014 [US2] In `frontend/src/hooks/useFixedSizeChunking.ts`: track the last `run()` call's `{documentId, chunkSize, overlap}`, add `saveStatus: 'idle' | 'saving' | 'success' | 'error'` and a `save()` function that calls `saveChunks(...)` with those tracked params, and rename `hasSucceededOnce` to `hasSavedOnce`, now latched `true` only on a successful `save()` (one-way latch, unchanged semantics otherwise) (depends on T013; makes T008 pass)
- [X] T015 [US2] In `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: add a "Save Chunks" button to the bottom action bar (disabled unless `status === 'success'` and `saveStatus !== 'saving'`), wired to `save()`, render an error message when `saveStatus === 'error'`, and switch "Move to Embeddings"'s `disabled` prop from `hasSucceededOnce` to `hasSavedOnce` (depends on T014; makes T009 pass)

**Checkpoint**: User Stories 1 AND 2 both work independently — previews never persist, and an
explicit save reliably persists exactly what was previewed, replacing any prior save.

---

## Phase 5: User Story 3 - Understand save status before moving on (Priority: P2)

**Goal**: The screen visibly distinguishes "previewed but not yet saved" from "saved," so the user
never assumes unsaved data has been persisted.

**Independent Test**: Preview chunks (screen shows unsaved), save (screen shows saved), change
settings and re-preview (screen reverts to unsaved) — all without inspecting the database.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T016 [US3] Add hook tests to `frontend/tests/unit/useFixedSizeChunking.test.ts`: `isSaved` is `false` before any save, becomes `true` immediately after a successful `save()` whose params match the current successful preview, and becomes `false` again after a subsequent successful preview run — even one with identical `chunkSize`/`overlap` to the last save — until that new preview is itself saved (same file as T008, sequenced after)
- [X] T017 [US3] Add component tests to `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: a saved/unsaved indicator is present and reflects `isSaved` (e.g. shows "Saved" when `true`, an unsaved/"not saved yet" message when `false`), and switches to unsaved immediately after clicking "Re-Calculate Chunks" following a save (same file as T009, sequenced after)

### Implementation for User Story 3

- [X] T018 [US3] In `frontend/src/hooks/useFixedSizeChunking.ts`: derive `isSaved: boolean` from **run identity**, not run parameters — a `currentRunId` counter incremented on every `run()` and a `savedRunId` set to it on successful `save()`; `isSaved = status === 'success' && savedRunId === currentRunId` (depends on T014; makes T016 pass). Note: the originally-planned parameter-equality `savedSignature` (research.md §4 as first written) failed the "re-run with identical settings still shows unsaved" test (T016) and was replaced with this run-identity design — see research.md §4 and data-model.md's revision note for why.
- [X] T019 [US3] In `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: render a saved/unsaved indicator near the "Save Chunks" button, driven by `isSaved` (depends on T018, T015; makes T017 pass)

**Checkpoint**: All three user stories are independently functional — preview never persists (US1),
an explicit save persists and replaces reliably (US2), and the screen always shows whether the
current preview is actually saved (US3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across all three stories together.

- [X] T020 [P] Extend `frontend/tests/e2e/fixed-size-chunking.spec.ts`: re-running "Re-Calculate Chunks" repeatedly shows no saved indicator and keeps "Move to Embeddings" disabled; clicking "Save Chunks" shows the saved indicator and enables "Move to Embeddings"; changing chunk size and re-calculating flips the indicator back to unsaved
- [X] T021 Walk through `specs/012-save-chunks-button/quickstart.md` end-to-end (backend `curl`/`psql` checks in §1, UI checks in §3–§8) and confirm every "Expected" outcome holds. Ran §1's checks manually against the live dev backend with a fresh unique document: preview persists 0 rows, save persists exactly the previewed chunks, a resave with different settings fully replaces (no accumulation), a subsequent preview leaves saved rows untouched, and the 400/400/404 validation paths match the contract. §3–§8 (UI checks) are covered by the passing e2e spec (T020) and component/hook tests (T003–T019).
- [X] T022 [P] Run the full suites and confirm no regressions: `cd backend && pytest` and `cd frontend && npm test && npm run test:e2e`. Results: backend 149/149 passed (baseline 139, +10 new), frontend unit 142/142 passed (baseline 129, +13 new), e2e 13/13 passed. Along the way, discovered and worked around an environment issue unrelated to this feature: a stray personal `uvicorn --reload` dev server was squatting on port 8000, which silently defeated Playwright's isolated `byorag_e2e` webServer config (`reuseExistingServer`) and caused cross-test pollution between specs; stopped it, ran the e2e suite against Playwright's own isolated backend, then restarted the dev server afterward.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: None — empty, see above.
- **User Story 1 (Phase 3)**: No dependency on US2/US3 — pure removal of a side effect from the
  existing preview path.
- **User Story 2 (Phase 4)**: Its `save_chunks` implementation (T011) is written to live alongside
  US1's already-stripped `stream_chunking` (T004), so implement US1 before US2 to avoid two people
  touching the same persistence logic in `service.py` at once; functionally, US2 does not depend on
  US1's *behavior* (a save would work even if preview still auto-persisted) but the plan sequences
  US1 → US2 to keep `service.py` edits conflict-free.
- **User Story 3 (Phase 5)**: Depends on US2's `save()`/`saveStatus`/tracked-run-params plumbing in
  `useFixedSizeChunking.ts` (T014) and the "Save Chunks" button (T015) already existing — US3 only
  adds a derived `isSaved` value and its UI indicator on top.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2 or US3.
- **User Story 2 (P1)**: Depends on US1 landing first in `backend/app/chunking/service.py` (shared
  file, sequenced not parallel); otherwise independent.
- **User Story 3 (P2)**: Depends on US2's hook/component plumbing (`save()`, `saveStatus`, tracked
  run params, "Save Chunks" button) as a foundation to add `isSaved`/the indicator onto.

### Within Each User Story

- Tests are written first and must fail before their corresponding implementation task.
- Backend layers proceed bottom-up: schema (T010) → service (T011) → router (T012).
- Frontend layers proceed bottom-up: api client (T013) → hook (T014/T018) → screen (T015/T019).

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T005 and T006 (different backend test files) in parallel; T008 (frontend hook test, different
  file) in parallel with those. T007 and T009 touch files already covered by T003/T006 and T008's
  neighbors respectively but are their own tasks — T007 can run in parallel with T005/T006/T008
  (different file); T009 should follow T008 only insofar as it asserts on the same hook shape, but
  as a different file it can be drafted in parallel and reconciled before implementation.
- T013 (frontend api client) can proceed in parallel with the entire backend implementation chain
  (T010–T012), since it only depends on the already-agreed contract shape
  (`contracts/chunking-save-api.md`), not on the backend code being merged.
- T020 and T022 (Polish) in parallel; T021 is a manual walkthrough best done once T020/T022 are
  green.

---

## Parallel Example: User Story 2 tests

```bash
# Launch independent US2 test-writing tasks together:
Task: "Unit tests for save_chunks persistence/replace/extraction-failed in backend/tests/unit/test_chunking_service.py"
Task: "Contract tests for POST /api/chunking/save in backend/tests/contract/test_chunking_save.py"
Task: "Hook tests for save()/saveStatus/hasSavedOnce in frontend/tests/unit/useFixedSizeChunking.test.ts"
```

---

## Implementation Strategy

### MVP Scope

**User Story 1** alone stops the unwanted auto-persist behavior (the most surprising part of the
current bug report) but provides no way to persist anything at all — it is not independently
shippable as the *whole* fix. **User Story 1 + User Story 2** together are the real MVP: preview
is side-effect-free, and an explicit action persists chunks. Recommended MVP = **US1 + US2**;
ship US3's saved/unsaved indicator as the very next increment (small, purely additive, no backend
change).

### Incremental Delivery

1. Complete Setup (Phase 1) — confirm baseline green.
2. Foundational (Phase 2) — none; proceed directly.
3. Add User Story 1 (Phase 3) → validate independently → preview no longer persists.
4. Add User Story 2 (Phase 4) → validate independently → this + US1 together are a shippable MVP
   (explicit save, no accidental persistence).
5. Add User Story 3 (Phase 5) → validate independently → users can always tell saved vs. unsaved.
6. Polish (Phase 6) → full regression + quickstart walkthrough.

### Parallel Team Strategy

With multiple developers: one person takes US1's small backend removal (T003–T004) first since
US2's backend work depends on it landing; once that merges, a second person can take US2's backend
half (T005–T007, T010–T012) while a third preps US2's frontend half (T008, T009, T013–T015) against
the agreed contract; US3 (T016–T019) starts only once US2's hook/screen plumbing (T014/T015) is
in place.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- Tasks touching `backend/app/chunking/service.py` (T004, T011) are sequenced, not parallel — same
  file, and T011 is written to coexist with T004's already-stripped `stream_chunking`.
- Tasks touching `frontend/src/hooks/useFixedSizeChunking.ts` (T014, T018) and
  `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` (T015, T019) are sequenced by
  phase order for the same reason.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
