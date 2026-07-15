# Tasks: Fix Saved Chunks Not Showing on Auto-Selected Document

**Input**: Design documents from `/specs/015-fix-saved-chunks-not-showing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, NON-NEGOTIABLE), tests are
mandatory and are included below at the unit (component) and e2e level for both stories.

**Organization**: Tasks are grouped by user story (US1 = Embeddings screen, US2 = Vector View
screen), matching spec.md. Both are P1 and touch disjoint files, so they are independently
implementable and parallelizable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 or US2, per spec.md

## Path Conventions

Web app layout (existing repo): `frontend/src/components/...`, `frontend/tests/...`. This
feature makes no `backend/` changes.

---

## Phase 1: Setup

No setup tasks — this is a bug fix against an existing, fully-scaffolded frontend. Nothing to
initialize.

---

## Phase 2: Foundational

No foundational/blocking tasks. `useChunkEmbeddings` and `useVectorView` already have the
correct reactive-fetch contract (per research.md) and require no changes; both user stories can
start immediately.

**Checkpoint**: Foundation ready (trivially) — proceed directly to user stories.

---

## Phase 3: User Story 1 - See saved chunks for the document that's already selected (Priority: P1) 🎯 MVP

**Goal**: The Embeddings screen's saved-chunk list loads automatically for whichever document is
shown as selected, with zero manual interaction, including the single-document case.

**Independent Test**: Save chunks for a document via the Chunking screen, then open the
Embeddings screen fresh without touching the document dropdown — saved chunks appear
immediately (quickstart.md Scenario 1).

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these tests FIRST; confirm they FAIL against the current buggy code before implementing.

- [X] T001 [P] [US1] In `frontend/tests/unit/EmbeddingsScreen.test.tsx`, add a test asserting
  `useChunkEmbeddings` is called with the auto-selected document id (not `null`) once `documents`
  contains items and nothing has been manually selected — e.g.
  `expect(mockedUseChunkEmbeddings).toHaveBeenLastCalledWith(expect.anything(), 'report.pdf')`
  using the existing single-document `mockState()` default from this file.
- [X] T002 [P] [US1] In the same file, add a test that when `documents` changes to a *different*
  single-document list on rerender (simulating a corpus switch — re-invoke `mockState` with a
  new doc id and force a rerender via RTL's `rerender`), the newly-auto-selected document id is
  what `useChunkEmbeddings` is last called with (covers FR-006).
- [X] T003 [P] [US1] In the same file, add a test that manually selecting a second document via
  the `Select document` dropdown (`userEvent.selectOption`) still results in
  `useChunkEmbeddings` being called with that manually-chosen id, using a two-document
  `mockState({ documents: [makeDoc({id:'a.pdf'}), makeDoc({id:'b.pdf', name:'b.pdf'})] })` setup
  (regression coverage for FR-005).
- [X] T004 [US1] In `frontend/tests/e2e/embeddings.spec.ts`, extend the existing save → generate
  → save flow: after `page.getByRole('link', { name: 'EMBEDDINGS', exact: true }).click()`,
  assert `CHUNK_0` is visible **before** the subsequent
  `page.getByLabel('Select document').selectOption(...)` call (currently that manual
  `selectOption` call is what makes the chunks appear — masking the bug in this suite; moving
  the assertion before it proves the fix). Keep the existing `selectOption` call afterward only
  if still needed to exercise manual switching; otherwise remove it since the doc is already the
  only option and now auto-selected.

### Implementation for User Story 1

- [X] T005 [US1] In `frontend/src/components/embeddings/EmbeddingsScreen.tsx`, add
  `useEffect` (import from `react`) after the `useChunkEmbeddings(...)` call:
  ```tsx
  useEffect(() => {
    setSelectedDocumentId((prev) => (documents.some((d) => d.id === prev) ? prev : documents[0]?.id ?? ''))
  }, [documents])
  ```
  per research.md's decision. Leave the `useChunkEmbeddings(activeCorpusId, selectedDocumentId || null)`
  call site and the `activeDocumentId`/`activeModel` derived constants unchanged — the effect
  makes `selectedDocumentId` itself always valid once `documents` loads, so the existing call
  site becomes correct with no further edits there.

**Checkpoint**: User Story 1 fully functional and independently testable — the Embeddings screen
auto-loads saved chunks with zero clicks.

---

## Phase 4: User Story 2 - See saved chunks and saved embeddings on Vector View for the already-selected document/chunk (Priority: P1)

**Goal**: The Vector View screen's saved-chunk list and the selected chunk's saved embedding(s)
both load automatically, with zero manual interaction, including the single-document/
single-chunk case.

**Independent Test**: Open Vector View for a document with saved chunks and at least one saved
embedding, without touching any dropdown or list item — both the chunk list and the vector
display populate immediately (quickstart.md Scenario 2).

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> Write these tests FIRST; confirm they FAIL against the current buggy code before implementing.

- [X] T006 [P] [US2] In `frontend/tests/unit/VectorViewScreen.test.tsx`, add a test asserting
  `useVectorView` is called with the auto-selected document id (not `null`) once `documents`
  contains items and nothing has been manually selected, mirroring T001's pattern for this
  screen's `mockState()`.
- [X] T007 [P] [US2] In the same file, add a test asserting `useVectorView` is called with the
  auto-selected chunk id (not `null`) once `savedChunks` contains items — i.e. the third argument
  to `useVectorView` becomes `'chunk-1'` (the default `mockState()` chunk) without any click on a
  chunk row.
- [X] T008 [P] [US2] In the same file, add a test that when `documents` changes to a different
  single-document list on rerender (simulating a corpus switch), both the document id AND the
  chunk id passed to `useVectorView` update to the new document's/its first chunk's id (covers
  FR-006 for both selection levels).
- [X] T009 [P] [US2] In the same file, add a test that manually selecting a different document or
  a different chunk (via `userEvent`, using existing `Select document` / `Select chunk N`
  interactions already exercised elsewhere in this file) still results in `useVectorView` being
  called with the manually-chosen ids (regression coverage for FR-005).
- [X] T010 [US2] In `frontend/tests/e2e/embeddings.spec.ts`, in the existing "US1: navigate to
  Vector View" section, assert `CHUNK_0` is visible and `page.getByTestId('vector-grid')` is
  visible **before** the current `page.getByLabel('Select document').selectOption(...)` and
  `page.getByLabel('Select chunk 0').click()` calls (currently those manual interactions are what
  make the chunk list and vector grid appear — masking the bug). Remove the now-redundant
  `selectOption`/chunk-click calls for the single-document/single-chunk path, or keep an
  additional case if the suite still needs to prove manual re-selection works with multiple
  chunks.

### Implementation for User Story 2

- [X] T011 [US2] In `frontend/src/components/vector-view/VectorViewScreen.tsx`, add
  `useEffect` (import from `react`) after the `useVectorView(...)` call:
  ```tsx
  useEffect(() => {
    setSelectedDocumentId((prev) => (documents.some((d) => d.id === prev) ? prev : documents[0]?.id ?? ''))
  }, [documents])

  useEffect(() => {
    setSelectedChunkId((prev) => (savedChunks.some((c) => c.id === prev) ? prev : savedChunks[0]?.id ?? ''))
  }, [savedChunks])
  ```
  per research.md's decision (two independent effects — one per selection level). Leave the
  `useVectorView(activeCorpusId, selectedDocumentId || null, selectedChunkId || null)` call site
  and the `activeDocumentId`/`activeChunkId`/`activeEmbedding`/`activeProjectionMethod` derived
  constants unchanged.

**Checkpoint**: User Stories 1 AND 2 both fully functional and independently testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T012 [P] Run `quickstart.md`'s three manual scenarios (Embeddings auto-load, Vector View
  auto-load, corpus-switch re-trigger) plus the zero-saved-chunks edge case against the running
  dev servers to confirm end-to-end behavior matches the automated tests.
- [X] T013 Run the full frontend unit test suite (`npm run test` in `frontend/`) and the extended
  `embeddings.spec.ts` e2e suite to confirm no regressions in existing Chunking/Sources/Corpora
  screen tests (per spec.md's Assumptions — those screens are confirmed unaffected and must stay
  that way).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, nothing to do.
- **Foundational (Phase 2)**: None — skipped, nothing to do.
- **User Story 1 (Phase 3)** and **User Story 2 (Phase 4)**: Both can start immediately and run
  fully in parallel — disjoint files (`EmbeddingsScreen.tsx`+its tests vs.
  `VectorViewScreen.tsx`+its tests), no shared code changes.
- **Polish (Phase 5)**: Depends on both User Story 1 and User Story 2 being complete.

### Within Each User Story

- Tests (T001–T004 for US1; T006–T010 for US2) MUST be written and FAIL before the corresponding
  implementation task (T005; T011).
- The e2e test task (T004; T010) can be written alongside the unit tests but will only pass once
  the implementation task lands — acceptable since e2e specs aren't run on every save.

### Parallel Opportunities

- T001, T002, T003 (all in the same file, but independent `it` blocks) can be drafted together
  in one pass, then run together.
- T006, T007, T008, T009 likewise.
- US1 (T001–T005) and US2 (T006–T011) can be implemented fully in parallel by different
  agents/sessions since they touch entirely different files.
- T012 and T013 can run in parallel with each other (manual quickstart vs. automated suite).

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Add auto-select assertion to frontend/tests/unit/EmbeddingsScreen.test.tsx (T001)"
Task: "Add corpus-switch re-select assertion to frontend/tests/unit/EmbeddingsScreen.test.tsx (T002)"
Task: "Add manual-selection regression assertion to frontend/tests/unit/EmbeddingsScreen.test.tsx (T003)"
```

## Parallel Example: Both Stories

```bash
# US1 and US2 are fully independent — run as two parallel tracks:
Track A: T001 -> T002 -> T003 -> T004 -> T005
Track B: T006 -> T007 -> T008 -> T009 -> T010 -> T011
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3 (US1): write T001–T004, watch them fail, implement T005, watch them pass.
2. **STOP and VALIDATE**: run quickstart.md Scenario 1 manually against the dev servers.
3. This alone fixes the exact bug the user reported (Embeddings screen, single document).

### Incremental Delivery

1. US1 (Embeddings) → validate → this is the reported bug, fixed.
2. US2 (Vector View) → validate → closes the identical defect found during investigation.
3. Polish (T012–T013) → confirm no regressions anywhere else in the app.

### Parallel Team Strategy

Since US1 and US2 touch disjoint files with no shared dependencies, they can be implemented
simultaneously by two different sessions/agents with no coordination needed beyond this shared
tasks.md.

---

## Notes

- [P] tasks touch different files/independent test blocks with no ordering dependency.
- Both stories reuse the exact same fix pattern (documented once in research.md) — implementers
  should read research.md before starting either T005 or T011 to avoid re-deriving the approach.
- Commit after each task or logical group, per repository convention observed in prior features.
- Verify tests fail (T001–T004, T006–T010) before implementing T005/T011 — this is the
  constitution's Test-First gate, not optional for this project.
