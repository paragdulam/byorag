# Implementation Plan: PDF Preview Page Indicator

**Branch**: `029-pdf-preview-page-count` | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-pdf-preview-page-count/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a "Page X of N" indicator to the shared `SourceDocumentPreview` component (the
continuous-scroll PDF viewer already used on the Data Sources screen and the Golden
Dataset screen's split view). The current page is derived from which rendered page is
predominantly visible in the preview's scrollable viewport, using an `IntersectionObserver`
on each page's wrapper element to track visibility ratios and pick the maximum. The
indicator lives in the existing toolbar next to the zoom controls, is hidden during the
loading/error/empty states, and resets when the selected document changes — no backend or
API changes are needed since page count and rendering are already fully client-side via
`react-pdf`.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (existing `frontend/` app, Vite build)

**Primary Dependencies**: `react-pdf` (already used for PDF rendering in
`SourceDocumentPreview`); no new dependencies — page-visibility tracking uses the browser's
native `IntersectionObserver` API, already a supported baseline API, no polyfill needed.

**Storage**: N/A — page count and page images are already derived client-side from the PDF
bytes already fetched by `react-pdf`'s `<Document>`/`<Page>`; no persistence involved.

**Testing**: Vitest (`frontend/tests/unit`, `frontend/tests/integration`) and Playwright
(`frontend/tests/e2e`), matching the existing suites for `SourceDocumentPreview` and its
consuming screens.

**Target Platform**: Web (existing React SPA), same browser support envelope as the rest of
the frontend.

**Project Type**: Web application (existing `frontend/` + `backend/` structure) — this
feature is frontend-only.

**Performance Goals**: Page-visibility tracking must not introduce noticeable scroll jank;
`IntersectionObserver` is chosen specifically because it computes visibility off the main
thread's scroll-handler path (no scroll-event listeners, no per-frame layout reads).

**Constraints**: Must work correctly across the existing zoom range (`MIN_SCALE`..`MAX_SCALE`
from `pdfZoom.ts`), in both normal and fullscreen layout states, and across the two existing
consumers of `SourceDocumentPreview` (Data Sources screen, Golden Dataset screen) without
per-consumer special-casing.

**Scale/Scope**: Single shared component change (`SourceDocumentPreview.tsx`) plus its
existing unit/integration/e2e test coverage; no new screens, routes, or entities.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: N/A — this feature touches only PDF preview UI, no
  ingestion/chunking/embedding/retrieval/generation pipeline stage. PASS.
- **II. Test-First, Test at Every Level**: Plan includes unit coverage for the new
  visibility-tracking logic, integration coverage for `SourceDocumentPreview`'s indicator
  states, and e2e coverage for both consuming screens (Data Sources, Golden Dataset),
  matching the existing test layout for this component. PASS (see tasks.md for the
  test-first breakdown).
- **III. Multi-User Simplicity**: N/A — no account/ownership model changes; the preview
  already scopes documents to the requesting user's own corpora. PASS.
- **IV. Fixed Technology Stack**: No new dependency is added (native `IntersectionObserver`,
  no library); stays within React frontend / no backend or storage change. PASS.
- **V. Experiment Observability & Reproducibility**: N/A — this is a preview UI affordance,
  not part of an experiment's recorded configuration or results. PASS.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/029-pdf-preview-page-count/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — N/A, no external interface
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── sources/
│   │   │   └── SourceDocumentPreview.tsx   # gains page-visibility tracking + indicator UI
│   │   └── golden-dataset/
│   │       └── GoldenDatasetScreen.tsx     # consumer, no change needed (reuses the component)
│   └── lib/
│       └── pdfPageVisibility.ts            # new: small helper computing "most visible page"
│                                            #   from IntersectionObserver entries
└── tests/
    ├── unit/
    │   ├── pdfPageVisibility.test.ts       # new
    │   └── SourceDocumentPreview.test.tsx  # extended: indicator states, document-switch reset
    └── e2e/
        ├── fixtures/makePdf.ts             # extended: makeMultiPagePdf() for scroll/zoom specs
        ├── data-sources-screen.spec.ts     # extended: indicator visible + updates on scroll
        └── golden-dataset.spec.ts          # extended: indicator present in split-view preview

backend/    # untouched — this feature is frontend-only, no API/data changes
```

**Structure Decision**: Existing web application layout (`frontend/` + `backend/`). This
feature only touches the `frontend/` tree: the shared `SourceDocumentPreview` component gets
the new visibility-tracking logic and indicator UI, plus a small pure-function helper module
so the "which page is most visible" calculation is unit-testable in isolation from React/DOM
observer wiring. `GoldenDatasetScreen.tsx` and the Data Sources screen need no code changes
since both already render `SourceDocumentPreview` directly — they only need e2e coverage
confirming the indicator shows up through their respective flows (per spec FR-002).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A — no Constitution Check violations.
