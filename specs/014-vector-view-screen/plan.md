# Implementation Plan: Vector View Screen

**Branch**: `014-vector-view-screen` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-vector-view-screen/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Adds a "Move to Vector View" action to the Embeddings screen's bottom bar (gated on a
successful save this session, mirroring `012`'s chunk-save gate) and a new Vector View screen:
a saved-chunks list on the left, and on the right the actual persisted vector values for the
selected chunk's chosen saved embedding, rendered as a grid — read directly from the `embeddings`
table, never recomputed. When a chunk has multiple saved embeddings, a secondary picker lets the
user choose which one to view (per the resolved clarification). Above the grid, a small
server-driven "projection method" registry (mirroring `013`'s embedding-model registry) offers
"Vector" (functional) plus placeholder entries for future dimensionality-reduction techniques
(UMAP, PCA — explicitly not implemented now). Vector View's own bottom bar adds "Move to
Playground", which — along with the sidebar's existing but inert "Vector View"/"Playground"
labels — is wired to a new, minimal Playground placeholder screen.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript with React 19 (frontend) — unchanged.

**Primary Dependencies**: FastAPI + SQLAlchemy + `pgvector` (backend, unchanged — no new
dependency). React + Vite (frontend, unchanged).

**Storage**: PostgreSQL — reads only from the existing `embeddings` and `chunks` tables (`013`);
no schema change. A new backend-internal `PROJECTION_METHODS` registry (in-memory, not persisted)
mirrors `013`'s `EMBEDDING_MODELS` registry shape.

**Testing**: pytest (backend contract/unit — `backend/tests/`), Vitest + React Testing Library
(frontend unit/component — `frontend/tests/unit/`), Playwright (frontend e2e —
`frontend/tests/e2e/`) — same tooling as every prior feature.

**Target Platform**: Web application served via Docker Compose (unchanged).

**Project Type**: Web application (existing `backend/` + `frontend/` split); extends the existing
`embeddings` vertical slice on the backend, adds two new screens (`vector-view`, `playground`) on
the frontend.

**Performance Goals**: No hard numeric target (single local user, consistent with every prior
feature). Reading a chunk's saved embeddings is a simple indexed FK lookup (`chunk_id`), not a
full-table scan.

**Constraints**: Vector values displayed MUST be exactly what's persisted (spec SC-002) — no
recomputation, no approximation beyond normal numeric display formatting. The grid/matrix layout
is a presentation-only concern (reshaping a flat 768-value array for readability); it does not
change what's stored or transmitted.

**Scale/Scope**: Same single-user, single-document-at-a-time screen pattern as Chunking/Embeddings.
A chunk's saved-embeddings count is expected to stay small in practice (a handful of experimental
saves per chunk), so the secondary picker needs no pagination.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. The projection-method picker is a registry
  (`PROJECTION_METHODS`, keyed by id, each entry carrying an `available` flag) exposed via
  `GET /api/embeddings/projection-methods`, mirroring `013`'s `EMBEDDING_MODELS` registry pattern
  exactly — adding UMAP/PCA later means registering new entries and implementing their
  `available: true` logic, not redesigning the picker (spec FR-009–FR-011).
- **II. Test-First, Test at Every Level**: PASS (must remain true through tasks/implementation).
  Plan requires: contract tests for the two new read endpoints (saved embeddings for a chunk,
  projection methods list), unit tests for the chunk-lookup/not-found and multi-embedding-ordering
  behavior, and frontend unit/component tests for the new hook and both new screens, plus an e2e
  walkthrough extending the existing Embeddings→(new screen) chain.
- **III. Single-User Simplicity**: PASS. No new auth/pagination/job infrastructure; the Playground
  screen is intentionally a minimal placeholder (its own functionality is explicitly out of scope
  per spec Assumptions), avoiding speculative build-out of a screen nothing yet needs.
- **IV. Fixed Technology Stack**: PASS. No new stack element. (The `013` Complexity Tracking entry
  for pgvector-vs-Qdrant already covers vector storage generally and still applies unchanged; this
  feature only reads from that existing storage, it doesn't add a new deviation.)
- **V. Experiment Observability & Reproducibility**: PASS (strengthened). This feature is, in
  effect, the first concrete payoff of `013`'s accumulate-not-replace design — letting a user
  actually see and distinguish between multiple saved embedding runs for the same chunk, which is
  exactly what that principle exists to enable.

No violations. Complexity Tracking is not needed for this feature (the standing `013` entry is
unaffected and not repeated here).

**Post-Phase 1 re-check**: Design artifacts (`data-model.md`, `contracts/vector-view-api.md`,
`quickstart.md`) introduce nothing beyond what this gate already covers — two new read-only
endpoints reusing existing tables, one new in-memory registry, two new frontend screens following
established patterns. Conclusion unchanged: PASS on all five principles.

## Project Structure

### Documentation (this feature)

```text
specs/014-vector-view-screen/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── vector-view-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── db/
│   │   └── lookups.py        # add get_chunk_or_none(db, chunk_id)
│   └── embeddings/
│       ├── schemas.py        # add SavedEmbeddingOut, ListSavedEmbeddingsResponse,
│       │                     # ProjectionMethodOption, ListProjectionMethodsResponse
│       ├── service.py        # add list_saved_embeddings(db, chunk_id) -> list[EmbeddingRow]
│       ├── router.py         # add GET /saved?chunkId=, GET /projection-methods
│       └── projection_methods.py   # new: PROJECTION_METHODS registry (mirrors models/base.py)
└── tests/
    ├── contract/
    │   ├── test_embeddings_saved.py             # new
    │   └── test_embeddings_projection_methods.py # new
    └── unit/
        └── test_embeddings_service.py            # extended (list_saved_embeddings cases)

frontend/
├── src/
│   ├── lib/
│   │   └── embeddingsApi.ts          # add listSavedEmbeddings(chunkId), listProjectionMethods()
│   ├── hooks/
│   │   ├── useChunkEmbeddings.ts     # add hasSavedOnce (one-way latch on successful save)
│   │   └── useVectorView.ts          # new: chunks + saved embeddings + projection methods
│   ├── components/
│   │   ├── embeddings/
│   │   │   └── EmbeddingsScreen.tsx  # add "Move to Vector View" button next to "Save"
│   │   ├── vector-view/
│   │   │   └── VectorViewScreen.tsx  # new
│   │   └── playground/
│   │       └── PlaygroundScreen.tsx  # new, minimal placeholder
│   ├── components/layout/
│   │   └── SidebarNav.tsx            # wire 'vector-view'/'playground' screen ids to existing labels
│   ├── app/
│   │   └── App.tsx                   # route the two new screens
│   └── types/
│       └── embeddings.ts             # add SavedEmbedding, ProjectionMethodOption
└── tests/
    ├── unit/
    │   ├── useChunkEmbeddings.test.ts     # extended (hasSavedOnce)
    │   ├── useVectorView.test.ts          # new
    │   ├── EmbeddingsScreen.test.tsx      # extended ("Move to Vector View" button)
    │   ├── VectorViewScreen.test.tsx      # new
    │   └── PlaygroundScreen.test.tsx      # new
    └── e2e/
        └── embeddings.spec.ts             # extended: ...-> Vector View -> select chunk -> Playground
```

**Structure Decision**: Reuses the existing `backend/` (FastAPI) + `frontend/` (React/Vite) split.
The backend addition is purely two new read endpoints on the already-existing `embeddings` slice
(no new module). The frontend adds two new screen directories (`vector-view/`, `playground/`),
mirroring the existing `embeddings/` and `chunking/` screen directories' shape.

## Complexity Tracking

*No new violations — table omitted. See `013-bert-pgvector-embeddings/plan.md` for the still-
standing, unrelated pgvector-vs-Qdrant entry, which this feature does not touch or extend.*
