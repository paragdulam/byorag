# Implementation Plan: Golden Dataset Split-Screen PDF Reference View

**Branch**: `028-golden-dataset-split-view` | **Date**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-golden-dataset-split-view/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Split the Golden Dataset screen into a left half (scope dropdown, then a horizontal row of
Write Manually / Generate with LLM / batch count / Generate a Batch, then all entry-authoring
output — editor, pending-review queue, batch progress, entry list) and a right half reusing the
Sources screen's PDF preview (`SourceDocumentPreview`) so a curator can read the source PDF for
inspiration while authoring entries. Also fixes a pre-existing bug, in both the Sources screen and
the new Golden Dataset right half: zooming a PDF preview widens the preview panel itself (and
pushes its sibling panel) instead of staying a fixed-size, pannable viewport. Root cause (confirmed
by reading the current code): flex items default to `min-width: auto`, so once a zoomed `<Page>`
canvas's intrinsic width exceeds the panel's allotted `w-1/2`, the panel is not allowed to shrink
below that content size and grows instead of scrolling. Fix is `min-width: 0` on the flex chain
from each row container down to the PDF preview's own scroll area — a CSS-only correctness fix, no
behavior change to the zoom math itself (`lib/pdfZoom.ts` is untouched).

## Technical Context

**Language/Version**: TypeScript 5 / React 18 (existing frontend toolchain, no change)

**Primary Dependencies**: React, `react-pdf`/`pdfjs` (existing, already used by
`SourceDocumentPreview`), Tailwind utility classes (existing styling convention)

**Storage**: N/A — no new persisted data; reuses existing `/api/sources/{documentId}/file` and
existing Golden Dataset endpoints unchanged

**Testing**: Vitest + Testing Library (frontend unit/integration), Playwright (e2e) — matching
every prior frontend feature in this repo

**Target Platform**: Web (React SPA), same as the rest of the app

**Project Type**: Web application (existing `frontend/` + `backend/` split) — this feature touches
`frontend/` only

**Performance Goals**: No new performance targets; layout/CSS change only, must not introduce
visible jank when zooming (feel unchanged from today's Sources-screen zoom interaction)

**Constraints**: No backend changes; no changes to `lib/pdfZoom.ts`'s scale math; existing
Golden Dataset behavior (entry creation, generation, review, batch) must be unaffected — this is a
layout/composition change wrapping already-working logic, not a rewrite of it

**Scale/Scope**: Two frontend components change layout (`GoldenDatasetScreen.tsx`,
`DataSourcesScreen.tsx`) and one shared component gets a CSS fix
(`SourceDocumentPreview.tsx`); no new components beyond a thin reuse of the existing preview in
the Golden Dataset screen

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: N/A — no RAG pipeline stage (ingestion, chunking, embedding,
  retrieval, generation) is touched. This is presentation-layer only. PASS.
- **II. Test-First, Test at Every Level (NON-NEGOTIABLE)**: Applies. The layout restructure
  (`GoldenDatasetScreen.tsx`) and the zoom-width bug fix (`SourceDocumentPreview.tsx`) both need
  tests written first: unit/integration tests asserting the two-pane structure, control-row
  ordering, and content confinement (RTL — jsdom can assert DOM structure/classes, not real layout
  width), plus e2e/Playwright assertions using real bounding-box measurements
  (`getBoundingClientRect`) before/after zooming to prove the panel width doesn't change — jsdom
  cannot verify actual pixel layout, so the width-stability requirement (FR-005/SC-002) MUST be
  covered at the e2e level, not just unit level. PASS, with this test-level split noted for
  `/speckit-tasks`.
- **III. Multi-User Simplicity**: N/A — no auth, ownership, or account-scoping changes. PASS.
- **IV. Fixed Technology Stack**: No stack changes — same React/TypeScript/Tailwind frontend,
  same `react-pdf`/`pdfjs` dependency already in use. PASS.
- **V. Experiment Observability & Reproducibility**: N/A — no experiment configuration, chunking,
  embedding, or retrieval behavior is touched; entries/results traceability is unaffected. PASS.

No violations. Complexity Tracking section is not needed.

**Post-Phase 1 re-check**: research.md and data-model.md confirm no new entities, no backend
changes, and no stack additions beyond what's already in use — the design phase did not surface
anything that changes the above gate evaluation. All gates remain PASS.

## Project Structure

### Documentation (this feature)

```text
specs/028-golden-dataset-split-view/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — empty; no API contracts change
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── golden-dataset/
│   │   │   ├── GoldenDatasetScreen.tsx      # MODIFIED: two-pane layout, control row reorder
│   │   │   ├── GoldenEntryEditor.tsx        # unchanged (already fits a half-width column)
│   │   │   ├── EvidenceChunkPicker.tsx      # unchanged
│   │   │   ├── GoldenReviewQueue.tsx        # unchanged
│   │   │   └── BatchGenerationProgress.tsx  # unchanged
│   │   └── sources/
│   │       ├── DataSourcesScreen.tsx        # MODIFIED: min-width:0 fix on left/right panes
│   │       └── SourceDocumentPreview.tsx    # MODIFIED: min-width:0 fix (zoom-width bug), reused as-is by Golden Dataset
│   └── lib/
│       └── pdfZoom.ts                       # unchanged (scale math not touched)
└── tests/
    ├── unit/
    │   ├── GoldenDatasetScreen.test.tsx     # MODIFIED: pane structure, control-row order, content confinement
    │   └── SourceDocumentPreview.test.tsx   # MODIFIED (or new assertions): min-width:0 present on the fix points
    └── e2e/
        └── (existing golden-dataset + sources e2e specs) # MODIFIED: add bounding-box zoom-width assertions,
                                                             # add split-pane assertions for Golden Dataset
```

**Structure Decision**: Existing `frontend/`-only web-app structure (this repo has no `backend/`
changes for this feature). `SourceDocumentPreview` is reused directly by `GoldenDatasetScreen` — no
new preview component is created; the Sources screen's proven zoom/pan/fullscreen component becomes
the Golden Dataset right half as-is, with its layout bug fixed once for both call sites.

## Complexity Tracking

Not applicable — no Constitution Check violations.
