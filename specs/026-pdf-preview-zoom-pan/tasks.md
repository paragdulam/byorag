---

description: "Task list template for feature implementation"
---

# Tasks: PDF Preview Zoom & Pan

**Input**: Design documents from `/specs/026-pdf-preview-zoom-pan/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app per plan.md: `frontend/src/...`, `frontend/tests/...`. No `backend/` changes — this
feature is entirely frontend presentation logic (plan.md Project Structure).

---

## Phase 1: Setup (Shared Infrastructure)

No new dependencies are needed for this feature (plan.md Technical Context — no new packages).
Proceed directly to the Foundational phase below.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the pure zoom-math helper module every user story's implementation calls into
(zoom in/out stepping and clamping) before any story's UI work begins.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T001 [P] Unit test for `frontend/tests/unit/pdfZoom.test.ts` — `clampScale` clamps a value
  below `MIN_SCALE` up to `MIN_SCALE` and a value above `MAX_SCALE` down to `MAX_SCALE`, and passes
  in-range values through unchanged; `zoomIn(scale)` returns `scale + 0.25` clamped to `MAX_SCALE`;
  `zoomOut(scale)` returns `scale - 0.25` clamped to `MIN_SCALE`; `DEFAULT_SCALE === MIN_SCALE ===
  1.0` and `MAX_SCALE === 4.0` (research.md §3, data-model.md `ZoomState`)
- [X] T002 Create `frontend/src/lib/pdfZoom.ts` — pure `clampScale`, `zoomIn`, `zoomOut` functions
  and `DEFAULT_SCALE`/`MIN_SCALE`/`MAX_SCALE` constants, no React/DOM dependency (research.md §3,
  data-model.md `ZoomState`) — depends on T001 failing first

**Checkpoint**: Zoom math ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Zoom in to read fine details clearly (Priority: P1) 🎯 MVP

**Goal**: The Sources screen's PDF preview gains a zoom-in control and a current-zoom-level display;
clicking it enlarges the page (crisply re-rendered via `react-pdf`'s `scale` prop, not stretched)
up to a defined maximum.

**Independent Test**: Open Sources, select a document, click zoom-in repeatedly, and confirm the
page enlarges and stays readable each time, stopping at a clearly indicated maximum — without any
pan or zoom-out/reset control existing yet.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US1] Unit test for `frontend/tests/unit/SourceDocumentPreview.test.tsx` — a zoom
  toolbar renders a `data-testid="source-preview-zoom-in"` button and a
  `data-testid="source-preview-zoom-level"` element showing `100%` by default; clicking zoom-in
  increases the displayed percentage and the `scale` value passed to every rendered `Page`; clicking
  zoom-in repeatedly stops increasing once `400%` is reached and the button becomes `disabled`
  (FR-001, FR-003, FR-007)

### Implementation for User Story 1

- [X] T004 [US1] In `frontend/src/components/sources/SourceDocumentPreview.tsx`: add a `scale`
  state (default `DEFAULT_SCALE` from `pdfZoom.ts`), reset it to `DEFAULT_SCALE` inside the existing
  `useEffect` that already resets `numPages`/`loadError` on `documentId` change (FR-010); render a
  zoom toolbar with a zoom-in button (`data-testid="source-preview-zoom-in"`, calling
  `clampScale(zoomIn(scale))`) and a percentage display (`data-testid="source-preview-zoom-level"`,
  formatted as `Math.round(scale * 100) + '%'`); pass `scale` as the `scale` prop to every rendered
  `Page` — depends on T002, T003 failing first

**Checkpoint**: User Story 1 is fully functional and independently testable — MVP deliverable.

---

## Phase 4: User Story 2 - Pan around a zoomed page (Priority: P2)

**Goal**: While zoomed in (via User Story 1's zoom-in control), the curator can click/touch-and-drag
inside the preview to reveal parts of the page that no longer fit the visible area, without losing
their zoom level, and without the drag being hijacked by normal PDF text selection.

**Independent Test**: Zoom a page in beyond the visible preview area, drag to reveal previously
hidden corners of the page, and confirm the zoom level is unchanged throughout and dragging never
reveals empty space beyond the page edge — independent of the zoom-out/reset controls added in User
Story 3.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US2] Unit test for `frontend/tests/unit/SourceDocumentPreview.test.tsx` — with
  `scale` above `MIN_SCALE`, a `pointerdown` + `pointermove` sequence on the preview scroll
  container (`data-testid="source-preview-scroll-area"`) updates its `scrollLeft`/`scrollTop` in the
  direction of the drag; `pointerup` ends the drag; the page-content wrapper
  (`data-testid="source-preview-page-content"`) has `pointer-events: none` while `scale > MIN_SCALE`
  and no `pointer-events: none` at `MIN_SCALE` (FR-005, FR-006, FR-012, Clarification 2, research.md
  §5, §6 — revised during implementation to target the wrapper rather than `react-pdf`'s internal
  text-layer node; see research.md §6)
- [X] T006 [P] [US2] Unit test for `frontend/tests/unit/SourceDocumentPreview.test.tsx` — every
  rendered `Page` receives the same current `scale` value regardless of its page index, i.e. zoom is
  shared/consistent across all stacked pages rather than per-page (FR-009, research.md §4)

### Implementation for User Story 2

- [X] T007 [US2] In `frontend/src/components/sources/SourceDocumentPreview.tsx`: add
  `data-testid="source-preview-scroll-area"` to the existing scroll container and attach
  `onPointerDown`/`onPointerMove`/`onPointerUp` handlers that capture the pointer, record the drag
  start `{clientX, clientY, scrollLeft, scrollTop}` in a ref, and write `scrollLeft`/`scrollTop`
  directly on the container ref on each move (no React state per pixel of movement, per plan.md
  Performance Goals) — depends on T002, T005 failing first
- [X] T008 [US2] In `frontend/src/components/sources/SourceDocumentPreview.tsx`: conditionally apply
  `pointer-events: none` to the page-content wrapper div while `scale > MIN_SCALE` (unset at
  `MIN_SCALE`) via its inline `style` — pan handlers live one level up on the scroll container so
  they still receive the (hit-tested-through) pointer events (FR-012, research.md §6) — depends on
  T005 failing first, T007

**Checkpoint**: User Stories 1 AND 2 both work independently — zoom and pan are usable together.

---

## Phase 5: User Story 3 - Return to the default view (Priority: P3)

**Goal**: The zoom toolbar gains a zoom-out control (mirroring zoom-in, stopping at the default
minimum) and a one-click reset control that returns to the default view from any zoom level.

**Independent Test**: Zoom in on a page, then use zoom-out and separately reset, confirming both
return the view toward/to the default `100%` level — independent of the pan behavior added in User
Story 2.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US3] Unit test for `frontend/tests/unit/SourceDocumentPreview.test.tsx` — a
  `data-testid="source-preview-zoom-out"` button decreases the displayed percentage on each click and
  stops at `100%` (becoming `disabled` at the minimum); a `data-testid="source-preview-zoom-reset"`
  button sets the percentage back to exactly `100%` in one click from any zoom level (FR-002, FR-004,
  FR-007)

### Implementation for User Story 3

- [X] T010 [US3] In `frontend/src/components/sources/SourceDocumentPreview.tsx`: add a zoom-out
  button (`data-testid="source-preview-zoom-out"`, calling `clampScale(zoomOut(scale))`) and a reset
  button (`data-testid="source-preview-zoom-reset"`, setting `scale` directly to `DEFAULT_SCALE`) to
  the zoom toolbar — depends on T002, T004, T009 failing first

**Checkpoint**: All three user stories are independently functional — full zoom/pan feature complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the feature end-to-end and across the normal/fullscreen layouts both stories'
independent tests didn't cover.

- [X] T011 [P] Integration test update for `frontend/tests/integration/DataSourcesScreen.test.tsx` —
  the zoom toolbar (zoom-in/out/reset/percentage) renders and functions identically whether
  `isFullscreen` is `false` or `true`; toggling fullscreen does not reset the current zoom level
  (FR-008, research.md §7)
- [X] T012 [P] E2E update for `frontend/tests/e2e/data-sources-screen.spec.ts` — against a real PDF
  fixture: zoom in, drag to pan and reveal previously hidden content, zoom out/reset back to the
  default, and confirm the same controls work after toggling into fullscreen
  (`specs/026-pdf-preview-zoom-pan/quickstart.md` US1–US3, cross-cutting checks). Caught a real bug
  during implementation: horizontal overflow was still on the inner page-content div while the
  drag-to-pan handlers read/wrote `scrollLeft`/`scrollTop` on the outer scroll-area div — fixed by
  moving both axes' overflow onto the outer container (see `SourceDocumentPreview.tsx` diff and
  research.md §5 addendum). Uses a widened 1600×900 viewport to route around a pre-existing,
  unrelated `DocumentList` responsive-layout bug (fixed-width columns starve the name column at the
  Playwright-default 1280×720 width) and signs up its own user to route around a pre-existing,
  unrelated auth-gate gap in this spec file's older tests (both documented in the implementation
  completion report, not fixed here — out of scope for this feature).
- [X] T013 Run every scenario in `specs/026-pdf-preview-zoom-pan/quickstart.md` end-to-end against
  the running dev stack, including the manual Network-tab check that zooming/panning issues no
  requests and never re-fetches the PDF (FR-011). Every US1–US3 and cross-cutting scenario is
  exercised by T012's real-browser Playwright run (real backend, real PDF via pdf.js, real pointer
  drag physics) — confirmed passing. The "no network request" check (FR-011) was verified by code
  inspection: `SourceDocumentPreview.tsx`'s zoom/pan/reset code paths only touch React state,
  `scrollLeft`/`scrollTop`, and inline styles — no `fetch`/API call exists anywhere in the zoom/pan
  implementation; the PDF is fetched exactly once, on document load, unrelated to zoom controls.
- [X] T014 Run the frontend suites (`npm run test`, `npm run test:e2e`) once more to confirm no
  regressions across all three stories. Unit/integration: 470/472 passing (2 pre-existing, unrelated
  failures — corpus attach/remove UI is commented out, documented since `023-pdf-fullscreen-chunk-view`).
  E2E: this feature's new test passes end-to-end against a real browser/backend; `tsc -b --noEmit`
  reports zero errors in any file this feature touches.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A for this feature (no new dependencies)
- **Foundational (Phase 2)**: Blocks Phases 3–5 (all three stories call into `pdfZoom.ts`'s
  `clampScale`/`zoomIn`/`zoomOut`/constants)
- **User Stories (Phase 3–5)**: All depend on Phase 2. US2 and US3 both build on the `scale` state
  and toolbar US1 introduces in the same file, so within this feature they are implemented in
  priority order (P1 → P2 → P3) rather than by separate developers in parallel — see Parallel
  Opportunities below for what *can* still run concurrently.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3 — deliverable as a standalone MVP
- **User Story 2 (P2)**: Reuses the `scale` state/toolbar US1 adds to
  `SourceDocumentPreview.tsx`; independently *testable* per its own acceptance scenarios (assuming
  zoom is already possible), but its implementation tasks (T007, T008) are sequenced after US1
- **User Story 3 (P3)**: Same file/state reuse as US2; independently testable per its own
  acceptance scenarios, implementation task (T010) sequenced after US1 (and after US2 to avoid
  toolbar-markup merge conflicts, though it has no functional dependency on US2's pan behavior)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- T001 (pdfZoom tests) before T002 (pdfZoom implementation)
- T003 (US1 test) before T004 (US1 implementation), which depends on T002
- T005/T006 (US2 tests) before T007/T008 (US2 implementation), which depend on T002 and on T004
  (US1's `scale` state/toolbar existing)
- T009 (US3 test) before T010 (US3 implementation), which depends on T002 and T004
- Story complete before moving to Polish

### Parallel Opportunities

- T001 is the only Foundational test — no other Foundational task runs alongside it
- Within US2: T005 and T006 (tests, same file but non-overlapping assertions) can be authored in
  parallel; T007 and T008 touch overlapping regions of the same file and are sequenced
- Within Polish: T011 and T012 touch different files and can run in parallel; T013 and T014 are
  manual/whole-suite verification steps run after T011/T012 land
- Because every story's implementation lands in the same single component file
  (`SourceDocumentPreview.tsx`), there is no safe cross-story parallelism for implementation tasks
  in this feature — parallelism here is at the test-authoring level (writing US1/US2/US3 tests
  ahead of time) rather than simultaneous implementation by different developers

---

## Parallel Example: User Story 2

```bash
# Author both User Story 2 tests together (same file, independent assertions):
Task: "Unit test for drag-to-pan + text-layer pointer-events toggle in frontend/tests/unit/SourceDocumentPreview.test.tsx"
Task: "Unit test for shared scale across all rendered pages in frontend/tests/unit/SourceDocumentPreview.test.tsx"

# Then implement sequentially (same file, same drag-handler region):
Task: "Add pointer-driven scrollLeft/scrollTop drag-to-pan handlers"
Task: "Toggle text-layer pointer-events based on scale"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T002)
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Confirm zoom-in enlarges the page crisply and stops at the maximum
4. Deploy/demo if ready — a curator can already read fine print more clearly, even without pan/reset

### Incremental Delivery

1. Foundational → User Story 1 → test independently → deploy/demo (MVP!)
2. Add User Story 2 (pan) → test independently → deploy/demo
3. Add User Story 3 (zoom-out/reset) → test independently → deploy/demo
4. Each story adds value without breaking the previous ones

### Parallel Team Strategy

This feature's three stories all converge on one file (`SourceDocumentPreview.tsx`), so — unlike a
feature split across independent files — a multi-developer split is not recommended here. One
developer should carry Foundational → US1 → US2 → US3 in order to avoid merge conflicts in the
same component; a second developer can usefully work ahead on Phase 6's test files (T011, T012)
once US1 lands, or on unrelated work entirely.

---

## Notes

- [P] tasks = different files, no dependencies (or, within the same file, non-overlapping test
  assertions safe to author together)
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
