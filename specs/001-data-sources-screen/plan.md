# Implementation Plan: Data Sources Screen

**Branch**: `001-data-sources-screen` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-data-sources-screen/spec.md`

## Summary

Implement the "Data Sources" screen: a React screen matching the provided
design (`assets/sources/screen.png`, `assets/sources/DESIGN.md`) that lets the
single local user drag-and-drop or browse to upload PDF files, validates them
client-side (PDF only, ≤50MB), lists them with name/size/upload
time/status, lets the user export the list to CSV, and renders the
surrounding app shell (sidebar nav, top bar, vector-storage widget) as
static/placeholder chrome. Per the spec, there is no backend call and no
persistence in this feature — all state lives in the browser session and
resets on reload.

## Technical Context

**Language/Version**: TypeScript 5.x on React 18, Node.js 20 LTS for tooling

**Primary Dependencies**: React 18, Vite (build/dev server), Tailwind CSS
(configured with the color/type/spacing tokens from
`assets/sources/DESIGN.md`), native HTML5 Drag-and-Drop + `<input type="file">`
for uploads (no third-party dropzone library needed for this scope)

**Storage**: N/A — per FR-009, no backend/database/filesystem persistence in
this feature; document list lives in React component state for the browser
session only

**Testing**: Vitest + React Testing Library (unit + integration/component
tests), Playwright (end-to-end browser test of the upload → list → export
flow) — required by constitution Principle II (Test-First, Test at Every
Level)

**Target Platform**: Desktop web browsers (current Chrome/Firefox/Safari),
served from a containerized static build per constitution Principle IV

**Project Type**: Web application — this feature only touches the `frontend/`
project; `backend/` is not created by this feature since no backend calls are
required (see Complexity Tracking for why this is not a constitution
violation)

**Performance Goals**: Uploaded file appears in the list in <2s with no full
page reload (SC-001)

**Constraints**: Client-side-only file type validation (PDF/`application/pdf`)
and size validation (≤50MB, per FR-005/FR-006); no network calls required by
this feature

**Scale/Scope**: Single local user, single screen, session-only state (no
persistence across reloads, per FR-009 and the constitution's Single-User
Simplicity principle)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Pluggable RAG Architecture | N/A / Pass | This feature adds no ingestion/chunking/embedding/retrieval logic — it is a UI shell for uploading files. Nothing here forecloses making later ingestion pluggable. |
| II. Test-First, Test at Every Level | Pass (enforced in tasks) | Unit tests for validation/formatting/CSV utils, component/integration tests for upload + list + export flows, and one Playwright e2e test for the full user journey are required in `tasks.md` before implementation is considered done. |
| III. Single-User Simplicity (YAGNI) | Pass | No auth, no multi-user, no persistence layer added — matches FR-009 and the spec's Assumptions. |
| IV. Fixed Technology Stack | Pass (partially deferred, see Complexity Tracking) | Uses React per the fixed stack. A frontend-only `Dockerfile` is included so the screen is containerizable; the full `docker-compose` wiring frontend+backend+Qdrant is deferred to the feature that introduces the backend/Qdrant, since neither exists yet. |
| V. Experiment Observability & Reproducibility | N/A | No experiments are run or recorded by this feature; nothing to trace yet. |

No unjustified violations. One deferral is recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-data-sources-screen/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/
│   │   └── App.tsx                     # Root app shell composition
│   ├── components/
│   │   ├── layout/
│   │   │   ├── SidebarNav.tsx          # Sources/Experiments/Playground/Vector View/Logs (Sources active)
│   │   │   └── TopBar.tsx              # Search, notifications, Deploy Pipeline (placeholder)
│   │   └── sources/
│   │       ├── DataSourcesScreen.tsx   # Composes upload area + list + storage widget
│   │       ├── UploadDropzone.tsx      # Drag-and-drop + browse, validation errors
│   │       ├── VectorStorageWidget.tsx # Static placeholder stat card
│   │       └── DocumentList.tsx        # Table + status chip + Export CSV + View All
│   ├── hooks/
│   │   └── useSourceDocuments.ts       # In-memory document list state + status simulation
│   ├── lib/
│   │   ├── fileValidation.ts           # PDF-type + 50MB checks
│   │   ├── formatFileSize.ts           # Human-readable size formatting
│   │   └── exportCsv.ts                # Builds/downloads CSV from document list
│   ├── types/
│   │   └── sourceDocument.ts           # SourceDocument type/status enum
│   └── styles/
│       └── tailwind.css                # Tailwind entry importing design tokens
├── tests/
│   ├── unit/
│   │   ├── fileValidation.test.ts
│   │   ├── formatFileSize.test.ts
│   │   └── exportCsv.test.ts
│   ├── integration/
│   │   ├── UploadDropzone.test.tsx
│   │   └── DocumentList.test.tsx
│   └── e2e/
│       └── data-sources-screen.spec.ts
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── Dockerfile
```

**Structure Decision**: Web application structure with only the `frontend/`
project created in this feature (Option 2 from the template, backend half
omitted). `backend/` is intentionally not scaffolded here because this
feature has no server calls (FR-009); it will be introduced by the feature
that adds real ingestion/persistence, at which point `docker-compose.yml`
will wire `frontend/` + `backend/` + Qdrant together per constitution
Principle IV.

## Complexity Tracking

> Deferral recorded per Constitution Principle IV (Fixed Technology Stack),
> which requires Docker deployment of "the application and its dependencies."

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Full `docker-compose` (frontend+backend+Qdrant) not created in this feature | This feature has no backend or Qdrant integration yet (explicitly out of scope per spec.md Assumptions) | Standing up empty `backend/` and Qdrant containers with nothing for them to do would violate Principle III (YAGNI) for no current benefit; a frontend-only `Dockerfile` is included now so the screen itself stays containerizable, and full compose wiring is added when backend/Qdrant land |
