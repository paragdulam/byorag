---

description: "Task list for Corpora Dropdown in the Left Navigation"
---

# Tasks: Corpora Dropdown in the Left Navigation

**Input**: Design documents from `/specs/010-corpora-dropdown-nav/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no
`contracts/` — this feature adds no API surface)

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE. Write each story's new tests first and confirm they fail before implementing.
This feature also requires fixing several *pre-existing, currently-passing* tests that this
structural change breaks by construction (research.md §3) — those are regression fixes, not new
TDD, and are called out explicitly below rather than framed as "write first."

**Organization**: Tasks are grouped by user story (spec.md priorities: US1=P1, US2=P1, US3=P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete sibling task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact and relative to the repository root

---

## Phase 1: Setup

**Purpose**: Project initialization

Not applicable — this feature introduces no new dependencies, packages, or scaffolding
(plan.md Technical Context). No tasks in this phase; numbering begins at T001 in Phase 2.

---

## Phase 2: Foundational

**Purpose**: N/A for this feature

There is no separate blocking-prerequisite phase here: the dropdown shell (toggle, open/close,
list rendering) *is* User Story 1's own deliverable, not a prerequisite built ahead of it — User
Stories 2 and 3 each add one button to rows User Story 1 already renders. See Phase 3.

---

## Phase 3: User Story 1 - Corpora shown as a dropdown (Priority: P1) 🎯 MVP

**Goal**: Replace the sidebar's always-expanded corpora list with a closed-by-default dropdown
that opens to reveal the full list. **Amended during implementation**: the dropdown does not carry
over a create-corpus control — creating a corpus is now done only from the dedicated Corpora
screen (`009-corpora-screen`), not the sidebar (spec.md FR-003, Assumptions).

**Independent Test**: Load the app, confirm the sidebar shows a closed dropdown labeled with the
active corpus's name (or "No corpus selected"), click it to reveal the full list (with no create
control in it), and click again to close it.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write T001–T002 first; confirm they fail before implementing T006–T008. T003–T005 are
> regression fixes for pre-existing tests this structural change breaks (research.md §3) — apply
> them once T006–T008 land, so the full suite is green again before moving to User Story 2.

- [X] T001 [P] [US1] Rewrite the "Corpora section" describe block in `frontend/tests/unit/SidebarNav.test.tsx` for the dropdown: closed state shows the active corpus's name (or "No corpus selected"), clicking the toggle opens the panel and reveals the list, clicking it again closes the panel, and confirm no create-corpus control is rendered anywhere in the sidebar
- [X] T002 [P] [US1] New e2e test file `frontend/tests/e2e/corpora-dropdown.spec.ts` — dropdown starts closed, opens on click, its collapsed label reflects the active corpus, closes on a second click, and no create control appears in the open panel
- [X] T003 [P] [US1] Update `frontend/tests/e2e/corpora-management.spec.ts`: corpus creation moves from the sidebar's (now-removed) "+ New Corpus" control to the dedicated Corpora screen (navigate via the "Corpora" nav link, use its own create form — `009-corpora-screen`), then open the sidebar dropdown for any subsequent switch/select interaction (research.md §3, amended)
- [X] T004 [P] [US1] Update `frontend/tests/e2e/data-sources-screen.spec.ts`: create its test corpus via the dedicated Corpora screen instead of the sidebar (research.md §3, amended)
- [X] T005 [P] [US1] Update `frontend/tests/e2e/fixed-size-chunking.spec.ts`: create its test corpus via the dedicated Corpora screen instead of the sidebar (research.md §3, amended)

### Implementation for User Story 1

- [X] T006 [US1] Rewrite `CorporaSection` in `frontend/src/components/layout/SidebarNav.tsx` into a closed-by-default dropdown: a toggle `<button>` (`data-testid="active-corpus-dropdown-toggle"`, `aria-expanded`, visible label = active corpus's name or "No corpus selected") and, when open, a panel (`data-testid="active-corpus-dropdown-panel"`) containing only the corpora list — no create-corpus control (FR-001, FR-002, FR-003 amended) (depends on T001, T002)
- [X] T007 [US1] Add a document-level click-outside listener and `Escape`-key handling that close the open panel (FR-002) (depends on T006)
- [X] T008 [US1] Render each corpus in the open panel as a row with `data-testid="dropdown-corpus-row-{id}"` showing its name and a visual indicator when it's the active one (research.md §2) (depends on T006)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable (MVP) — the
dropdown opens/closes correctly with no create control, and every previously-passing sidebar-corpus
e2e interaction passes again via T003–T005 (now creating via the dedicated Corpora screen).

---

## Phase 4: User Story 2 - Make any corpus active from the dropdown (Priority: P1)

**Goal**: An explicit "Make Active" action per row in the open dropdown switches the active corpus.

**Independent Test**: Open the dropdown, click "Make Active" on a non-active corpus, and confirm it
becomes active app-wide (reflected in the dropdown and, e.g., the Sources screen).

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T009 [P] [US2] Unit tests in `frontend/tests/unit/SidebarNav.test.tsx`: clicking "Make Active" on a non-active row switches the active corpus; the active row shows its indicator instead of a "Make Active" button
- [X] T010 [P] [US2] New e2e test in `frontend/tests/e2e/corpora-dropdown.spec.ts`: create two corpora, click "Make Active" on the second from the dropdown, and confirm the Sources screen reflects the switch immediately, no reload

### Implementation for User Story 2

- [X] T011 [US2] Add a "Make Active" button (`aria-label="Make {name} active"`) to each non-active row in the open panel in `frontend/src/components/layout/SidebarNav.tsx`, calling the existing `useCorpus().selectCorpus(id)` (FR-004, FR-005, FR-010) (depends on T008)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Delete a corpus from the dropdown (Priority: P2)

**Goal**: A "Delete" action per row in the open dropdown removes a corpus, with confirmation,
reusing the existing blocked-while-non-empty and fallback-on-delete-active rules.

**Independent Test**: Open the dropdown, delete an empty corpus via its "Delete" action and a
confirmation step, and confirm it disappears everywhere; confirm a non-empty corpus's deletion is
blocked with a clear message.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T012 [P] [US3] Unit tests in `frontend/tests/unit/SidebarNav.test.tsx`: clicking "Delete" prompts for confirmation; confirming deletes an empty corpus and removes its row; cancelling leaves it untouched; attempting to delete a non-empty corpus surfaces the existing blocked message
- [X] T013 [P] [US3] New e2e test in `frontend/tests/e2e/corpora-dropdown.spec.ts`: attempt to delete a non-empty corpus from the dropdown (blocked with a message), remove its document, then delete it successfully

### Implementation for User Story 3

- [X] T014 [US3] Add a "Delete" button (`aria-label="Delete {name}"`) to each row in the open panel in `frontend/src/components/layout/SidebarNav.tsx`, confirming via `window.confirm(...)` (research.md §4) before calling the existing `useCorpus().deleteCorpus(id)`, and surfacing its existing blocked-while-non-empty error message (FR-006, FR-007, FR-008, FR-009) (depends on T008)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency pass across all stories

- [X] T015 [P] Grep the frontend test suite for any remaining reference to the old always-expanded corpora list interaction pattern (e.g. a corpus link/button queried without first opening the dropdown) and confirm none remain (research.md §3 completeness check)
- [X] T016 Run `specs/010-corpora-dropdown-nav/quickstart.md` end-to-end manually and fix any discrepancies found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No tasks
- **Foundational (Phase 2)**: No tasks — User Story 1 delivers the shared shell directly
- **User Story 1 (Phase 3)**: No dependency on other stories — this is the MVP
- **User Story 2 (Phase 4)**: Depends on User Story 1's row rendering (T008) existing
- **User Story 3 (Phase 5)**: Depends on User Story 1's row rendering (T008) existing; independent
  of User Story 2 (different button on the same row, no shared state beyond the row itself)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests are written first (T001–T002, T009, T010, T012, T013) and must fail before their
  corresponding implementation lands; T003–T005 are regression fixes applied once T006–T008 land
- Story complete (checkpoint) before moving to the next priority

### Parallel Opportunities

- T001–T005 (all US1 test tasks, across 4 different files) can be written in parallel
- T009+T010 (US2 tests) and T012+T013 (US3 tests) can each be written in parallel, and — since
  US2 and US3 touch different buttons on the same row with no shared state — their respective test
  and implementation tasks (T009–T011 vs. T012–T014) could be done by two people in parallel once
  T008 lands, provided both agree on the row's DOM structure ahead of time to avoid a merge
  conflict in `SidebarNav.tsx`

---

## Parallel Example: User Story 1

```bash
# Launch all US1 test/reconciliation tasks together (4 different files):
Task: "Rewrite Corpora section tests for the dropdown in frontend/tests/unit/SidebarNav.test.tsx"
Task: "New e2e test frontend/tests/e2e/corpora-dropdown.spec.ts for open/close + create"
Task: "Update frontend/tests/e2e/corpora-management.spec.ts to open the dropdown first"
Task: "Update frontend/tests/e2e/data-sources-screen.spec.ts to open the dropdown first"
Task: "Update frontend/tests/e2e/fixed-size-chunking.spec.ts to open the dropdown first"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (no Setup/Foundational phases needed for this feature)
2. **STOP and VALIDATE**: Test User Story 1 independently (quickstart.md §1); confirm the full
   existing suite is green again (T003–T005 reconciliation included)
3. Deploy/demo if ready

### Incremental Delivery

1. User Story 1 → Test independently → Deploy/Demo (MVP: dropdown opens/closes, create still works)
2. User Story 2 → Test independently → Deploy/Demo (explicit "Make Active" per row)
3. User Story 3 → Test independently → Deploy/Demo ("Delete" per row, with confirmation)

### Parallel Team Strategy

With multiple developers:
- Developer A: User Story 1 (the shell — blocks B and C until T008 lands)
- Developer B: User Story 2, starting as soon as T008's row structure is agreed
- Developer C: User Story 3, same starting point as B, different button on the same row

---

## Notes

- [P] tasks touch different files (or, within `SidebarNav.tsx`, are noted as needing coordination
  rather than marked [P]) with no dependency on an incomplete sibling task
- [Story] label maps each task to its user story for traceability
- Verify each story's new tests fail before implementing that story
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- T006–T008, T011, and T014 all edit `frontend/src/components/layout/SidebarNav.tsx` — land them
  in order (US1 before US2 before US3, per the Dependencies above) to avoid merge conflicts, even
  though US2 and US3 are otherwise independent of each other
