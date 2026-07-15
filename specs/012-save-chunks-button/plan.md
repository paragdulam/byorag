# Implementation Plan: Explicit Save Chunks to Database

**Branch**: `012-save-chunks-button` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-save-chunks-button/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

"Re-Calculate Chunks" currently persists chunks to Postgres as a side effect of every preview run
(`stream_chunking` → `_persist_chunks` in `backend/app/chunking/service.py`). This feature splits
that into two explicit actions: (1) "Re-Calculate Chunks" becomes a pure preview — it computes and
streams chunks for display only, with no database writes; (2) a new "Save Chunks" button calls a
new, non-streaming save endpoint that recomputes the same chunking result server-side (chunking is
deterministic for a given document/strategy/chunkSize/overlap) and persists it, fully replacing any
prior saved set for that document. The frontend tracks whether the currently displayed preview
matches what is saved, so the user always knows if they're looking at unsaved data, and "Move to
Embeddings" now requires a save (not just a preview) to be enabled.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript with React 19 (frontend)

**Primary Dependencies**: FastAPI + SQLAlchemy + pypdf (backend, unchanged); React + Vite +
browser `EventSource` (frontend, unchanged) — no new dependency is introduced by this feature.

**Storage**: PostgreSQL — the existing `chunks` table (`backend/app/db/models.py::Chunk`) already
stores `document_id`, `index`, `content`, `strategy`, `chunk_size`, `overlap`. No schema/migration
change is required; only *when* rows are written changes.

**Testing**: pytest (backend contract/integration/unit — `backend/tests/`), Vitest + React Testing
Library (frontend unit/component — `frontend/tests/unit/`), Playwright (frontend e2e —
`frontend/tests/e2e/`).

**Target Platform**: Web application served via Docker Compose (frontend, backend, Postgres, Qdrant
containers), per the fixed stack in the constitution.

**Project Type**: Web application (existing `backend/` + `frontend/` split).

**Performance Goals**: No new performance targets; save is a single synchronous request scoped to
one document, consistent with the existing single-local-user scope.

**Constraints**: Chunking must remain deterministic for identical (document, strategy, chunkSize,
overlap) inputs so the frontend can treat "preview parameters == last-saved parameters" as proof
that a save would persist exactly what's on screen, without re-transmitting chunk content to prove
it. Save must not trust client-supplied chunk content — it recomputes from the document's own text.

**Scale/Scope**: Single-user, single-document-at-a-time screen; existing 200-chunk display/persist
cap (`MAX_CHUNKS` in `backend/app/chunking/service.py`) is unchanged and continues to apply to what
gets saved.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. The save endpoint reuses the existing `STRATEGIES`
  registry (`app.chunking.strategies.base.STRATEGIES`) exactly as the preview endpoint does — no
  new hardcoded branching per strategy is introduced. Chunking technique stays a first-class
  persisted field (`strategy` column), unchanged.
- **II. Test-First, Test at Every Level**: PASS (must remain true through tasks/implementation).
  Plan requires: a backend contract test for the new save endpoint (success, replace-on-resave,
  extraction-failed, 404/400 validation), a backend unit test proving `stream_chunking` no longer
  writes to the DB, a backend unit/integration test proving `save_chunks` persists and replaces,
  and frontend unit tests for the saved/unsaved indicator and the "Move to Embeddings" gate.
- **III. Single-User Simplicity**: PASS. No auth, multi-tenant, or concurrency-control framework is
  added; the "no duplicate rows on double-save" requirement (FR-009) is satisfied by the existing
  delete-then-insert-in-one-transaction pattern plus disabling the Save button while a save is
  in-flight — no new locking/queueing infrastructure.
- **IV. Fixed Technology Stack**: PASS. Uses the existing FastAPI/SQLAlchemy/PostgreSQL/React stack
  as-is; no new stack element.
- **V. Experiment Observability & Reproducibility**: PASS (strengthened). Persisted chunks remain
  traceable to the exact strategy/chunkSize/overlap that produced them (unchanged columns); the new
  saved/unsaved UI indicator makes reproducibility *visible* to the user, closing a gap where a
  displayed preview could previously have silently diverged from what's persisted.

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-save-chunks-button/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── chunking-save-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── chunking/
│   │   ├── router.py       # add POST /api/chunking/save; existing GET /run/stream loses its persist step
│   │   ├── schemas.py      # add ChunkSaveRequest (documentId, chunkSize, overlap)
│   │   └── service.py      # stream_chunking() stops calling _persist_chunks(); new save_chunks()
│   └── db/
│       └── models.py       # unchanged — Chunk already has strategy/chunk_size/overlap columns
└── tests/
    ├── contract/
    │   └── test_chunking_save.py       # new
    ├── unit/
    │   └── test_chunking_service.py    # extended: preview no longer persists; save_chunks persists+replaces
    └── integration/                    # existing chunk-persistence-adjacent tests reviewed/updated if needed

frontend/
├── src/
│   ├── lib/
│   │   └── chunkingApi.ts              # add saveChunks(documentId, chunkSize, overlap)
│   ├── hooks/
│   │   └── useFixedSizeChunking.ts     # add save(), saveStatus, isSaved derived state
│   ├── components/chunking/
│   │   └── FixedSizeChunkingScreen.tsx # replace auto-persist assumption; add "Save Chunks" button; saved/unsaved indicator; gate "Move to Embeddings" on save
│   └── types/
│       └── chunking.ts                 # add ChunkSaveResponse-related types if needed
└── tests/
    ├── unit/
    │   ├── useFixedSizeChunking.test.ts        # extended
    │   └── FixedSizeChunkingScreen.test.tsx    # extended
    └── e2e/
        └── fixed-size-chunking.spec.ts         # extended: recalculate doesn't persist, save does, gate on save
```

**Structure Decision**: Existing `backend/` (FastAPI) + `frontend/` (React/Vite) web application
split is reused as-is (Option 2 from the template). This feature only touches the existing
`chunking` vertical slice on both sides — no new top-level module or service is introduced.

## Complexity Tracking

*No violations — table omitted.*
