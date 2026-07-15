# Implementation Plan: Move Corpus Row Actions to the Corpora Screen

**Branch**: `011-move-corpus-row-actions` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-move-corpus-row-actions/spec.md`

## Summary

`010-corpora-dropdown-nav` placed per-row "Make Active" and "Delete" buttons in the sidebar's
corpora dropdown. That was the wrong location. This feature moves those two actions onto each row
of the dedicated Corpora screen's "All Corpora" list (reached via the "Corpora" nav item), removes
the now-redundant standalone "Delete this corpus" control from that screen's documents panel, and
strips the "Make Active"/"Delete" buttons back out of the sidebar dropdown — which reverts to a
simple, compact, click-to-select list (its `010` open/close mechanics are otherwise unchanged).
Purely a frontend presentation change: no API, schema, or `CorpusContext` changes.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (frontend-only change; no backend touched)

**Primary Dependencies**: Existing React app, Tailwind CSS. No new dependencies.

**Storage**: N/A — reuses the existing `/api/corpora` endpoints and `CorpusContext` methods
(`selectCorpus`, `deleteCorpus`) unchanged.

**Testing**: Vitest + Testing Library (unit, integration), Playwright (e2e)

**Target Platform**: Web (existing `frontend/` app)

**Project Type**: Web application (frontend + backend monorepo) — this feature touches `frontend/`
only

**Performance Goals**: Matches existing corpora-switching behavior — active-corpus changes reflect
app-wide within 2 seconds, no page reload (carried over from `010-corpora-dropdown-nav` SC-005).

**Constraints**: No new UI/dropdown library (Constitution IV, YAGNI precedent already established
in `008`/`009`/`010`); MUST NOT change the `/api/corpora` contract or `CorpusContext`'s public
interface — only where and how its existing methods are invoked from the UI.

**Scale/Scope**: Same small/personal scale as prior corpora work (tens of corpora, no pagination).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: N/A — this feature touches corpus-management UI, not a RAG
  pipeline stage (ingestion/chunking/embedding/retrieval/generation). No gate impact.
- **II. Test-First, Test at Every Level (NON-NEGOTIABLE)**: PASS (by plan). New tests for the
  relocated actions are written first, and every pre-existing test broken by removing the
  dropdown's buttons or the screen's standalone delete control is treated as a regression fix
  scoped into the story that causes the break — same discipline `010`'s research.md §3 used.
- **III. Single-User Simplicity (YAGNI)**: PASS. No new abstractions: reuses
  `useCorpus().selectCorpus`/`deleteCorpus` exactly as-is at a new call site, same as `010`
  research.md §5's precedent for not re-deriving already-tested rules.
- **IV. Fixed Technology Stack**: PASS. No dependency, framework, or stack changes.
- **V. Experiment Observability & Reproducibility**: N/A — not an experiment-run concern.

No violations. Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/011-move-corpus-row-actions/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature adds no API surface (same as `010-corpora-dropdown-nav`).

### Source Code (repository root)

```text
backend/            # Untouched by this feature

frontend/
├── src/
│   └── components/
│       ├── layout/
│       │   └── SidebarNav.tsx        # CorporaSection: remove Make Active/Delete buttons,
│       │                              # revert rows to simple click-to-select
│       └── corpora/
│           └── CorporaScreen.tsx     # Add per-row Make Active + Delete actions; remove the
│                                      # standalone "Delete this corpus" control
└── tests/
    ├── unit/
    │   ├── SidebarNav.test.tsx           # Remove/rewrite 010 US2/US3 dropdown-button tests
    │   └── CorporaScreen.test.tsx        # Rewrite US4 deletion tests for the per-row control;
    │                                      # add new Make Active per-row tests
    ├── integration/
    │   └── CorporaScreen.test.tsx        # Rewrite the one "Delete this corpus" fallback test
    └── e2e/
        ├── corpora-dropdown.spec.ts      # Drop button-based Make Active/Delete specs; add a
        │                                  # click-to-select spec
        ├── corpora-screen.spec.ts        # Rewrite the US4 delete spec for the per-row control
        └── corpora-management.spec.ts    # Switch dropdown interaction from button-click to
                                           # row-click
```

**Structure Decision**: Existing `frontend/`/`backend/` web-application layout (established in
`001-data-sources-screen` and unchanged since). This feature only edits two existing frontend
components and their existing test files — no new files, directories, or backend changes.

## Complexity Tracking

*No violations — section not needed.*
