# Implementation Plan: Dedicated Corpora Screen with App-Wide Scoping

**Branch**: `009-corpora-screen` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-corpora-screen/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Give "Corpora" its own clickable nav entry (above "Sources") that opens a dedicated screen for full corpus CRUD — create, list, select-as-active, manage a corpus's documents (attach an existing document / remove one), and delete (blocked while non-empty, reusing the existing rule from `008-corpora-management`). The sidebar's existing quick-switcher list stays for one-click switching from anywhere. Selecting a corpus (from either place) remains the single app-wide active corpus that Sources and Chunking — the only two sections with real content today — are already scoped to. The only new backend surface is a small, read-only "list all documents across every corpus" endpoint, needed so the new screen can offer a picker of existing documents to attach to a corpus (the existing `sources` API is corpus-scoped by design and has nothing to browse *across* corpora with).

## Technical Context

**Language/Version**: Python 3.12 (backend, unchanged), TypeScript 6 / React 19 (frontend, unchanged)

**Primary Dependencies**: None new. Reuses the existing FastAPI `corpora`/`sources` routers and services, and the existing `CorpusContext` / `corporaApi.ts` / `sourcesApi.ts` frontend modules from `008-corpora-management`.

**Storage**: PostgreSQL (unchanged, no schema changes) — the new endpoint is a read-only query over the existing `documents`/`document_corpora` tables.

**Testing**: pytest + httpx (backend, existing), Vitest + Testing Library + Playwright (frontend, existing)

**Target Platform**: Existing Dockerized local web app (unchanged)

**Project Type**: web (frontend + backend, existing structure)

**Performance Goals**: SC-001 (create first corpus from the new screen in <15s), SC-002 (cross-section reflect in <2s, no reload), SC-003 (add/remove a document from a corpus in ≤2 clicks from the screen)

**Constraints**: Single local user, no auth (Constitution III, unchanged); small/personal scale carried over from `008-corpora-management` — the new "list all documents" endpoint returns every document unpaginated, consistent with that existing scale assumption

**Scale/Scope**: Tens of corpora; up to a few hundred documents total — unchanged from `008-corpora-management`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — PASS. No chunking/embedding/retrieval logic is touched.
- **II. Test-First, Test at Every Level** — PASS (enforced in `/speckit-tasks`). Unit tests for the new document-listing service function, contract tests for the new endpoint, integration tests for the Corpora screen's CRUD + cross-section scoping flow, and e2e tests for the full screen are required before those tasks are considered done.
- **III. Single-User Simplicity (YAGNI)** — PASS. No new server-side session/state concept is introduced — "active corpus" remains the single client-side value from `008-corpora-management`'s `CorpusContext`; this feature adds a screen and one read endpoint, nothing more.
- **IV. Fixed Technology Stack** — PASS, no deviation. No new stack component is introduced (unlike `008-corpora-management`, which added PostgreSQL itself and was already ratified into the constitution).
- **V. Experiment Observability & Reproducibility** — PASS, unaffected. No chunking/embedding config or traceability behavior changes.

No Complexity Tracking entries required — this feature introduces no constitution deviations.

## Project Structure

### Documentation (this feature)

```text
specs/009-corpora-screen/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── list-all-documents-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── sources/
│   │   ├── router.py               # UPDATED — add GET /api/sources/all
│   │   ├── schemas.py              # UPDATED — add AllSourceDocument (adds corpusIds), ListAllSourcesResponse
│   │   └── service.py              # UPDATED — add list_all_documents(db)
│   ├── corpora/                    # UNCHANGED — existing CRUD (008-corpora-management) reused as-is
│   └── db/                         # UNCHANGED — no schema changes
└── tests/
    ├── contract/
    │   └── test_list_all_sources.py         # NEW
    ├── integration/
    │   └── test_corpora_screen_flow.py      # NEW
    └── unit/
        └── test_service_list_all.py         # NEW

frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── SidebarNav.tsx        # UPDATED — "Corpora" becomes a clickable nav item (above Sources); existing quick-switcher list (CorporaSection) unchanged
│   │   └── corpora/                  # NEW
│   │       └── CorporaScreen.tsx     # NEW — list + create + select-active + per-corpus document management + delete
│   ├── lib/
│   │   ├── corporaApi.ts             # UNCHANGED — list/create/rename/delete already exist (008-corpora-management)
│   │   └── sourcesApi.ts             # UPDATED — add listAllSources()
│   └── app/
│       └── App.tsx                   # UPDATED — render CorporaScreen for the new 'corpora' ScreenId
└── tests/
    ├── unit/
    │   └── CorporaScreen.test.tsx    # NEW
    ├── integration/
    │   └── CorporaScreen.test.tsx    # NEW (composition + cross-section scoping)
    └── e2e/
        └── corpora-screen.spec.ts    # NEW
```

**Structure Decision**: Continue the existing `backend/app/<feature>/{router,schemas,service}.py` and `frontend/src/components/<feature>/` conventions. The new screen lives alongside `sources`/`chunking` as `components/corpora/`, and the one new backend capability (list-all-documents) is added to the existing `sources` module rather than a new one, since it's a read view over the same `Document` data `sources` already owns — introducing a fourth backend module for a single read endpoint would be unwarranted.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — no constitution violations in this feature.
