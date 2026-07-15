# Implementation Plan: Corpora Dropdown in the Left Navigation

**Branch**: `010-corpora-dropdown-nav` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-corpora-dropdown-nav/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace `SidebarNav`'s always-expanded inline corpora list (`CorporaSection`, from `008-corpora-management`)
with a closed-by-default dropdown labeled with the active corpus's name. Opening it reveals the
full corpora list, each row now showing explicit "Make Active" and "Delete" actions (delete is new
in the sidebar; both actions call `CorpusContext` methods that already exist). No backend or data
model changes — this is a pure frontend restructuring of one component, reusing the existing
`GET/POST/DELETE /api/corpora` contract from `008-corpora-management` unchanged. The most
consequential planning problem is not new code but the breaking-change surface: several existing
e2e/unit tests currently interact with the sidebar's corpus list assuming it's always visible, and
those interactions must be updated to open the dropdown first.

## Technical Context

**Language/Version**: TypeScript 6 / React 19 (frontend, unchanged). No backend changes — no
Python/FastAPI work in this feature.

**Primary Dependencies**: None new. Reuses `CorpusContext` (`selectCorpus`, `createCorpus`,
`deleteCorpus` — all already implemented in `008-corpora-management`/`009-corpora-screen`) and the
existing `corporaApi.ts`. The dropdown itself is built with plain React state and a
document-level click-outside listener, consistent with this project's no-new-UI-library precedent
(`009-corpora-screen` research.md §5).

**Storage**: Unchanged — no schema or API changes.

**Testing**: Vitest + Testing Library (unit/integration), Playwright (e2e) — existing tooling only.

**Target Platform**: Existing Dockerized local web app (unchanged).

**Project Type**: web (frontend + backend, existing structure) — this feature only touches the
frontend.

**Performance Goals**: SC-002 (switch active corpus in ≤2 clicks), SC-003 (delete an empty corpus
in ≤3 clicks), SC-005 (cross-section reflect in <2s, no reload — already satisfied by the unchanged
`CorpusContext` mechanism).

**Constraints**: Single local user, no auth (Constitution III, unchanged). Small/personal scale
carried over (tens of corpora) — the open dropdown's list scrolls rather than paginating.

**Scale/Scope**: One component rewrite (`SidebarNav.tsx`'s `CorporaSection`) plus reconciliation of
every existing test that currently assumes the sidebar's corpora list is always expanded.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — PASS. No chunking/embedding/retrieval logic is touched.
- **II. Test-First, Test at Every Level** — PASS (enforced in `/speckit-tasks`). Unit tests for the
  dropdown's open/close, make-active, and delete-with-confirmation behavior, plus e2e coverage, are
  required before those tasks are considered done — including updating the existing tests this
  change breaks (see Summary).
- **III. Single-User Simplicity (YAGNI)** — PASS. No new state beyond what `CorpusContext` already
  holds; the dropdown's open/closed state is purely local UI state, not persisted or shared.
- **IV. Fixed Technology Stack** — PASS, no deviation. No new dependency (e.g., a menu/dropdown
  library) is introduced.
- **V. Experiment Observability & Reproducibility** — PASS, unaffected.

No Complexity Tracking entries required — this feature introduces no constitution deviations.

## Project Structure

### Documentation (this feature)

```text
specs/010-corpora-dropdown-nav/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command) — no entity changes; documents that explicitly
└── quickstart.md        # Phase 1 output (/speckit-plan command)
```

No `contracts/` directory: this feature exposes no new or changed API surface — it reuses
`008-corpora-management`'s `contracts/corpora-api.md` (`GET/POST/PATCH/DELETE /api/corpora`)
exactly as-is.

### Source Code (repository root)

```text
frontend/
├── src/
│   └── components/
│       └── layout/
│           └── SidebarNav.tsx        # UPDATED — CorporaSection becomes a closed-by-default dropdown
│                                      # with per-row "Make Active"/"Delete" actions; NAV_ITEMS and
│                                      # the "Corpora" nav link (009-corpora-screen) are untouched
└── tests/
    ├── unit/
    │   └── SidebarNav.test.tsx       # UPDATED — rewrite the "Corpora section" describe block for
    │                                  # open/close, make-active, and delete-with-confirmation
    └── e2e/
        ├── corpora-management.spec.ts    # UPDATED — open the dropdown before create/select
        ├── data-sources-screen.spec.ts   # UPDATED — same
        ├── fixed-size-chunking.spec.ts   # UPDATED — same
        └── corpora-dropdown.spec.ts      # NEW — dedicated end-to-end coverage for this feature
```

Not touched: `frontend/src/components/corpora/CorporaScreen.tsx` and its tests
(`009-corpora-screen`'s dedicated screen and its own `data-testid="corpus-row-*"` rows are a
separate component tree, unaffected by this sidebar change — see research.md §2 for how the two
are kept from colliding in tests). Not touched: any backend file.

**Structure Decision**: Single-component change within the existing `frontend/src/components/layout/`
module, no new files for the component itself. Test updates follow the existing per-file
convention; one new e2e spec is added for this feature's own dedicated scenarios rather than
overloading an existing file that predates it.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — no constitution violations in this feature.
