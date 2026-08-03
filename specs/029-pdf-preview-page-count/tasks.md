# Tasks: PDF Preview Page Indicator

**Input**: Design documents from `/specs/029-pdf-preview-page-count/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included at unit, integration, and e2e levels for every
user story, written before the implementation that makes them pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story. This feature touches one shared component
(`frontend/src/components/sources/SourceDocumentPreview.tsx`), consumed unmodified by both
the Data Sources screen and the Golden Dataset screen's split view.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app: `frontend/src/`, `frontend/tests/` (this feature is frontend-only; `backend/` is
untouched — see plan.md Summary).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test-environment and fixture prerequisites needed before any story's tests can
be written or run.

- [X] T001 [P] Add a minimal `IntersectionObserver` global stub to `frontend/tests/setup.ts`
      (constructor + no-op `observe`/`unobserve`/`disconnect`), guarded the same way the
      existing `DOMMatrix` stub is (`if (typeof globalThis.IntersectionObserver ===
      'undefined')`), so every test that mounts `SourceDocumentPreview` keeps working once it
      starts constructing a real `IntersectionObserver` — matches the existing pattern
      documented above the `DOMMatrix` stub in that file.
- [X] T002 [P] Add a `makeMultiPagePdf(pageCount: number, textPerPage?: string[])` export to
      `frontend/tests/e2e/fixtures/makePdf.ts`, generalizing the existing single-page object
      graph (`makePdf`) to emit `pageCount` `/Type/Page` objects sharing one `/Type/Pages`
      parent with `Kids` listing all of them and `Count pageCount`, each with its own content
      stream — produces a real, `pypdf`-extractable multi-page PDF for e2e specs to upload.

**Checkpoint**: Test infrastructure ready — story test tasks below can run.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure page-visibility computation shared by every story's behavior. No
user-visible change yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] Unit tests for `mostVisiblePage()` in
      `frontend/tests/unit/pdfPageVisibility.test.ts` per data-model.md's documented shape:
      returns `null` for an empty entries array; returns the single entry's page number when
      given one entry; returns the page number with the highest `intersectionRatio` among
      several; resolves ties deterministically (lowest page number wins).

### Implementation for Foundational

- [X] T004 Implement `mostVisiblePage()` in `frontend/src/lib/pdfPageVisibility.ts` to satisfy
      T003 (depends on T003 failing first).

**Checkpoint**: Foundation ready — page-visibility computation is implemented and unit-tested
in isolation from React/DOM observer wiring. User story implementation can now begin.

---

## Phase 3: User Story 1 - See position while scrolling a document (Priority: P1) 🎯 MVP

**Goal**: The PDF preview shows a "Page X of N" indicator that updates as the user scrolls,
in both the Data Sources screen and the Golden Dataset screen's split view.

**Independent Test**: Open the preview for a multi-page document on either screen, scroll
through it, and confirm the displayed page number tracks whichever page is predominantly
visible, with the total staying fixed.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US1] Integration tests in `frontend/tests/unit/SourceDocumentPreview.test.tsx`:
      after `onLoadSuccess({ numPages: 3 })`, the indicator (`data-testid=
      "source-preview-page-indicator"`) reads `"Page 1 of 3"`; when the test's mocked
      `IntersectionObserver` callback is invoked (via `act`) with page 2's wrapper reporting
      the highest `intersectionRatio`, the indicator updates to `"Page 2 of 3"`.
- [X] T006 [P] [US1] E2E test extension in `frontend/tests/e2e/data-sources-screen.spec.ts`:
      upload a multi-page PDF via `makeMultiPagePdf` (T002), open its preview, assert the
      indicator starts at `"Page 1 of N"`, scroll the preview's scroll area down, and assert
      the indicator advances to a later page number.
- [X] T007 [P] [US1] E2E test extension in `frontend/tests/e2e/golden-dataset.spec.ts`:
      same indicator-present-and-updates-on-scroll assertions as T006, exercised through the
      Golden Dataset screen's split-view document preview pane, confirming FR-002 (every
      location the shared preview is used).

### Implementation for User Story 1

- [X] T008 [US1] In `frontend/src/components/sources/SourceDocumentPreview.tsx`, wrap each
      rendered `<Page>` in a ref-tracked wrapper element carrying its page number (e.g.
      `data-page-number`), and create an `IntersectionObserver` scoped to
      `scrollAreaRef.current` as `root` that observes every wrapper element and tracks each
      one's latest `intersectionRatio`. (depends on T004, T001)
- [X] T009 [US1] Add `currentPage` state to `SourceDocumentPreview.tsx`, recomputed via
      `mostVisiblePage()` from the observer's latest tracked ratios on every callback
      invocation; re-observe the current set of page wrapper elements whenever `numPages`
      changes (new pages mount). (depends on T008)
- [X] T010 [US1] Render the page indicator (`Page {currentPage} of {numPages}`,
      `data-testid="source-preview-page-indicator"`) in the existing footer toolbar next to
      the zoom controls in `SourceDocumentPreview.tsx`, shown only when `documentId !== null
      && !loadError && numPages > 0 && currentPage !== null`. (depends on T009)

**Checkpoint**: User Story 1 is fully functional and independently testable — run T005-T007
to confirm green.

---

## Phase 4: User Story 2 - Page indicator stays correct while zooming (Priority: P2)

**Goal**: Zooming in/out never causes the indicator to show a stale or incorrect page.

**Independent Test**: Load a multi-page document, scroll to a specific page, zoom in and out
repeatedly, and confirm the indicator continues to reflect the page actually in view at each
step.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US2] Integration test in `frontend/tests/unit/SourceDocumentPreview.test.tsx`:
      with the indicator showing `"Page 2 of 3"`, clicking zoom-in or zoom-out does not by
      itself change the indicator's text (no observer-callback fake-out coupled to the click).
- [X] T012 [P] [US2] E2E test extension in `frontend/tests/e2e/data-sources-screen.spec.ts`:
      upload a multi-page PDF (`makeMultiPagePdf`, T002), scroll to a specific page, zoom in
      several times then back out, and assert the indicator shows that same page number
      throughout.

### Implementation for User Story 2

- [X] T013 [US2] Confirm the single `IntersectionObserver` instance from T008 is reused (not
      torn down/recreated) across scale changes so it naturally recomputes visibility ratios
      against each page wrapper's new rendered geometry after a zoom-triggered reflow; adjust
      `SourceDocumentPreview.tsx` only if T011/T012 reveal the observer is being needlessly
      disconnected/reconnected on scale change. (depends on T009)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Indicator reflects loading and unavailable states correctly (Priority: P3)

**Goal**: The indicator never shows a misleading value during loading, on load failure, when
no document is selected, or immediately after switching documents.

**Independent Test**: Trigger the preview's loading state, its unavailable/failed-load state,
and a normal loaded state in sequence, and confirm the indicator's presence/content matches
each state.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T014 [P] [US3] Integration tests in `frontend/tests/unit/SourceDocumentPreview.test.tsx`:
      no `source-preview-page-indicator` element when `documentId={null}` (empty state); none
      after `onLoadError()` fires (unavailable state); none before `onLoadSuccess` has fired
      (loading state); and after re-rendering with a new `documentId` following a loaded
      first document, the indicator does not show the previous document's page/total values
      before the new document's own `onLoadSuccess` fires.

### Implementation for User Story 3

- [X] T015 [US3] In `SourceDocumentPreview.tsx`, reset `currentPage` to `null` inside the
      existing `documentId`-keyed `useEffect` (alongside the existing `numPages`, `loadError`,
      and `scale` resets) and verify the T010 render guard already excludes the loading,
      error, and empty states; adjust the guard or reset effect only if T014 surfaces a gap.
      (depends on T010)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation consistency.

- [X] T016 [P] Update `SourceDocumentPreview.tsx`'s file-level doc comment (the block above
      the component describing its responsibilities, e.g. continuous scroll / fullscreen /
      zoom-pan behavior) to also mention the page indicator, matching the file's existing
      practice of documenting each feature's behavior and originating spec inline.
- [X] T017 Run `cd frontend && npm run test` and `npm run test:e2e -- data-sources-screen.spec.ts golden-dataset.spec.ts` per quickstart.md and confirm all suites pass, including the pre-existing zoom/pan/fullscreen coverage in the same files (regression check).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: No dependency on Setup's tasks (different files); BLOCKS all
  user stories.
- **User Stories (Phase 3+)**: All depend on Foundational (Phase 2) completion.
  - US1 additionally depends on Setup's T001 (test-environment stub) and T002 (multi-page
    fixture) for its own tests.
  - US2 and US3 build directly on US1's implementation (T008-T010) since they refine/guard
    the same state and render path — implement in priority order (US1 → US2 → US3) rather
    than in parallel.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) + Setup (Phase 1). No
  dependency on other stories — this is the MVP.
- **User Story 2 (P2)**: Builds on US1's `currentPage` state and observer (T008-T010) —
  implement after US1, not in parallel with it, though its test/implementation tasks are
  otherwise self-contained.
- **User Story 3 (P3)**: Builds on US1's render guard and reset effect (T010) — implement
  after US1. Independent of US2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation.
- Foundational helper before observer wiring before state before rendering.
- Story complete (all its tasks done, its tests green) before moving to the next priority.

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel — different files.
- T003 (Foundational test) has no file overlap with T001/T002 and can run in parallel with
  them; T004 depends on T003.
- T005, T006, T007 (US1 tests) can run in parallel — different files.
- T008 → T009 → T010 are sequential (same file, each depends on the previous state).
- T011 and T012 (US2 tests) can run in parallel — different files.
- T014 (US3 test) has no parallel sibling in its phase — single file, single task.
- T016 can run in parallel with T017 (doc comment vs. running the suites), though running
  T017 last is recommended to validate T016 didn't break anything trivial.

---

## Parallel Example: Setup + Foundational

```bash
# Launch Setup tasks together:
Task: "Add IntersectionObserver global stub to frontend/tests/setup.ts"
Task: "Add makeMultiPagePdf() to frontend/tests/e2e/fixtures/makePdf.ts"

# Then, independently, the Foundational test:
Task: "Unit tests for mostVisiblePage() in frontend/tests/unit/pdfPageVisibility.test.ts"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Integration tests for the page indicator in frontend/tests/unit/SourceDocumentPreview.test.tsx"
Task: "E2E: indicator visible + updates on scroll in frontend/tests/e2e/data-sources-screen.spec.ts"
Task: "E2E: indicator visible + updates on scroll in frontend/tests/e2e/golden-dataset.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run T005-T007, then manually verify via quickstart.md steps 1 and 4
5. This alone satisfies the feature's core request — Page X of N, updating on scroll, in
   both consuming screens.

### Incremental Delivery

1. Setup + Foundational → Foundation ready (no visible change yet).
2. Add User Story 1 → Test independently → this is the MVP.
3. Add User Story 2 → Test independently → indicator now provably stable through zoom.
4. Add User Story 3 → Test independently → indicator now provably correct through every edge
   state (loading, error, empty, document switch).
5. Polish → full regression pass.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature has one production file at its core
  (`frontend/src/components/sources/SourceDocumentPreview.tsx`) touched across US1/US2/US3 —
  by design, since all three stories describe correctness properties of the same indicator,
  not separate features. Independence is preserved at the test/behavior level: each story's
  tests can be run and validated on their own once the prior story's tasks are complete.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate story independently.
