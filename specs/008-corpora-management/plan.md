# Implementation Plan: Corpora Management with Persistent Storage

**Branch**: `008-corpora-management` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-corpora-management/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the app's single implicit document collection with explicit, user-managed **corpora**. Users create/select corpora from a new "Corpora" nav section (above "Sources"), scope the Sources view to the active corpus, and can attach an already-uploaded document to more than one corpus (many-to-many) without duplicating storage or re-running chunking. Documents and their chunks move from ephemeral/flat-file-only state to a local **PostgreSQL** database (corpora, documents, document-corpus links, chunks), with content-hash-based upload dedup, cascade-delete-on-last-unlink, and an idempotent startup migration that folds pre-existing flat-file PDFs into a default "Uncategorized" corpus. Separately, the "Chunking" nav item gains a chevron affordance reflecting its expand/collapse state.

## Technical Context

**Language/Version**: Python 3.12 (backend, existing), TypeScript 6 / React 19 (frontend, existing)

**Primary Dependencies**: FastAPI (existing) + SQLAlchemy 2.x and psycopg (v3) (new, backend) for PostgreSQL access; no new frontend runtime dependencies (chevron is inline SVG, corpus state is a plain React Context)

**Storage**: PostgreSQL (new) for corpora, documents (metadata), document-corpus associations, and chunks; local filesystem (existing `PDFS_DIR`) retained for raw PDF bytes only

**Testing**: pytest + httpx against a real local PostgreSQL test database (backend, existing tooling); Vitest + Testing Library + Playwright (frontend, existing)

**Target Platform**: Dockerized local web app (existing `docker-compose.yml`, extended with a `postgres` service); macOS/Linux dev environment

**Project Type**: web (frontend + backend, existing structure — Option 2)

**Performance Goals**: SC-001/SC-002 — corpus creation reflected in the nav in <5s; switching the active corpus updates the scoped Sources list in <2s (small/personal scale; no special-cased perf work needed)

**Constraints**: Single local user, no auth (Constitution Principle III); small/personal scale per clarification — tens of corpora, up to a few hundred documents per corpus, simple full lists (no pagination/search required)

**Scale/Scope**: Tens of corpora; up to a few hundred documents per corpus

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — PASS. This feature does not touch chunking/embedding strategy selection or add branching logic there; it only persists the *output* of the existing pluggable chunking strategy (already `Literal["fixed-size"]`-typed and swappable) alongside the config that produced it.
- **II. Test-First, Test at Every Level** — PASS (enforced in `/speckit-tasks`). Unit tests for corpus/document/chunk services, integration tests for the DB-backed upload→dedupe→attach→unlink→cascade-delete flow and the startup migration, and e2e tests for the Corpora nav section and chevron behavior are required before those tasks are considered done.
- **III. Single-User Simplicity (YAGNI)** — PASS. Multiple corpora are a single user's own organizational feature, not multi-tenancy; no auth, roles, or per-user server-side session state is introduced. The "active corpus" is kept as client-only state (see `research.md` §7) rather than a new server-side concept, to avoid unnecessary session/user-preference storage.
- **IV. Fixed Technology Stack** — **DEVIATION, justified below.** The constitution's Technology Stack section does not currently list a relational database (`Source Storage` is filesystem-only). This feature adds PostgreSQL, explicitly requested by the user in the feature description, to represent many-to-many document↔corpus relationships and persisted one-to-many document↔chunk records with real referential integrity. See Complexity Tracking. **Recommendation**: run `/speckit-constitution` after this plan to formally add PostgreSQL to the Technology Stack & Environment section (MINOR version bump), since this is a durable, not one-off, addition.
- **V. Experiment Observability & Reproducibility** — PASS / IMPROVES. Persisting chunks together with the strategy name, `chunkSize`, and `overlap` that produced them (already present in `ChunkingResult`) makes chunking runs traceable after the fact, which today's ephemeral (stream-only, never stored) chunks do not support.

## Project Structure

### Documentation (this feature)

```text
specs/008-corpora-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── corpora-api.md
│   └── sources-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── db/                        # NEW — SQLAlchemy engine/session + ORM models
│   │   ├── __init__.py
│   │   ├── base.py                 # engine, SessionLocal, get_db() dependency, create_all() + startup migration entrypoint
│   │   └── models.py               # Corpus, Document, DocumentCorpus, Chunk ORM classes
│   ├── corpora/                    # NEW — corpus CRUD + selection
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── schemas.py
│   │   └── service.py
│   ├── sources/                    # EXISTING — becomes DB- and corpus-scoped
│   │   ├── router.py               # add corpusId query/form param, attach/unlink endpoints
│   │   ├── schemas.py              # add corpusId, contentHash fields
│   │   └── service.py              # replace filesystem-only listing with DB-backed + dedup logic
│   ├── chunking/                   # EXISTING — persist chunk results
│   │   ├── router.py               # unchanged surface; service now persists on terminal "result" event
│   │   ├── service.py
│   │   └── schemas.py
│   ├── config.py                   # add DATABASE_URL setting
│   └── main.py                     # register corpora router, run startup migration (research.md §2)
└── tests/
    ├── contract/
    ├── integration/                 # NEW: db-backed corpus/document/chunk flow tests
    └── unit/

frontend/
├── src/
│   ├── context/
│   │   └── CorpusContext.tsx        # NEW — corpora list, activeCorpusId, create/select/rename/delete
│   ├── lib/
│   │   └── corporaApi.ts            # NEW — fetch wrapper for /api/corpora
│   ├── components/
│   │   ├── layout/
│   │   │   └── SidebarNav.tsx        # UPDATED — Corpora section above Sources, chevron on expandable items
│   │   └── sources/
│   │       └── DataSourcesScreen.tsx # UPDATED — scoped to context's activeCorpusId
│   └── app/
│       └── App.tsx                   # UPDATED — wraps tree in CorpusProvider
└── tests/
    ├── unit/
    └── e2e/
```

**Structure Decision**: Continue the existing `backend/` (FastAPI, module-per-feature: `router.py` / `schemas.py` / `service.py`) + `frontend/` (React, `components/` by feature area) web-application layout. Add a new `backend/app/db/` package as the single place SQLAlchemy is configured and ORM models live, and a new `backend/app/corpora/` feature module mirroring the existing `sources`/`chunking` module shape. On the frontend, add a `CorpusContext` consumed by `SidebarNav` and `DataSourcesScreen`, avoiding a new routing layer (the app already switches "screens" via local `useState`, unchanged by this feature).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Introduces PostgreSQL, not listed in the constitution's current Technology Stack & Environment section (Principle IV) | The feature's core requirement (spec FR-006, FR-010, FR-011) is a many-to-many document↔corpus relationship plus persisted one-to-many document↔chunk records with dedup and cascade-delete-on-last-unlink integrity guarantees. This was explicitly requested by the user ("setup a postgreSQL db locally"), not an ad-hoc implementation choice. | Encoding relational many-to-many links, uniqueness (content-hash dedup, corpus name), and cascade-delete transactions in flat files/JSON-on-disk would mean hand-rolling the referential-integrity and transactional guarantees a relational database already provides, with materially higher risk of silent data corruption for a feature whose entire value is correct relational bookkeeping. Follow-up: ratify via `/speckit-constitution` (MINOR bump) since this is a durable stack addition, not a one-off. |
