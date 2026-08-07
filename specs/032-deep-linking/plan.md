# Implementation Plan: Deep Linking & Shareable URLs

**Branch**: `032-deep-linking` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-deep-linking/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Introduce real, navigable browser URLs for every screen in the app (currently pure in-memory
React state — `AuthenticatedApp` in `frontend/src/app/App.tsx` holds `activeScreen` and never
touches the address bar) and layer entity-level deep linking for one specific record type —
Golden Dataset entries — on top of it. A client-side router owns the URL ⇄ app-state
synchronization (screen + active corpus [+ entry]) in both directions: navigating updates the
URL, and loading/reloading/pasting a URL restores the corresponding screen/corpus/entry. No new
backend endpoints are required — `GET /api/corpora/{id}` and `GET /api/golden-dataset/entries/{id}`
already exist and are already owner-scoped (404 if the signed-in user doesn't own the resource),
which is exactly the "not found / no access" behavior FR-009 asks for.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (frontend only — no backend changes required)

**Primary Dependencies**: React 19, Vite; adds a client-side routing library (decision in
research.md) to `frontend/package.json`. No new backend dependencies.

**Storage**: N/A for this feature — reuses existing PostgreSQL-backed `corpora` and
`golden_dataset_entries` tables/endpoints unchanged; active-corpus persistence moves from
`localStorage`-only (`CorpusContext`'s `ACTIVE_CORPUS_STORAGE_KEY`) to the URL being the source of
truth, with `localStorage` retained only as a fallback for corpus-less entry screens.

**Testing**: Vitest (unit/integration) + Playwright (e2e), matching every prior feature in this
repo (see `frontend/tests/{unit,integration,e2e}`).

**Target Platform**: Web (existing Vite-built React SPA, unchanged deployment)

**Project Type**: Web application (existing `frontend/` + `backend/` split; this feature is
frontend-only)

**Performance Goals**: URL updates and route restoration are synchronous client-side operations;
no network round-trip is on the critical path beyond the data each target screen already fetches
today.

**Constraints**: MUST NOT change any existing screen's user-visible behavior beyond navigation/URL
mechanics (FR-011); MUST NOT put session tokens or credentials in the URL (FR-010); MUST reuse the
existing auth gate (`AuthContext`/`LoginScreen`/`SignupScreen`) unchanged for the "not signed in"
redirect case (FR-008).

**Scale/Scope**: 9 existing screens get screen-level routes (FR-001); 1 entity type (Golden
Dataset entry) gets entity-level routes (FR-006/FR-007) in this phase.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — N/A. This feature touches navigation/UI shell only; no
  ingestion/chunking/embedding/retrieval/generation stage is modified. Pass.
- **II. Test-First, Test at Every Level** — Plan requires unit tests (router/URL-parsing logic,
  route-restoration hooks), integration tests (screen-level navigation reflected in URL,
  Golden Dataset entry deep link opening the right entry), and e2e tests (copy-URL-and-reopen,
  unauthenticated deep link → sign-in → land on target, invalid/deleted-entry link →
  not-found state) before/alongside implementation, per the existing task-breakdown pattern in
  this repo. Pass (to be enforced in `/speckit-tasks`).
- **III. Multi-User Simplicity (Right-Sized Complexity)** — This feature does not introduce
  cross-account sharing, roles, or admin oversight. `GET /api/corpora/{id}` and
  `GET /api/golden-dataset/entries/{id}` are already strictly owner-scoped
  (`get_corpus_owned_by` / `get_golden_dataset_entry_owned_by`, 404 otherwise) — a link shared
  with a teammate on a *different* account hits the same "not found / no access" 404 today as any
  other cross-account access attempt would, satisfying FR-009 without any new authorization logic.
  If/when corpus sharing or RBAC ships as a separate, deliberately-scoped feature, these same
  links start resolving for additional users automatically, with no change needed here. Pass.
- **IV. Fixed Technology Stack** — Frontend remains React; adding a client-side routing library
  (research.md) is a library choice within the existing frontend framework, not a change to the
  fixed stack (React/Python/Qdrant/PostgreSQL/Docker) itself, so it does not require a
  constitution amendment. No backend, database, vector store, or containerization change. Pass.
- **V. Experiment Observability & Reproducibility** — N/A. No experiment-run configuration or
  RAG-result traceability is affected. Pass.

No violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/032-deep-linking/
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
│   │   └── App.tsx                 # AuthenticatedApp's activeScreen state replaced by router state
│   ├── router/                     # NEW — route definitions, URL⇄screen/corpus/entry mapping,
│   │   │                             hooks (e.g. useAppNavigate/useAppRoute) used in place of the
│   │   │                             current onNavigate(ScreenId) prop drilling
│   │   └── ...
│   ├── components/
│   │   ├── layout/SidebarNav.tsx   # ScreenId stays the vocabulary; nav links become router links
│   │   └── golden-dataset/
│   │       ├── GoldenDatasetScreen.tsx  # reads an optional entryId from the route
│   │       └── GoldenEntryList.tsx      # auto-expands + scrolls to entryId on mount; exposes
│   │                                      "copy link" action per entry (FR-006)
│   └── context/CorpusContext.tsx   # activeCorpusId becomes URL-driven; localStorage kept only as
│                                      a same-tab fallback (research.md)
└── tests/
    ├── unit/            # router/URL-parsing unit tests
    ├── integration/      # screen navigation ⇄ URL, entry deep-link opens correct entry
    └── e2e/               # copy-URL-and-reopen, unauth deep link → sign-in → target,
                             invalid/deleted-entry link → not-found state

backend/                  # UNCHANGED — GET /api/corpora/{id} and
                           # GET /api/golden-dataset/entries/{id} already exist and are already
                           # owner-scoped; no new endpoints, models, or migrations needed.
```

**Structure Decision**: Frontend-only change within the existing `frontend/` app (Web application
structure already in place, `frontend/` + `backend/`). A new `frontend/src/router/` module owns
URL⇄state synchronization; existing screen components are updated to read their target (corpus,
and for Golden Dataset, an optional entry) from the router instead of only from
`CorpusContext`/local component state, and `AppShell`/`SidebarNav`'s navigation calls go through
the router instead of directly calling `setActiveScreen`. `backend/` is untouched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A — no Constitution Check violations.
