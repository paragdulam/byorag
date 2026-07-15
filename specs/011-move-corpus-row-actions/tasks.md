---

description: "Task list for Move Corpus Row Actions to the Corpora Screen"
---

# Tasks: Move Corpus Row Actions to the Corpora Screen

**Input**: Design documents from `/specs/011-move-corpus-row-actions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no
`contracts/` — this feature adds no API surface)

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE. Write each story's new tests first and confirm they fail before implementing.
This feature also requires fixing several *pre-existing, currently-passing* tests that this
structural change breaks by construction (research.md §4) — those are regression fixes, not new
TDD, and are called out explicitly below rather than framed as "write first."

**Organization**: Tasks are grouped by user story (spec.md priorities: US1=P1, US2=P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete sibling task)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are exact and relative to the repository root

---

## Phase 1: Setup

**Purpose**: Project initialization

Not applicable — this feature introduces no new dependencies, packages, or scaffolding
(plan.md Technical Context). No tasks in this phase; numbering begins at T001 in Phase 3.

---

## Phase 2: Foundational

**Purpose**: N/A for this feature

There is no separate blocking-prerequisite phase here: User Story 1 (Corpora screen) and User
Story 2 (sidebar dropdown) touch two entirely different files (`CorporaScreen.tsx` and
`SidebarNav.tsx` respectively) with no shared new code between them — each is a self-contained
correction. See Phase 3 and Phase 4.

---

## Phase 3: User Story 1 - Manage corpora directly from the Corpora screen's list (Priority: P1) 🎯 MVP

**Goal**: Add explicit "Make Active" and "Delete" actions to each row of the Corpora screen's "All
Corpora" list, and remove the now-redundant standalone "Delete this corpus" control.

**Independent Test**: Navigate to the Corpora screen, click "Make Active" next to a non-active
corpus and confirm it becomes active; click "Delete" next to an empty corpus and confirm it is
removed after confirmation; confirm deleting a non-empty corpus is blocked with a message.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write T002 first (new "Make Active" coverage) and confirm it fails before implementing T006.
> T001, T003, T004 are regression fixes for pre-existing tests this structural change breaks
> (research.md §4) — apply them once T006–T008 land, so the full suite is green again before
> moving to User Story 2. T005 is new "Make Active" e2e coverage, write it alongside T002.

- [X] T001 [P] [US1] Rewrite the "CorporaScreen corpus deletion (009-corpora-screen US4)" describe
      block in `frontend/tests/unit/CorporaScreen.test.tsx`: replace the two "delete this corpus"
      button clicks with per-row `aria-label="Delete {name}"` action clicks — no longer need to
      select the row first, since delete is now per-row (research.md §4)
- [X] T002 [P] [US1] Add new tests to `frontend/tests/unit/CorporaScreen.test.tsx`: a non-active
      row shows a "Make Active" button (`aria-label="Make {name} active"`) that switches the
      active corpus when clicked without navigating away, and the active row shows "ACTIVE"
      instead of that button (research.md §2)
- [X] T003 [P] [US1] Rewrite the "falls back to the remaining corpus, reflected immediately in
      Sources" test in `frontend/tests/integration/CorporaScreen.test.tsx` to delete the active
      corpus via its row's own "Delete" action instead of the single "Delete this corpus" control
      (research.md §4)
- [X] T004 [P] [US1] Rewrite the "deleting a corpus is blocked while non-empty, then succeeds once
      empty (US4)" test in `frontend/tests/e2e/corpora-screen.spec.ts` to use the row-scoped
      "Delete {name}" action (scoped via `main.getByTestId(/corpus-row-/).filter({ hasText:
      corpusName })`) instead of the single "Delete this corpus" button (research.md §4)
- [X] T005 [P] [US1] Add a new e2e test in `frontend/tests/e2e/corpora-screen.spec.ts`: create two
      corpora, click "Make Active" next to the non-active one, and confirm it becomes active (its
      row shows "ACTIVE" and the Sources screen reflects the switch)

### Implementation for User Story 1

- [X] T006 [US1] In `frontend/src/components/corpora/CorporaScreen.tsx`, change each corpus row
      from a single `<button data-testid="corpus-row-{id}">` into an `<li role="button"
      tabIndex={0} data-testid="corpus-row-{id}" aria-current={...} onClick={...}
      onKeyDown={...}>` (Enter/Space also select) that keeps whole-row click-to-select, containing
      a name `<span>` and, for non-active rows, a "Make Active" `<button
      aria-label="Make {name} active">` that calls `selectCorpus(id)` with
      `event.stopPropagation()`; the active row keeps its existing "ACTIVE" indicator instead
      (FR-001, FR-002, research.md §2–§3) (depends on T001, T002)
- [X] T007 [US1] Add a "Delete" `<button aria-label="Delete {name}">` to every row in
      `frontend/src/components/corpora/CorporaScreen.tsx`, calling `window.confirm(...)` then
      `useCorpus().deleteCorpus(id)` with `event.stopPropagation()`; add a `deleteError` state
      (data-model.md) rendered as a `role="alert"` near the corpus list, surfacing the existing
      blocked-while-non-empty message (FR-003–FR-006) (depends on T006)
- [X] T008 [US1] Remove the standalone "Delete this corpus" button and its
      `onDeleteCorpus`/`handleDeleteCorpus` plumbing from `CorpusDocumentsPanel` in
      `frontend/src/components/corpora/CorporaScreen.tsx`, now that deletion is a per-row action in
      the list above; keep that panel's existing attach/remove-document error handling untouched
      (FR-007) (depends on T007)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable (MVP) — the
Corpora screen's list has working "Make Active" and "Delete" actions per row, the old standalone
delete control is gone, and T001–T005 all pass again.

---

## Phase 4: User Story 2 - Sidebar dropdown no longer carries action buttons (Priority: P2)

**Goal**: Remove the "Make Active"/"Delete" buttons from the sidebar's corpora dropdown, reverting
each row to a simple click-to-select control; the dropdown's open/close mechanics
(`010-corpora-dropdown-nav`) are otherwise unchanged.

**Independent Test**: Open the sidebar dropdown, confirm no "Make Active" or "Delete" button
appears next to any corpus, and confirm clicking a corpus's name still switches the active corpus
app-wide with no reload.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> T009–T011 are regression fixes/rewrites for pre-existing `010-corpora-dropdown-nav` tests this
> structural change breaks by construction (research.md §4) — write/update them, confirm they fail
> against the current button-based implementation, then implement T012.

- [X] T009 [P] [US2] In `frontend/tests/unit/SidebarNav.test.tsx`, remove the "Corpora dropdown:
      Make Active (010-corpora-dropdown-nav US2)" and "Corpora dropdown: Delete
      (010-corpora-dropdown-nav US3)" describe blocks; add a test confirming the open dropdown
      panel renders zero "Make Active"/"Delete" buttons, and a test confirming clicking a
      non-active corpus's row switches the active corpus (research.md §1, §4)
- [X] T010 [P] [US2] In `frontend/tests/e2e/corpora-dropdown.spec.ts`, rewrite the "making a
      non-active corpus active from the dropdown..." test to click the corpus row directly instead
      of a "Make X active" button; delete the "deleting a corpus from the dropdown..." test
      entirely — that coverage now lives in `corpora-screen.spec.ts` (T004/T005) (research.md §4)
- [X] T011 [P] [US2] In `frontend/tests/e2e/corpora-management.spec.ts`, update the two tests that
      switch corpora via the dropdown's "Make X active" button to instead click the corpus row
      directly (research.md §4)

### Implementation for User Story 2

- [X] T012 [US2] In `frontend/src/components/layout/SidebarNav.tsx`, rewrite `CorporaSection`'s
      row rendering back to a single clickable `<button data-testid="dropdown-corpus-row-{id}"
      aria-current={...} onClick={() => selectCorpus(id)}>` styled with the existing
      `navLinkClassName` active-highlight; remove the "MAKE ACTIVE"/"DELETE" buttons, the
      `handleDelete` function, and the `deleteError` state (FR-008, FR-009, FR-010, research.md §1)
      (depends on T009, T010)

**Checkpoint**: User Story 2 is fully functional and independently testable — the dropdown has no
action buttons, clicking a row still switches the active corpus, and T009–T011 all pass again.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Consistency pass across both stories

- [X] T013 [P] Grep the frontend test suite for any remaining reference to the old dropdown "MAKE
      ACTIVE"/"DELETE" buttons or the Corpora screen's standalone "Delete this corpus" control,
      and confirm none remain (research.md §4 completeness check)
- [X] T014 Run `specs/011-move-corpus-row-actions/quickstart.md` end-to-end manually and fix any
      discrepancies found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks
- **Foundational (Phase 2)**: No tasks — User Stories 1 and 2 are fully independent (different
  files)
- **User Story 1 (Phase 3)**: No dependency on User Story 2 — this is the MVP
- **User Story 2 (Phase 4)**: No dependency on User Story 1 — touches only `SidebarNav.tsx`, which
  User Story 1 never edits
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- Tests are written first (T001–T005 for US1, T009–T011 for US2) and must fail before their
  corresponding implementation lands
- Within US1, T006 → T007 → T008 are sequential (same file, each building on the last row/markup
  shape)
- Story complete (checkpoint) before moving to the next priority

### Parallel Opportunities

- T001–T005 (all US1 test tasks, across 3 different files) can be written in parallel
- T009–T011 (all US2 test tasks, across 2 different files) can be written in parallel
- Because User Story 1 (`CorporaScreen.tsx`) and User Story 2 (`SidebarNav.tsx`) touch entirely
  different source files, **the two stories can be implemented fully in parallel** by different
  people, unlike `010-corpora-dropdown-nav` where all three of its stories shared one file

---

## Parallel Example: Both User Stories

```bash
# Launch all US1 test/reconciliation tasks together (3 different files):
Task: "Rewrite CorporaScreen deletion tests for the per-row control in frontend/tests/unit/CorporaScreen.test.tsx"
Task: "Add Make Active per-row tests to frontend/tests/unit/CorporaScreen.test.tsx"
Task: "Rewrite the fallback-delete test in frontend/tests/integration/CorporaScreen.test.tsx"
Task: "Rewrite the blocked/succeeds delete e2e test in frontend/tests/e2e/corpora-screen.spec.ts"
Task: "Add a Make Active e2e test to frontend/tests/e2e/corpora-screen.spec.ts"

# In parallel, launch all US2 test/reconciliation tasks together (2 different files):
Task: "Rewrite dropdown Make Active/Delete unit tests in frontend/tests/unit/SidebarNav.test.tsx"
Task: "Rewrite dropdown switch e2e test, drop dropdown delete e2e test in frontend/tests/e2e/corpora-dropdown.spec.ts"
Task: "Update dropdown-switch e2e tests in frontend/tests/e2e/corpora-management.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (no Setup/Foundational phases needed for this feature)
2. **STOP and VALIDATE**: Test User Story 1 independently (quickstart.md §1); confirm the full
   existing suite is green again (T001–T005 reconciliation included)
3. Deploy/demo if ready

### Incremental Delivery

1. User Story 1 → Test independently → Deploy/Demo (MVP: Make Active + Delete on Corpora screen)
2. User Story 2 → Test independently → Deploy/Demo (dropdown buttons removed, click-to-select kept)

### Parallel Team Strategy

With two developers:
- Developer A: User Story 1 (`CorporaScreen.tsx` and its tests)
- Developer B: User Story 2 (`SidebarNav.tsx` and its tests), fully in parallel with Developer A

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete sibling task
- [Story] label maps each task to its user story for traceability
- Verify each story's new tests fail before implementing that story
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- T006–T008 all edit `frontend/src/components/corpora/CorporaScreen.tsx` — land them in order
  (row restructure → Delete button → remove standalone control) to avoid merge conflicts
