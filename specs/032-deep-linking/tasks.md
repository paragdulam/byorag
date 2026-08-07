---

description: "Task list for 032-deep-linking"
---

# Tasks: Deep Linking & Shareable URLs

**Input**: Design documents from `/specs/032-deep-linking/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/url-scheme.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included below at unit, integration, and e2e level for both
user stories. Write each test task and confirm it fails before starting the implementation
task(s) that follow it.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story. This is a frontend-only feature (see plan.md) — no backend tasks are
needed; `GET /api/corpora/{id}` and `GET /api/golden-dataset/entries/{id}` already exist and are
already owner-scoped.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Web app: `frontend/src/`, `frontend/tests/` (this feature touches `frontend/` only — see plan.md
Project Structure). All paths below are relative to the repository root.

---

## Phase 1: Setup

**Purpose**: Add the routing dependency and the shared `Route` vocabulary every later task builds on

- [X] T001 Add `react-router` to `frontend/package.json` and install it (research.md §1: URL⇄state
      sync layer only, no data-loading/framework mode)
- [X] T002 [P] Define the `AppRoute` type (`screen`, `corpusId`, `entryId`) and the
      `CORPUS_SCOPED_SCREENS`/`SCREEN_ONLY_SCREENS` classification (derived from the existing
      `ScreenId` union in `frontend/src/components/layout/SidebarNav.tsx`) in
      `frontend/src/router/types.ts`, per data-model.md's Route entity

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The URL scheme (parse/build) and shared not-found UI that both user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Unit test `frontend/tests/unit/urlScheme.test.ts` for `parseRoute`/`buildPath`/
      `buildEntryLink`, covering every route row in `contracts/url-scheme.md` (both screen-only
      and corpus-scoped screens, the entity route, `/`, and an unrecognized path) — write first,
      confirm it fails (the module doesn't exist yet)
- [X] T004 Implement `frontend/src/router/urlScheme.ts` (`parseRoute(pathname): AppRoute | null`,
      `buildPath(route): string`, `buildEntryLink(corpusId, entryId): string`) to satisfy T003,
      per `contracts/url-scheme.md` (depends on T002, T003)
- [X] T005 [P] Unit test `frontend/tests/unit/NotFoundState.test.tsx` for a shared "not found /
      no access" component: renders an explanatory message and a link back to a given screen —
      write first, confirm it fails
- [X] T006 Implement `frontend/src/components/router/NotFoundState.tsx` to satisfy T005 (FR-009)
      (depends on T005)

**Checkpoint**: URL scheme and not-found UI exist and are unit-tested — user story implementation
can now begin

---

## Phase 3: User Story 1 - The address bar always reflects where I am (Priority: P1) 🎯 MVP

**Goal**: Every screen gets a real URL that updates on navigation, restores on reload/paste, and
supports Back/Forward — the foundation every other deep-linking capability depends on.

**Independent Test**: Sign in, switch corpora and move between two or three screens, copy the URL
after each move, open each in a fresh tab (same session), and confirm each reopens on the same
screen/corpus (spec.md's Independent Test for US1).

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US1] Extend `frontend/tests/integration/App.test.tsx`: after each existing
      sidebar-navigation assertion, also assert `window.location.pathname` matches
      `contracts/url-scheme.md` for that screen (+ active corpus where applicable) — write first,
      confirm it fails
- [X] T008 [P] [US1] New integration test `frontend/tests/integration/AppRouting.test.tsx`:
      mounting `<App/>` with an initial corpus-scoped URL restores that exact screen/corpus once
      corpora load, and mounting at an unrecognized path renders `NotFoundState` (T006) — write
      first, confirm it fails
- [X] T009 [P] [US1] Extend `frontend/tests/integration/App.auth-gate.test.tsx`: opening a
      corpus-scoped URL while signed out shows `LoginScreen`, and after successful login the app
      lands on that same URL/screen instead of the default screen (FR-008) — write first, confirm
      it fails
- [X] T010 [P] [US1] New e2e test `frontend/tests/e2e/deep-linking-navigation.spec.ts` covering
      quickstart.md Scenario 1: navigating updates the URL; pasting a copied URL in a new tab
      (same session) restores screen+corpus; reload persists screen+corpus; Back/Forward move
      correctly between prior locations — write first, confirm it fails

### Implementation for User Story 1

- [X] T011 [US1] Add `frontend/src/router/AppRouter.tsx`: wrap the app in `react-router`'s
      `BrowserRouter` and expose `useAppRoute()` (current `AppRoute`, built on T004's
      `parseRoute`) and `useAppNavigate()` (`navigateToScreen(screen, corpusId?)`,
      `navigateToEntry(corpusId, entryId)`, `closeEntry(corpusId)`, built on `buildPath`)
      (depends on T004)
- [X] T012 [US1] Rewire `AuthenticatedApp` in `frontend/src/app/App.tsx` to derive the active
      screen from `useAppRoute()` instead of local `useState<ScreenId>`, pass
      `useAppNavigate().navigateToScreen` as every screen's existing `onNavigate` prop (no prop
      signature changes on any screen component), render `NotFoundState` (T006) when the route's
      screen segment is unrecognized or — once `CorpusContext`'s corpora list has loaded — its
      `corpusId` isn't among the signed-in user's corpora, and redirect `/` to the default screen
      (depends on T006, T011)
- [X] T013 [P] [US1] Add `frontend/src/router/useCorpusRouteSync.ts`: on route `corpusId` change,
      call `CorpusContext`'s `selectCorpus`; on `activeCorpusId` change from elsewhere (e.g. the
      Corpora screen), navigate the URL to match — keeping today's `localStorage` last-used-corpus
      fallback in `frontend/src/context/CorpusContext.tsx` intact for corpus-scoped navigation
      with no corpus yet in the URL (depends on T011, T012; research.md §3)
- [X] T014 [P] [US1] Ensure `BrowserRouter` (T011) wraps the whole app — including `AuthGate` —
      not just `AuthenticatedApp`, in `frontend/src/app/App.tsx`. No capture/replay code is
      needed: neither `LoginScreen` nor `SignupScreen` ever touches the URL, so the address bar
      already sits on the originally requested path throughout the sign-in flow, and
      `AuthenticatedApp` reads it via `useAppRoute()` the moment it mounts post-login (FR-008;
      research.md §5, revised during implementation) (depends on T011, T012)

**Checkpoint**: User Story 1 is fully functional and independently testable — every screen is
deep-linkable, reload/Back/Forward/sign-in-redirect all work.

---

## Phase 4: User Story 2 - Share a link directly to one Golden Dataset entry (Priority: P2)

**Goal**: A "copy link" action per entry, and opening that link lands directly on the entry's
existing detail/editor view.

**Independent Test**: Open a Golden Dataset entry, use its "copy link" action, open that link in
a new session, and confirm the entry's detail view opens automatically with the correct corpus
active (spec.md's Independent Test for US2). Depends on User Story 1's router being in place
(research.md: "every other deep-linking capability depends on the app first having real URLs").

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US2] New integration test
      `frontend/tests/integration/GoldenDatasetDeepLink.test.tsx`: a route with an `entryId`
      renders that entry expanded and scrolled into view; an `entryId` that 404s renders
      `NotFoundState` (T006) in place of the list; clicking a row's "Copy link" writes the
      expected URL (via T004's `buildEntryLink`) to the clipboard — write first, confirm it fails
- [X] T016 [P] [US2] New e2e test `frontend/tests/e2e/deep-linking-golden-dataset.spec.ts`
      covering quickstart.md Scenario 2: copy-link → open in a new tab lands directly on the
      entry; sign out then reopen the entry link → completes sign-in → lands on that entry
      (FR-008); deleting the entry then reopening its link renders the not-found message
      (FR-009) — write first, confirm it fails

### Implementation for User Story 2

- [X] T017 [US2] Add a "Copy link" action per row in
      `frontend/src/components/golden-dataset/GoldenEntryList.tsx`, using T004's
      `buildEntryLink(corpusId, entry.id)` and `navigator.clipboard.writeText` (FR-006) (depends
      on T004)
- [X] T018 [US2] Extend `GoldenEntryList` (`frontend/src/components/golden-dataset/GoldenEntryList.tsx`)
      to accept an optional `linkedEntryId` prop: on mount/change, fetch it via the existing
      `getEntry`, scroll its row into view, auto-expand it through the existing click-to-expand
      path when `status === 'approved'` (matching today's manual-click capability — pending/
      rejected entries stay inert here, per 030's existing behavior), and render `NotFoundState`
      (T006) in place of the list on a 404 (depends on T006, T017; research.md §4)
- [X] T019 [US2] Pass the route's `entryId` (via `useAppRoute()`, T011) from
      `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx` into `GoldenEntryList`'s
      new `linkedEntryId` prop, and navigate back to the corpus-only Golden Dataset URL
      (`useAppNavigate().closeEntry`) when the entry is collapsed (depends on T011, T018)

**Checkpoint**: User Stories 1 AND 2 both work independently — every screen is deep-linkable, and
Golden Dataset entries are individually shareable.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Full-repo regression check now that navigation is router-driven everywhere

- [X] T020 [P] Run `npx tsc -b --noEmit` in `frontend/` and fix any type errors introduced by the
      router migration
- [X] T021 [P] Run `npx vitest run` and `npx playwright test deep-linking-navigation.spec.ts
      deep-linking-golden-dataset.spec.ts` in `frontend/`, then the full existing test suites, and
      fix any regressions (FR-011: no existing screen's behavior should change)
- [X] T022 Walk through `specs/032-deep-linking/quickstart.md` Scenarios 1–3 manually end-to-end
      and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS both user stories
- **User Story 1 (Phase 3)**: Depends on Foundational completion — delivers the router foundation
  User Story 2 needs
- **User Story 2 (Phase 4)**: Depends on Foundational completion *and* User Story 1's router
  wiring (T011/T012) — not independent of US1 (both spec.md and research.md call this out: entity
  linking has nothing to route through until screen/corpus routing exists)
- **Polish (Phase 5)**: Depends on both user stories being complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation (T007–T010 before T011–T014; T015–T016
  before T017–T019)
- Router core (T011) before app wiring (T012) before corpus-sync/auth-redirect (T013, T014)
- "Copy link" (T017) and entry-loading/expand (T018) touch the same file sequentially before
  wiring the screen (T019)

### Parallel Opportunities

- T001 and T002 can run in parallel
- T003 and T005 (the two Foundational test files) can run in parallel; each blocks only its own
  implementation task (T004, T006 respectively)
- T007, T008, T009, T010 (all four US1 test files) can run in parallel
- T013 and T014 can run in parallel once T012 is done (different files: `useCorpusRouteSync.ts`
  vs. `App.tsx`'s `AuthGate`)
- T015 and T016 (the two US2 test files) can run in parallel
- T020 and T021 can run in parallel

---

## Parallel Example: Foundational + User Story 1 tests

```bash
# Foundational — launch both test files together:
Task: "Unit test for urlScheme in frontend/tests/unit/urlScheme.test.ts"
Task: "Unit test for NotFoundState in frontend/tests/unit/NotFoundState.test.tsx"

# User Story 1 — launch all four test files together:
Task: "Extend frontend/tests/integration/App.test.tsx with URL assertions"
Task: "New integration test frontend/tests/integration/AppRouting.test.tsx"
Task: "Extend frontend/tests/integration/App.auth-gate.test.tsx with redirect-after-login"
Task: "New e2e test frontend/tests/e2e/deep-linking-navigation.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 manually
5. Deploy/demo if ready — every screen is already bookmarkable/shareable at this point

### Incremental Delivery

1. Setup + Foundational → URL scheme and not-found UI ready
2. User Story 1 → validate independently → deploy (MVP: screen-level deep linking)
3. User Story 2 → validate independently → deploy (adds Golden Dataset entry sharing)
4. Each story adds value without breaking the previous one (FR-011)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at either checkpoint to validate a story independently
- No backend tasks: `GET /api/corpora/{id}` and `GET /api/golden-dataset/entries/{id}` already
  exist and are already owner-scoped (research.md, plan.md)
