# Implementation Plan: Fix Saved Chunks Not Showing on Auto-Selected Document

**Branch**: `015-fix-saved-chunks-not-showing` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-fix-saved-chunks-not-showing/spec.md`

## Summary

The Embeddings and Vector View screens each hold two pieces of selection state: a raw
`selectedDocumentId`/`selectedChunkId` (`useState`, set only by explicit `onChange`) and a
derived, always-correct `activeDocumentId`/`activeChunkId` used purely for display
(`selectedXId || list[0]?.id || ''`). Their data-loading hooks (`useChunkEmbeddings`,
`useVectorView`) are called with the raw, un-defaulted state, not the derived display value —
so with nothing to manually re-select (the single-document/single-chunk case reported by the
user), the raw state never becomes non-empty and the reactive `useEffect` inside each hook
never fires its fetch, even though the UI shows a document/chunk as selected.

The fix adds one small `useEffect` per selection level, in each screen component, that keeps
the raw selection state itself synced to a valid value once its source list loads (auto-select
first item if nothing selected, or if the previously-selected id no longer belongs to the
current list — e.g. after switching corpus). This makes the state passed into the hooks always
correct, without changing the hooks' public API/signature, and without needing a second render
pass to "discover" a value that depends on the hook's own output.

## Technical Context

**Language/Version**: TypeScript 5 (React 18, Vite) — frontend only; no backend/API changes

**Primary Dependencies**: React (`useState`, `useEffect`); existing `useChunkEmbeddings` and
`useVectorView` hooks (unchanged); `CorpusContext`

**Storage**: N/A — no persisted data or schema changes; existing PostgreSQL-backed chunk/embedding
storage is unaffected (confirmed correct via direct DB/API inspection during specification)

**Testing**: Vitest + React Testing Library (component tests for the two screens), Playwright
(existing `embeddings.spec.ts` e2e flow, extended to cover the single-document no-manual-click
case)

**Target Platform**: Web (existing byorag frontend)

**Project Type**: Web application (existing `frontend/` + `backend/` split) — this feature only
touches `frontend/`

**Performance Goals**: N/A — no performance-sensitive logic introduced (one extra effect per
screen, gated on small in-memory lists)

**Constraints**: Must not change `useChunkEmbeddings`/`useVectorView` public signatures or
existing passing tests for those hooks (minimize blast radius for a bug fix); manual
document/chunk selection must continue to behave exactly as before (FR-005)

**Scale/Scope**: 2 screen components (`EmbeddingsScreen.tsx`, `VectorViewScreen.tsx`) and their
existing component/e2e tests; no other screens are in scope (confirmed via codebase search that
no other screen has this "reactive hook fed by un-defaulted local state" pattern)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: Not implicated — no chunking/embedding/retrieval strategy
  code is touched, only UI selection-state wiring. PASS.
- **II. Test-First, Test at Every Level (NON-NEGOTIABLE)**: New component tests will be added
  for both screens proving saved chunks/embeddings appear without manual interaction
  (single-item case) and that manual selection still works, written before the fix per this
  feature's task breakdown. The existing e2e flow will be extended to assert on the
  no-manual-click path. PASS (to be satisfied in tasks/implementation).
- **III. Single-User Simplicity (YAGNI)**: Fix is the smallest change that resolves the defect —
  one small effect per selection level, no new abstraction, no hook API changes. PASS.
- **IV. Fixed Technology Stack**: No stack changes. PASS.
- **V. Experiment Observability & Reproducibility**: Not implicated — this is a display-layer
  fix; underlying saved chunks/embeddings and their traceability are already correct and
  unchanged. PASS.

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/015-fix-saved-chunks-not-showing/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — no entity changes
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory — this fix makes no API/contract changes (see research.md).

### Source Code (repository root)

```text
backend/
└── (untouched by this feature)

frontend/
├── src/
│   ├── components/
│   │   ├── embeddings/
│   │   │   └── EmbeddingsScreen.tsx      # add auto-select effect for selectedDocumentId
│   │   └── vector-view/
│   │       └── VectorViewScreen.tsx      # add auto-select effects for selectedDocumentId
│   │                                     # and selectedChunkId
│   └── hooks/
│       ├── useChunkEmbeddings.ts         # unchanged — reactive contract already correct
│       └── useVectorView.ts              # unchanged — reactive contract already correct
└── tests/
    ├── components/                       # new/updated tests for both screens
    └── e2e/
        └── embeddings.spec.ts            # extended to cover the no-manual-click path
```

**Structure Decision**: Existing `frontend/` + `backend/` web-application layout (unchanged from
prior features). This is a frontend-only bug fix; no backend files are touched.

## Complexity Tracking

*No violations — this section is not applicable.*
