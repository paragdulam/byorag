# Tasks: Golden Dataset Entry List Scoping & Read-Only Answer View

**Input**: Design documents from `/specs/030-golden-dataset-entry-detail/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included at unit, integration, and e2e levels for both user
stories, written before the implementation that makes them pass.

**Organization**: Tasks are grouped by user story. Both stories touch
`frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, but User Story 1 is a
self-contained filter fix to the existing inline list, while User Story 2 extracts that list
into a new component and adds the read-only detail view — each is independently completable
and testable per research.md's decisions.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Web app: `frontend/src/`, `frontend/tests/` (this feature is frontend-only; `backend/` is
untouched — see plan.md Summary and research.md's first finding).

---

## Phase 1: Setup

No setup tasks are required. This feature adds no new dependency, build tooling, or test
infrastructure — it reuses the existing `getEntry`/`deleteEntry` client functions, the
existing `GoldenEntrySummary.documentId` field, and the existing
`vi.mock('../../src/lib/goldenDatasetApi')` test pattern already established by
`GoldenReviewQueue.test.tsx`.

## Phase 2: Foundational

No foundational/blocking tasks are required. Neither user story depends on new shared
infrastructure beyond what already exists in the codebase (see research.md). Proceed directly
to User Story 1.

---

## Phase 3: User Story 1 - Entry list matches the selected scope (Priority: P1) 🎯 MVP

**Goal**: The entry list (and the Pending Review section above it, which is derived from the
same underlying data) shows only entries belonging to the corpus/document scope currently
selected in the dropdown, instead of always showing the same unfiltered set.

**Independent Test**: Create entries scoped to different documents in the same corpus, switch
the dropdown between "Entire Corpus" and each individual document, and confirm the visible
list changes to match each selection — independent of User Story 2's read-only answer view.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T001 [P] [US1] Integration tests in `frontend/tests/integration/GoldenDatasetScreen.test.tsx`:
      with entries returned for two different `documentId`s within the same corpus (stub
      `GET /api/golden-dataset/entries` to return both), selecting "Entire Corpus" in the scope
      dropdown shows every entry; selecting one specific document shows only that document's
      entries; switching the dropdown selection updates the visible list immediately without a
      reload; selecting a document with zero entries of its own shows the existing "No golden
      dataset entries yet" message rather than another document's or the corpus's entries.
- [X] T002 [P] [US1] E2E test extension in `frontend/tests/e2e/golden-dataset.spec.ts`: upload
      two documents into one corpus, create an approved entry scoped to each (via the existing
      "Write Manually" flow), select "Entire Corpus" and assert both questions are listed,
      select the first document and assert only its question is listed, select the second and
      assert only its question is listed.

### Implementation for User Story 1

- [X] T003 [US1] In `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, compute
      `scopedEntries` from `entries` per data-model.md (`isEntireCorpus ? entries :
      entries.filter(e => e.documentId === activeDocumentId)`), and derive both `pendingEntries`
      (currently `entries.filter(...)`) and the main entry list's rendered data from
      `scopedEntries` instead of the raw, unfiltered `entries` array — so the Pending Review
      section and the main list both respect the current scope consistently. (depends on T001,
      T002 failing first)

**Checkpoint**: User Story 1 is fully functional and independently testable — run T001-T002 to
confirm green. This alone fixes the reported bug.

---

## Phase 4: User Story 2 - View an approved entry's answer without editing it (Priority: P2)

**Goal**: Clicking an approved entry's question shows its full preferred answer, read-only,
with zero editable fields or save controls. Non-approved entries' questions remain inert in
this list (unchanged, existing behavior). Delete continues to work unchanged, including for an
entry whose answer is currently expanded.

**Independent Test**: Approve an entry, click its question in the list, and confirm its full
preferred answer becomes visible with no editable fields or save controls present — independent
of whether the list is scoped to a document or the entire corpus (User Story 1).

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T004 [P] [US2] Unit tests in `frontend/tests/unit/GoldenEntryDetail.test.tsx`: given a
      `GoldenEntry`, renders its question and full `preferredAnswer` as visible text; contains
      zero `<input>`, `<textarea>`, or save/submit `<button>` elements anywhere in its output;
      clicking its close control calls the provided `onClose` callback.
- [X] T005 [P] [US2] Unit tests in `frontend/tests/unit/GoldenEntryList.test.tsx`, mocking
      `../../src/lib/goldenDatasetApi` the same way `GoldenReviewQueue.test.tsx` does: clicking
      an approved entry's question calls `getEntry(id)` once and renders that entry's question
      and answer inline beneath the row; clicking the same question again collapses it without
      a second `getEntry` call; clicking a pending-review or a rejected entry's question calls
      `getEntry` zero times and opens nothing; expanding one approved entry and then clicking a
      different approved entry's question expands the second without collapsing or altering the
      first (both remain open, each showing its own answer); clicking Delete on a row whose
      answer is expanded removes both the row and its expanded answer.
- [X] T006 [P] [US2] E2E test extension in `frontend/tests/e2e/golden-dataset.spec.ts`: approve
      an entry, click its question, assert its full answer text becomes visible and assert no
      `input`/`textarea`/save button is present anywhere on the page in that state; click a
      pending-review entry's question (from the existing Pending Review section reference, or a
      second entry left pending) and assert nothing new opens; delete the expanded entry and
      assert both it and its answer view disappear together.

### Implementation for User Story 2

- [X] T007 [US2] Create `frontend/src/components/golden-dataset/GoldenEntryDetail.tsx` per
      research.md's decision: a pure presentational component, props
      `{ entry: GoldenEntry; onClose: () => void }`, rendering the question and full
      `preferredAnswer` as plain text with a close control — no form elements, no save control,
      by construction. (depends on T004 failing first)
- [X] T008 [US2] Create `frontend/src/components/golden-dataset/GoldenEntryList.tsx` per
      data-model.md: props `{ entries: GoldenEntrySummary[]; onDelete: (entry:
      GoldenEntrySummary) => void }`, preserving today's per-row markup (question, status
      label, source label, Delete button) from `GoldenDatasetScreen.tsx`'s current inline list.
      Owns `expandedEntryIds: Set<string>` and `loadedEntries: Map<string, GoldenEntry>` state;
      on clicking an `entry.status === 'approved'` row's question, fetches via `getEntry(id)`
      (skipping the fetch if already cached in `loadedEntries`) and toggles its id in
      `expandedEntryIds`, rendering `GoldenEntryDetail` inline for each expanded id; clicking a
      non-approved row's question is a no-op; deleting a row removes its id from both
      `expandedEntryIds` and `loadedEntries` as part of calling the passed-in `onDelete`.
      (depends on T005 failing first, T007)
- [X] T009 [US2] In `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, replace
      the existing inline `<ul data-testid="golden-entry-list">`/`<li>` block with
      `<GoldenEntryList entries={scopedEntries} onDelete={handleDelete} />`, removing the
      now-redundant inline rendering (`STATUS_LABELS`/`SOURCE_LABELS` and the per-row JSX move
      into `GoldenEntryList`). (depends on T008, and on T003's `scopedEntries` already existing)

**Checkpoint**: Both user stories are independently functional — run T004-T006 to confirm
green, then the full quickstart.md validation below.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories.

- [X] T010 Run `cd frontend && npm run test` and `npm run test:e2e -- golden-dataset.spec.ts`
      per quickstart.md and confirm all suites pass, including the pre-existing manual-creation,
      batch-generation, and split-view-zoom coverage already in
      `GoldenDatasetScreen.test.tsx`/`golden-dataset.spec.ts` (regression check).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1-2)**: None required — proceed directly to User Story 1.
- **User Story 1 (Phase 3)**: No dependency on User Story 2. Can ship alone as the MVP.
- **User Story 2 (Phase 4)**: Builds on User Story 1's `scopedEntries` (T003) for T009's wiring,
  and touches the same file (`GoldenDatasetScreen.tsx`) — implement after User Story 1, not in
  parallel with it, even though its own new files (`GoldenEntryDetail.tsx`,
  `GoldenEntryList.tsx`) are independent of US1's change until T009's final wiring step.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- `GoldenEntryDetail` before `GoldenEntryList` (the latter renders the former).
- `GoldenEntryList` fully implemented before wiring it into `GoldenDatasetScreen.tsx`.
- Story complete (all its tasks done, its tests green) before moving to the next priority.

### Parallel Opportunities

- T001 and T002 (US1 tests) can run in parallel — different files.
- T004, T005, and T006 (US2 tests) can run in parallel — different files. Note T005 exercises
  behavior that depends on `GoldenEntryDetail` existing to fully render, but as a test file it
  can be *written* in parallel with T004; it will fail to resolve/behave correctly until T007
  is implemented, same TDD-red expectation as any other pre-implementation test.
- T007 and T008 are sequential (T008 renders T007's output).

---

## Parallel Example: User Story 1

```bash
Task: "Integration tests for scope-filtered entries in frontend/tests/integration/GoldenDatasetScreen.test.tsx"
Task: "E2E test for scope filtering in frontend/tests/e2e/golden-dataset.spec.ts"
```

## Parallel Example: User Story 2 tests

```bash
Task: "Unit tests for GoldenEntryDetail in frontend/tests/unit/GoldenEntryDetail.test.tsx"
Task: "Unit tests for GoldenEntryList in frontend/tests/unit/GoldenEntryList.test.tsx"
Task: "E2E test for the read-only answer view in frontend/tests/e2e/golden-dataset.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (T001-T003).
2. **STOP and VALIDATE**: Run T001-T002, then manually verify via quickstart.md step 1.
3. This alone fixes the reported bug — the list finally respects the scope dropdown.

### Incremental Delivery

1. User Story 1 → Test independently → this is the MVP (bug fix alone).
2. User Story 2 → Test independently → adds the read-only answer view on top.
3. Polish → full regression pass (T010).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at either checkpoint to validate that story independently.
