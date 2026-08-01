# Implementation Plan: PDF Preview Zoom & Pan

**Branch**: `026-pdf-preview-zoom-pan` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-pdf-preview-zoom-pan/spec.md`

## Summary

Add zoom in/out and drag-to-pan to the Sources screen's PDF preview (`SourceDocumentPreview.tsx`),
so a curator can enlarge fine text/tables in a source document to read it accurately before using
it to build the golden dataset, then pan around the zoomed page.

Technical approach: purely frontend, no backend/API changes. Drive `react-pdf`'s existing `Page`
`scale` prop from a new `scale` React state (100%–400%, clamped) rendered via a small zoom toolbar
alongside the existing Fullscreen/Restore control. Because pages already stack in one continuously
scrolling container, scaling a page up naturally makes it taller/wider than the viewport, so native
scroll already satisfies "pan within the page before advancing to the next" (FR-006a) with no extra
page-boundary tracking. Drag-to-pan is implemented by listening for Pointer Events on the scroll
container and translating pointer movement directly into `scrollLeft`/`scrollTop` changes (covering
mouse and touch with one code path); the browser's native scroll clamping enforces the "can't pan
past the page edge" rule (FR-006) for free. While zoomed in, the PDF text layer's pointer events are
disabled so drag-to-pan wins over text selection (FR-012); at the default (100%) zoom, text
selection behaves exactly as it does today.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 / React 19.2.7 (frontend, Vite) — no backend changes

**Primary Dependencies**: `react-pdf` ^10.4.1 / `pdfjs-dist` (already in use — reusing `Page`'s
existing `scale` prop); native browser Pointer Events API for drag-to-pan — no new dependencies

**Storage**: N/A — zoom level and pan position are transient client-side React state, not persisted

**Testing**: Vitest + Testing Library (`frontend/tests/unit`), Playwright (`frontend/tests/e2e`) —
matches existing project conventions

**Target Platform**: Browser frontend only (existing Docker-composed app, per constitution's fixed
stack) — no backend/infra changes

**Project Type**: Web application (existing `frontend/` only; `backend/` untouched)

**Performance Goals**: Panning must feel immediate with no visible jank while dragging (SC-005) —
achieved by writing `scrollLeft`/`scrollTop` directly via a ref on every pointer-move rather than
round-tripping through React state/re-render on each move event

**Constraints**: No new dependencies; no backend/API changes; must not regress text selection at
the default (100%) zoom level (FR-012); must not alter/download the underlying PDF file (FR-011);
pan bounds must come from the browser's native scroll clamping rather than custom bounds math
(keeps FR-006 correct for free, avoids an extra class of off-by-one bugs)

**Scale/Scope**: One frontend component modified (`SourceDocumentPreview.tsx`) plus one new small
pure-logic module and their tests; zoom range 100%–400% in fixed steps; scope is limited to the
Sources screen's PDF preview, in both its normal split and fullscreen states

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. Presentation-only change to how an already-rendered PDF
  is displayed; it does not touch chunking, embedding, retrieval, or generation strategy code.
- **II. Test-First, Test at Every Level**: PASS (commitment carried into tasks.md). Unit tests for
  the new zoom clamp/step helper and for `SourceDocumentPreview`'s zoom controls, drag-to-pan, and
  reset-on-document-change behavior; an updated Playwright e2e scenario covering zoom, pan, and
  fullscreen compatibility end-to-end.
- **III. Multi-User Simplicity (Right-Sized Complexity)**: PASS. No new account, ownership, or
  permission concept — zoom/pan is ephemeral, per-session client state, not stored per user or
  shared across accounts.
- **IV. Fixed Technology Stack**: PASS. No new libraries, frameworks, or infrastructure — reuses
  `react-pdf`/`pdfjs-dist` (already integrated) and the browser's native Pointer Events API.
- **V. Experiment Observability & Reproducibility**: PASS / not applicable. This feature does not
  touch how chunking/embedding/retrieval experiment configuration is recorded or reproduced — it
  only changes how a source PDF is displayed during document review.

No violations. Complexity Tracking is not needed.

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md) introduce no new
dependencies, no backend/schema changes, and no new API endpoints — only new frontend-only
component behavior and one new pure-logic module. All five gates remain PASS with no changes to
the assessment above.

## Project Structure

### Documentation (this feature)

```text
specs/026-pdf-preview-zoom-pan/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no new or changed API surface — it is entirely
frontend presentation logic over an already-fetched PDF file (`GET /api/sources/{documentId}/file`,
unchanged from `002-persist-pdf-sources`/`023-pdf-fullscreen-chunk-view`).

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── sources/
│   │       └── SourceDocumentPreview.tsx   # + zoom toolbar (in/out/percentage/reset), scale state,
│   │                                        # Pointer Event drag-to-pan handlers on the scroll
│   │                                        # container, text-layer pointer-events toggle (FR-012),
│   │                                        # scale reset added to the existing documentId effect
│   └── lib/
│       └── pdfZoom.ts                      # NEW — pure helpers: clampScale, zoomIn/zoomOut step
│                                            # calculation, DEFAULT_SCALE/MIN_SCALE/MAX_SCALE
│                                            # constants; no React/DOM dependency, unit-testable
│                                            # in isolation
└── tests/
    ├── unit/
    │   ├── SourceDocumentPreview.test.tsx   # updated: zoom in/out/reset controls, current-zoom
    │   │                                    # display, drag-to-pan via pointer events, zoom persists
    │   │                                    # across pages, resets on documentId change, text
    │   │                                    # selection disabled while zoomed
    │   └── pdfZoom.test.ts                  # NEW — clamp/step boundary tests
    └── e2e/
        └── data-sources-screen.spec.ts      # updated: zoom in, pan reveals previously hidden page
                                              # content, reset returns to default, zoom/pan available
                                              # in fullscreen mode too

# backend/ is untouched — no new endpoint, no schema change; the preview already fetches the PDF
# file via the existing sources-file API.
```

**Structure Decision**: Existing `frontend/`-only change within the current `backend/` + `frontend/`
web-application split (`backend/` untouched). One existing component gains zoom/pan behavior, one
new small pure-logic module is added for the zoom math, and their corresponding unit/e2e tests are
updated/added — no other files in the tree are affected.

## Complexity Tracking

*No violations — table not needed.*
