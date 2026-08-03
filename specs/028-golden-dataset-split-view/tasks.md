---

description: "Task list for 028-golden-dataset-split-view"
---

# Tasks: Golden Dataset Split-Screen PDF Reference View

**Input**: Design documents from `/specs/028-golden-dataset-split-view/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/README.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE. Per research.md §5, pane structure/content-confinement is covered at
the integration (RTL/jsdom) level, and the zoom-width-stability guarantee is covered at the e2e
(Playwright, real layout) level — jsdom cannot verify actual pixel widths.

**Organization**: Tasks are grouped by user story (US1, US2, US3 — priorities from spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Web app, frontend-only feature: `frontend/src/`, `frontend/tests/` at repository root (no
`backend/` changes — confirmed in plan.md/data-model.md).

---

## Phase 1: Setup

**Purpose**: Establish a clean baseline before touching shared, already-tested components.

- [X] T001 Run the existing frontend suites (`npm run test`, `npm run test:e2e` from `frontend/`)
      and confirm they pass unmodified, establishing a clean baseline before any change in this
      feature (no file changes in this task).

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites shared by all user stories.

None. This feature has no shared schema, infrastructure, or cross-cutting module that must exist
before any user story can start — US1 touches only `GoldenDatasetScreen.tsx` and its test file,
US2 touches `SourceDocumentPreview.tsx`/`DataSourcesScreen.tsx` (plus, once it exists, the panes
US1 adds), and US3 touches only the control-row markup inside `GoldenDatasetScreen.tsx`. Proceed
directly to Phase 3.

---

## Phase 3: User Story 1 - Read the source PDF while authoring a golden entry (Priority: P1) 🎯 MVP

**Goal**: Split `GoldenDatasetScreen` into a left pane (all existing scope/controls/output,
unchanged internally) and a right pane rendering the reused `SourceDocumentPreview` bound to the
scope dropdown's current document selection (empty state when scope is "Entire Corpus", per
Clarifications 2026-08-03).

**Independent Test**: Open Golden Dataset for a corpus with a previewable document, select it in
the scope dropdown, and confirm the right half shows that document's PDF (scrollable, with working
zoom/fullscreen controls) while the left half still shows the existing authoring UI. This is
testable and deliverable even before US2's bug fix or US3's control-row reorder land.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T002 [US1] Add integration tests to
      `frontend/tests/integration/GoldenDatasetScreen.test.tsx`: (a) the screen renders a
      `golden-dataset-left-pane` and a `golden-dataset-right-pane` (via `data-testid`) once a
      corpus is selected; (b) with a specific document selected in the scope dropdown, the right
      pane renders a `SourceDocumentPreview` for that `documentId` (assert on a rendered PDF-preview
      testid such as `source-preview-scroll-area`, mocking/stubbing the PDF file fetch the same way
      `SourceDocumentPreview.test.tsx` already does); (c) with the scope dropdown set to
      "Entire Corpus", the right pane shows the existing neutral empty state
      (`source-preview-empty` / "Select a document to preview it here") rather than any document;
      (d) switching the scope dropdown from one document to another updates the right pane's
      `documentId`.

### Implementation for User Story 1

- [X] T003 [US1] In `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, import
      `SourceDocumentPreview` from `../sources/SourceDocumentPreview` and add local
      `isFullscreen` state (`useState(false)`) plus a toggle handler, mirroring
      `DataSourcesScreen.tsx`'s existing pattern (depends on T002 existing and failing).
- [X] T004 [US1] In the same file, wrap the screen's existing content (scope dropdown, control
      row, generateError, batch progress, editor, pending-review queue, entry list — everything
      currently inside `<div className="mt-6 flex min-h-0 flex-1 flex-col gap-6">`) in a new flex
      row (`flex min-h-0 flex-1 gap-6`) containing a `golden-dataset-left-pane` div
      (`data-testid="golden-dataset-left-pane"`, `flex min-h-0 w-1/2 flex-col gap-6 overflow-y-auto`)
      holding that existing content, conditionally rendered only when `!isFullscreen` (matching
      `DataSourcesScreen.tsx`'s `{!isFullscreen && (...)}` pattern so FR-012's "fullscreen expands
      over the other half" holds) (depends on T003; same file as T003, sequential).
- [X] T005 [US1] In the same file, add a `golden-dataset-right-pane` div
      (`data-testid="golden-dataset-right-pane"`, `flex min-h-0 flex-col rounded-lg border
      border-outline-variant bg-surface-container` + `w-full` when `isFullscreen` else `w-1/2`,
      matching `sources-right-pane`'s styling) rendering
      `<SourceDocumentPreview documentId={isEntireCorpus ? null : activeDocumentId}
      isFullscreen={isFullscreen} onToggleFullscreen={...} />` (depends on T004; same file,
      sequential).
- [X] T006 [US1] Run `frontend/tests/integration/GoldenDatasetScreen.test.tsx` and confirm all
      tests (existing manual-creation-flow test plus the new T002 tests) pass.

**Checkpoint**: Golden Dataset is now a working two-pane screen; the right pane previews the
selected document using the exact same component/behavior as the Sources screen. The
zoom-width bug (US2) is still present at this point — that's expected and acceptable, since US1 is
independently testable/deliverable without it.

---

## Phase 4: User Story 2 - Zoomed PDF stays pannable without resizing its container (Priority: P1)

**Goal**: Fix the pre-existing bug where zooming a document preview to a high level widens the
preview panel (and pushes sibling panels) instead of staying a fixed-size, pannable viewport —
applied in both the Sources screen and the Golden Dataset screen's new right pane from US1.

**Independent Test**: On the Sources screen alone (no dependency on US1/US3), zoom a document
preview to maximum and confirm the preview panel's outer width is unchanged and dragging still
pans the enlarged page. Separately, repeat on the Golden Dataset screen once US1 exists.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [P] [US2] Extend the existing zoom/pan e2e test in
      `frontend/tests/e2e/data-sources-screen.spec.ts` (the test titled "zoom in, pan, and zoom
      out/reset the PDF preview..."): after zooming to the maximum level, capture
      `sources-right-pane`'s `boundingBox()` width, zoom further/hold at max, and assert the pane's
      width is unchanged from its width at 100% zoom (measure once before the first `zoomIn`
      click and again after reaching 200%; `toBe`/`toBeCloseTo` equal).
- [X] T008 [P] [US2] Add a new e2e test to `frontend/tests/e2e/golden-dataset.spec.ts`: select a
      previewable document in the scope dropdown, capture `golden-dataset-right-pane`'s and
      `golden-dataset-left-pane`'s `boundingBox()` widths at default zoom, zoom the preview to
      maximum via `source-preview-zoom-in`, and assert both panes' widths are unchanged (covers
      FR-006, SC-002, US2 acceptance scenario 2 — this test necessarily depends on US1's panes
      existing, so add it after Phase 3, not before).
- [X] T009 [P] [US2] Add unit assertions to `frontend/tests/unit/SourceDocumentPreview.test.tsx`
      confirming the root container and the `source-preview-scroll-area` element carry a
      `min-w-0` class — a supplementary structural check only (per research.md §5, insufficient
      alone, since a misapplied class would still pass this check; the e2e tests above are the
      real proof).

### Implementation for User Story 2

- [X] T010 [P] [US2] In `frontend/src/components/sources/SourceDocumentPreview.tsx`, add
      `min-w-0` to the root `<div className="flex h-full min-h-0 flex-1 flex-col">` and to the
      `scrollAreaRef` div (`className="min-h-0 flex-1 overflow-auto"`) — the fix identified in
      research.md §1 (flex items default to `min-width: auto`, which prevents these containers
      from shrinking below the zoomed `<Page>` canvas's intrinsic width; `min-w-0` removes that
      floor so `overflow-auto` actually scrolls instead of the container growing). Do not modify
      `lib/pdfZoom.ts` or the pointer drag handlers.
- [X] T011 [P] [US2] In `frontend/src/components/sources/DataSourcesScreen.tsx`, add `min-w-0` to
      the `sources-right-pane` div and to the `sources-left-pane` div (both currently `w-1/2`
      with no `min-width: 0` override), and to their shared parent row
      (`<div className="mt-6 flex min-h-0 flex-1 gap-6">`).
- [X] T012 [P] [US2] In `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, add
      `min-w-0` to the `golden-dataset-left-pane` div, the `golden-dataset-right-pane` div, and
      their shared parent row added in T004/T005 (depends on Phase 3 being complete).
- [X] T013 [US2] Run `frontend/tests/e2e/data-sources-screen.spec.ts`,
      `frontend/tests/e2e/golden-dataset.spec.ts`, and `frontend/tests/unit/SourceDocumentPreview.test.tsx`
      and confirm all tests (existing plus T007–T009) pass.

**Checkpoint**: Zooming to maximum on either screen no longer changes any panel's outer width, on
top of the working two-pane Golden Dataset layout from US1.

---

## Phase 5: User Story 3 - Entry-authoring controls and their output stay confined to the left half (Priority: P2)

**Goal**: Move the existing Write Manually / Generate with LLM / batch-count / Generate a Batch
row to sit directly below the scope dropdown (instead of beside it), both now inside the
`golden-dataset-left-pane` that US1 already established (all of the controls' *output* — editor,
error message, batch progress, pending-review queue, entry list — was already wrapped inside that
same pane by T004, so no further confinement work is needed beyond the row reorder itself).

**Independent Test**: With the split layout from US1 in place, confirm the scope dropdown sits
alone at the top of the left half, the four controls form one horizontal row directly beneath it,
and triggering each control keeps its output inside the left half only.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write this test FIRST, ensure it FAILS before implementation**

- [X] T014 [US3] Add an integration test to
      `frontend/tests/integration/GoldenDatasetScreen.test.tsx` asserting DOM order: the scope
      `<select>` (`#golden-dataset-document`) appears before the "Write Manually" button, which is
      followed immediately (as row siblings) by "Generate with LLM", the batch-count input
      (`#golden-dataset-batch-count`), and "Generate a Batch…", all four inside one container that
      is itself a sibling appearing after the dropdown's own container (not beside it) — use
      `compareDocumentPosition` or container `querySelectorAll` ordering, matching this
      repo's existing style for order-sensitive assertions.

### Implementation for User Story 3

- [X] T015 [US3] In `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, split the
      current `<div className="flex shrink-0 items-end justify-between gap-4">` (which places the
      dropdown and the `flex gap-2` control row side by side) into two stacked rows: the scope
      dropdown alone on top (unchanged markup/behavior), and the existing `flex gap-2` control row
      (Write Manually / Generate with LLM / batch input / Generate a Batch — unchanged internals)
      directly below it (depends on T014 existing and failing; same file as Phase 3/4 edits,
      sequential).
- [X] T016 [US3] Run `frontend/tests/integration/GoldenDatasetScreen.test.tsx` and confirm all
      tests (T002, T014, and the pre-existing manual-creation-flow test) pass.

**Checkpoint**: All three user stories are complete and independently verified. The Golden Dataset
screen matches the full spec: two panes, a stable-width pannable preview on the right, and a
dropdown-then-controls left half whose output never leaves it.

---

## Addendum: fixes found during T006/T013/T016–T018 verification (not in the original breakdown)

Two real defects surfaced only once real code review and real-browser measurement (not just
unit/jsdom assertions) were applied — both fixed and covered by tests before Phase 6 was signed off:

1. **FR-012 violation — fullscreen toggle discarded unsaved editor text.** T004's left-pane
   implementation copied `DataSourcesScreen`'s `{!isFullscreen && (...)}` conditional-unmount
   pattern verbatim. Unlike Sources' left pane, Golden Dataset's left pane holds `GoldenEntryEditor`,
   whose `question`/`answer` fields are local component state — unmounting it on every fullscreen
   toggle silently discarded any unsaved draft. Fixed in `GoldenDatasetScreen.tsx` by keeping the
   left pane mounted and hiding it via a `hidden` class instead of conditional JSX unmounting.
   Covered by a new integration test: "preserves unsaved editor text and stays in the manual editor
   across a fullscreen toggle (FR-012)" in `GoldenDatasetScreen.test.tsx` — verified to fail against
   the original conditional-unmount implementation and pass against the fix.
2. **SC-002 was only partially satisfied — the real root cause was one level higher than
   research.md §1 identified.** T010–T012's `min-w-0` additions (`SourceDocumentPreview.tsx`,
   `DataSourcesScreen.tsx`, `GoldenDatasetScreen.tsx`) were necessary but not sufficient: the shared
   `AppShell.tsx` layout's `<main>` element (used by every screen) is itself a flex item with no
   `min-width: 0` override, so it could still grow past the viewport at high zoom, inflating
   everything inside it — including the already-`min-w-0`'d panes, which then just reported "50% of
   an already-inflated base." This is why the original T007/T008 e2e assertions (4 zoom-in clicks,
   100%→200%) passed reliably despite the fix being incomplete — that zoom level didn't yet exceed
   the viewport-overflow threshold. A `--workers=1` combined run of `data-sources-screen.spec.ts` +
   `golden-dataset.spec.ts` exposed it (widths jumping from ~636px to ~858px), confirmed
   deterministically via a standalone diagnostic script driving an isolated dev-server instance and
   dumping `getComputedStyle().minWidth` up the full DOM chain. Fixed by adding `min-w-0` to
   `AppShell.tsx`'s two wrapping flex containers (the `flex-col` div holding `TopBar`+`main`, and
   `<main>` itself). Verified with a standalone script zooming to the true maximum (400%, 12 clicks)
   with the outer width unchanged at every step, then reconfirmed via the existing T007/T008
   Playwright e2e assertions passing repeatedly, including in combined/parallel runs that previously
   exposed the gap.
3. **Regression, not pre-existing flake — batch-completion message became unobservable.**
   Embedding `SourceDocumentPreview` into a real-PDF-rendering right pane in
   `golden-dataset.spec.ts`'s existing batch-generation e2e test shifted timing enough that
   `BatchGenerationProgress`'s "N of M entries generated successfully" message — previously shown
   for one render just before `handleBatchComplete` unmounts the component — stopped being reliably
   observable (confirmed via `git stash` bisection against clean `main`, where the test passed
   reliably, and via `performance.now()`-timestamped instrumentation showing the render and the
   unmount-triggering effect firing within under a millisecond of each other). A memoization fix to
   `sourceFileRequest`'s consumer (`useMemo` on the `file` prop in `SourceDocumentPreview.tsx`,
   fixing a genuine pre-existing inefficiency — react-pdf was reloading/reparsing the PDF on every
   unrelated re-render) reduced but did not eliminate the race. Root-caused and fixed properly in
   `GoldenDatasetScreen.tsx`: the completion summary is now captured directly from
   `handleBatchComplete`'s own `results` argument into dedicated `lastBatchResults` state, rendered
   independently of `BatchGenerationProgress`'s mount lifecycle, instead of relying on catching a
   single transient render before unmount. Verified stable across repeated standalone and
   combined/parallel e2e runs.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Run `specs/028-golden-dataset-split-view/quickstart.md` end to end against a local
      dev stack (all three user-story sections plus "Cross-cutting checks") and confirm every
      "Expect" holds.
- [X] T018 Run the full frontend suite (`npm run test`, `npm run test:e2e` from `frontend/`) and
      confirm zero regressions beyond the intended changes (SC-004: existing Golden Dataset
      functionality unaffected; SC-005: existing Sources-screen preview functionality unaffected
      aside from the width fix itself).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Empty — no blocking prerequisites for this feature.
- **User Story 1 (Phase 3)**: Can start once Setup is done. No dependency on US2 or US3.
- **User Story 2 (Phase 4)**: T007, T010, T011 have no dependency on US1 and could start in
  parallel with Phase 3; T008 and T012 specifically need US1's panes (`golden-dataset-left-pane`
  / `golden-dataset-right-pane`) to exist, so those two tasks wait on Phase 3's completion even
  though the rest of Phase 4 does not.
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs `golden-dataset-left-pane` and the
  existing dropdown/control-row markup to restructure). Independent of Phase 4.
- **Polish (Phase 6)**: Depends on Phases 3–5 all being complete.

### Within Each User Story

- Tests are written and confirmed failing before implementation (T002→T003–T005;
  T007–T009→T010–T012; T014→T015).
- All of US1's and US3's implementation tasks land in the same file
  (`GoldenDatasetScreen.tsx`) and are therefore sequential, not parallel, despite being separate
  tasks.

### Parallel Opportunities

- T007 (Sources e2e), T010 (`SourceDocumentPreview.tsx`), T011 (`DataSourcesScreen.tsx`) can all
  start immediately and in parallel with Phase 3 (US1), since none of them touch
  `GoldenDatasetScreen.tsx` or depend on its panes existing.
- T008 and T012 are parallel to each other (different files) but both must wait for Phase 3.
- T009 (unit test) can run in parallel with T007/T008/T010–T012.

---

## Parallel Example: User Story 2

```bash
# These can run together — different files, no shared dependency:
Task: "Extend zoom/pan e2e test with pane-width assertions in frontend/tests/e2e/data-sources-screen.spec.ts"
Task: "Add min-w-0 to SourceDocumentPreview.tsx"
Task: "Add min-w-0 to DataSourcesScreen.tsx panes"

# These must wait until Phase 3 (US1) is done, but are parallel to each other:
Task: "Add Golden Dataset pane-width e2e test in frontend/tests/e2e/golden-dataset.spec.ts"
Task: "Add min-w-0 to GoldenDatasetScreen.tsx panes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 3: User Story 1 — two-pane layout with a working (if still zoom-buggy) preview.
3. **STOP and VALIDATE**: Confirm US1's independent test passes.
4. This alone already delivers the feature's core value (reading the PDF while authoring).

### Incremental Delivery

1. Setup → Phase 3 (US1) → validate → the split-screen preview is live (bug still present).
2. Phase 4 (US2) → validate → zoom is now correct on both screens.
3. Phase 5 (US3) → validate → controls are correctly positioned below the dropdown.
4. Phase 6 (Polish) → full quickstart + regression pass.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- No backend tasks — this feature is frontend-only (confirmed in plan.md/data-model.md/contracts).
- Verify each story's tests fail before implementing that story.
- Commit after each task or logical group.
- Avoid: vague tasks, same-file conflicts marked [P], cross-story dependencies that break
  independence (US1 and US2 deliberately do not depend on each other; only US3's and part of
  US2's tasks depend on US1's panes existing).
