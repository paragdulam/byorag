---

description: "Task list for Dedicated Corpora Screen with App-Wide Scoping"
---

# Tasks: Dedicated Corpora Screen with App-Wide Scoping

**Input**: Design documents from `/specs/009-corpora-screen/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included for every user story at unit, integration, contract,
and/or end-to-end level as appropriate. Write each story's tests first and confirm they fail
before implementing that story.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1=P1, US2=P1, US3=P2,
US4=P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete sibling task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are exact and relative to the repository root

---

## Phase 1: Setup

**Purpose**: Type-level scaffolding shared by later phases, no runtime behavior yet

- [X] T001 [P] Add `'corpora'` to the `ScreenId` union type in `frontend/src/components/layout/SidebarNav.tsx`
- [X] T002 [P] Add the `DocumentWithCorpora` type (extends `SourceDocument` with `corpusIds: string[]`) to `frontend/src/types/sourceDocument.ts` (data-model.md)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Makes the Corpora screen reachable at all — every user story needs this before it can be tested

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Extend `frontend/tests/unit/SidebarNav.test.tsx` — "Corpora" is its own clickable nav item positioned above "Sources" (gets `aria-current` when active), and the existing quick-switcher section header no longer reads "CORPORA" (renamed to avoid duplicate labeling next to the new nav link, research.md §3)
- [X] T004 In `frontend/src/components/layout/SidebarNav.tsx`: add a `{ label: 'Corpora', screen: 'corpora' }` entry to `NAV_ITEMS` above `{ label: 'Sources', ... }`, and rename `CorporaSection`'s header text from "CORPORA" to "ACTIVE CORPUS" (research.md §3) (depends on T001, T003)
- [X] T005 Create the `CorporaScreen` skeleton — `AppShell` wrapper with `activeScreen="corpora"`, rendering the corpora list from `useCorpus()` with a loading state — in `frontend/src/components/corpora/CorporaScreen.tsx` (depends on T001)
- [X] T006 Wire `activeScreen === 'corpora'` to render `<CorporaScreen onNavigate={setActiveScreen} />` in `frontend/src/app/App.tsx` (depends on T004, T005)

**Checkpoint**: Clicking "Corpora" in the nav reaches a real (if mostly empty) dedicated screen — user story implementation can now begin.

---

## Phase 3: User Story 1 - Manage corpora from a dedicated screen (Priority: P1) 🎯 MVP

**Goal**: A dedicated Corpora screen where users can see every corpus, create new ones, and select
one as active.

**Independent Test**: Click "Corpora" in the nav, confirm a dedicated screen appears, create a
corpus there, and select it as active.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before implementing.

- [X] T007 [P] [US1] Integration test: clicking "Corpora" navigates to the dedicated screen (distinct from the sidebar's inline quick-switcher list) in `frontend/tests/integration/CorporaScreen.test.tsx`
- [X] T008 [P] [US1] Unit test: `CorporaScreen` empty/prompt state, create-corpus form, corpora list rendering, active-corpus indicator in `frontend/tests/unit/CorporaScreen.test.tsx`
- [X] T009 [P] [US1] New e2e test: navigate to the Corpora screen, create a corpus, and select it as active, in `frontend/tests/e2e/corpora-screen.spec.ts`

### Implementation for User Story 1

- [X] T010 [US1] Implement the corpora list (name, active-corpus indicator) in `frontend/src/components/corpora/CorporaScreen.tsx` using `useCorpus()`'s `corpora`/`activeCorpusId` (depends on T005)
- [X] T011 [US1] Implement the empty/prompt state (no corpora yet) in `frontend/src/components/corpora/CorporaScreen.tsx` (depends on T010)
- [X] T012 [US1] Implement the create-corpus form in `frontend/src/components/corpora/CorporaScreen.tsx` using `useCorpus().createCorpus` (FR-002, FR-012) (depends on T010)
- [X] T013 [US1] Implement the select-as-active click handler per corpus row in `frontend/src/components/corpora/CorporaScreen.tsx` using `useCorpus().selectCorpus` (FR-004) (depends on T010)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable (MVP).

---

## Phase 4: User Story 2 - Selecting a corpus updates every other section (Priority: P1)

**Goal**: Switching the active corpus (from the new screen or the sidebar) is immediately and
consistently reflected in Sources and Chunking — the only two sections with real content today.

**Independent Test**: Switch the active corpus from the Corpora screen and confirm Sources and
Chunking both immediately reflect it, without a page reload.

**Note**: This story requires no new implementation — `008-corpora-management`'s `CorpusContext`,
`useSourceDocuments(activeCorpusId)`, and `useFixedSizeChunking(activeCorpusId)` already provide
this exact guarantee app-wide. These tasks are regression-guarding tests proving the new screen's
`selectCorpus` call is the same one those hooks already consume — see research.md §2.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T014 [P] [US2] Integration test: switching the active corpus from the Corpora screen immediately updates the Sources screen's document list, no reload, in `frontend/tests/integration/CorporaScreen.test.tsx`
- [X] T015 [P] [US2] Integration test: switching the active corpus from the Corpora screen immediately updates the Chunking screen's document picker, in `frontend/tests/integration/CorporaScreen.test.tsx`
- [X] T016 [P] [US2] New e2e test: create two corpora each with a distinct document, switch the active corpus from the Corpora screen, confirm Sources and Chunking both reflect it, in `frontend/tests/e2e/corpora-screen.spec.ts`

**Checkpoint**: User Stories 1 and 2 both work independently — cross-section consistency proven from the new screen too.

---

## Phase 5: User Story 3 - Manage a corpus's documents from the Corpora screen (Priority: P2)

**Goal**: From the Corpora screen, view a corpus's documents, attach an existing document (from
anywhere) to it, and remove a document from it.

**Independent Test**: Select a corpus on the Corpora screen, view its documents, attach an existing
document to it, and remove a document from it — all without leaving the screen.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T017 [P] [US3] Contract test for `GET /api/sources/all` (empty, single document, a document in multiple corpora reports all its `corpusIds`, no duplicate entries) in `backend/tests/contract/test_list_all_sources.py` (contracts/list-all-documents-api.md)
- [X] T018 [P] [US3] Unit test for `list_all_documents(db)` in `backend/tests/unit/test_service_list_all.py`
- [X] T019 [P] [US3] Integration test: attach an existing document (already in another corpus) to the selected corpus, then remove it, verified end-to-end via the corpora/sources APIs, in `backend/tests/integration/test_corpora_screen_flow.py`
- [X] T020 [P] [US3] Unit test: `CorporaScreen`'s document panel — lists the selected corpus's documents, "add existing document" picker excludes documents already in that corpus, remove action, in `frontend/tests/unit/CorporaScreen.test.tsx`
- [X] T021 [P] [US3] New e2e test: upload a document into Corpus A, attach it to Corpus B from the Corpora screen's picker without re-uploading, then remove it from Corpus A there, in `frontend/tests/e2e/corpora-screen.spec.ts`

### Implementation for User Story 3

- [X] T022 [US3] Define `AllSourceDocument` and `ListAllSourcesResponse` schemas in `backend/app/sources/schemas.py` (data-model.md)
- [X] T023 [US3] Implement `list_all_documents(db)` in `backend/app/sources/service.py` — join `Document` to `DocumentCorpus`, aggregate each document's `corpusIds`, ordered by `uploaded_at` (contracts/list-all-documents-api.md) (depends on T022)
- [X] T024 [US3] Implement `GET /api/sources/all` in `backend/app/sources/router.py` (depends on T023)
- [X] T025 [P] [US3] Add `listAllSources()` to `frontend/src/lib/sourcesApi.ts`, returning `DocumentWithCorpora[]` (depends on T002, T024)
- [X] T026 [US3] Implement the selected corpus's document panel (name, status) in `frontend/src/components/corpora/CorporaScreen.tsx` using the existing scoped `listSources(corpusId)` (FR-005) (depends on T010)
- [X] T027 [US3] Implement the "add existing document" picker in `frontend/src/components/corpora/CorporaScreen.tsx` — fetch via `listAllSources()`, filter out documents whose `corpusIds` already include the selected corpus, call `attachDocumentToCorpus` on selection (FR-006) (depends on T025, T026)
- [X] T028 [US3] Implement the "remove from this corpus" action in `frontend/src/components/corpora/CorporaScreen.tsx`'s document panel using the existing `removeDocumentFromCorpus` (FR-007) (depends on T026)

**Checkpoint**: User Stories 1, 2, and 3 all work independently.

---

## Phase 6: User Story 4 - Delete a corpus from the Corpora screen (Priority: P3)

**Goal**: Delete a corpus directly from the Corpora screen, blocked while it still has documents.

**Independent Test**: Create an empty corpus on the Corpora screen and delete it directly from that
screen; confirm a non-empty corpus's deletion is blocked with a clear message.

**Note**: The blocking/cascade rules themselves (409 while non-empty, fallback-to-another-corpus on
deleting the active one) already exist in `008-corpora-management`'s corpora API and
`CorpusContext.deleteCorpus`. These tasks wire the existing capability into the new screen's UI.

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

- [X] T029 [P] [US4] Unit test: `CorporaScreen`'s delete action — blocked with a clear message while non-empty, succeeds while empty, in `frontend/tests/unit/CorporaScreen.test.tsx`
- [X] T030 [P] [US4] Integration test: deleting the active corpus falls back to another remaining corpus (or shows "no corpus selected"), with Sources reflecting the change immediately, in `frontend/tests/integration/CorporaScreen.test.tsx`
- [X] T031 [P] [US4] New e2e test: attempt to delete a non-empty corpus from the screen (blocked), remove its document, then delete it successfully, in `frontend/tests/e2e/corpora-screen.spec.ts`

### Implementation for User Story 4

- [X] T032 [US4] Implement the "Delete this corpus" action in `frontend/src/components/corpora/CorporaScreen.tsx` using `useCorpus().deleteCorpus`, surfacing the existing blocked-while-non-empty message clearly (FR-008, FR-011) (depends on T010)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency pass across all stories

- [X] T033 [P] Grep for any other test or component referencing the old "CORPORA" quick-switcher header text and update it for the T004 rename
- [X] T034 Run `specs/009-corpora-screen/quickstart.md` end-to-end manually and fix any discrepancies found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational only — no dependency on US1's tasks, since it
  tests already-existing scoping behavior; can run in parallel with US1 if staffed separately
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's `CorporaScreen` list/selection
  (T010) existing, since the document panel hangs off the selected corpus
- **User Story 4 (Phase 6)**: Depends on Foundational and on US1's `CorporaScreen` list/selection
  (T010) existing, for the same reason
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests are written first and must fail before implementation begins
- Schemas before services; services before routers; backend endpoints before frontend API
  wrappers; API wrappers before UI components that consume them
- Story complete (checkpoint) before moving to the next priority

### Parallel Opportunities

- Setup: T001, T002 in parallel
- All test tasks within a story phase marked [P] can run in parallel
- US2 has no implementation tasks and no file overlap with US1/US3/US4's implementation tasks — its
  tests can be written and run in parallel with any other story's work
- Within US3: T017–T021 (tests) in parallel; T022 before T023 before T024 (same file dependency
  chain), but T025 (frontend API wrapper) can proceed in parallel with T023/T024 once T022's
  schema shape is agreed, since it only needs the contract, not the implementation

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Integration test for Corpora screen navigation in frontend/tests/integration/CorporaScreen.test.tsx"
Task: "Unit test for CorporaScreen empty state/create/list/active-indicator in frontend/tests/unit/CorporaScreen.test.tsx"
Task: "New e2e test for create-and-select-corpus in frontend/tests/e2e/corpora-screen.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart.md §1)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → "Corpora" reachable as its own screen
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: create/list/select corpora on a real screen)
3. Add User Story 2 → Test independently → Deploy/Demo (regression-proof cross-section consistency)
4. Add User Story 3 → Test independently → Deploy/Demo (document management from the screen)
5. Add User Story 4 → Test independently → Deploy/Demo (corpus deletion from the screen)

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: User Story 1 (then User Story 3/4, which build on its `CorporaScreen` list/selection)
- Developer B: User Story 2 (pure test coverage, no shared files with A until Polish)

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete sibling task
- [Story] label maps each task to its user story for traceability
- Verify each story's tests fail before implementing that story
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- T010 (US1) is a shared dependency for US3's (T026) and US4's (T032) implementation tasks — land
  User Story 1 before starting those two stories' implementation work, even though their tests can
  be written earlier
