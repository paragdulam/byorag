# Implementation Plan: Sources, Chunking & Embeddings UX Refresh

**Branch**: `021-sources-chunking-embeddings-refresh` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-sources-chunking-embeddings-refresh/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Four coordinated UX fixes/additions: (1) the Fixed Size Chunking screen must auto-load previously
saved chunks on open instead of requiring a manual re-chunk (frontend-only fix, reusing the
existing `GET /api/chunking/saved-chunks` endpoint); (2) the Sources screen becomes a two-pane
layout (upload + document list on the left, a new PDF preview pane on the right), backed by a new
`GET /api/sources/{document_id}/file` byte-serving endpoint and the `react-pdf` viewer library; (3)
a "Chunked Preview" toggle on that pane renders the document's saved chunks as a sequence of
markdown blocks, each with a randomly-assigned background color from a curated pastel palette
(fixed dark text, no two consecutive chunks share a color); (4) the existing but inert UMAP/PCA
entries in the embedding "Projection Method" dropdown become functional, computed server-side
(`scikit-learn` PCA, `umap-learn` UMAP) via a new `POST /api/embeddings/project` endpoint and
rendered as a 2D `recharts` scatter plot, for either a single document's or an entire corpus's
(~50-document lab scale) embedded chunks, with a 5-embedded-chunk minimum before the method becomes
selectable.

## Technical Context

**Language/Version**: Python 3.12 (backend, `uv`-managed), TypeScript ~6.0.2 (frontend)

**Primary Dependencies**: Backend — FastAPI >=0.115, SQLAlchemy 2.0, psycopg[binary] 3.2, pgvector
0.3, pypdf 5.0; **new**: `scikit-learn` (PCA) and `umap-learn` (UMAP), per research.md §6. Frontend
— React 19.2.7, Vite 8.1.1, Tailwind 4.3.2, `react-markdown` 10.1.0 (already present); **new**:
`react-pdf` (PDF viewer, research.md §1) and `recharts` (2D scatter plot, research.md §7).

**Storage**: PostgreSQL (existing `pgvector`-backed relational store for documents/chunks/
embeddings metadata; no schema changes — this feature adds no new tables, see data-model.md).
Raw PDF bytes remain on the local filesystem under `PDFS_DIR` (existing convention); the new file
endpoint reads `Document.storage_path` as-is.

**Testing**: Backend — pytest (`backend/tests/{unit,contract,integration}`). Frontend — Vitest
(`frontend/tests/{unit,integration}`) plus Playwright for e2e.

**Target Platform**: Dockerized local web app (docker-compose: `postgres`, `backend`, `frontend`);
single local user (Constitution Principle III), no auth.

**Project Type**: Web application (frontend + backend), existing structure — see Project Structure
below.

**Performance Goals**: PDF preview renders within ~2s of selection for typical document sizes
(spec SC-003). No new throughput targets; this is a single-user local tool, not a concurrent-load
service.

**Constraints**: "Entire Corpus" auto-load and projection scoped to ~50-document lab-scale corpora
without pagination/batching (clarified in spec; larger scale explicitly deferred). Embedding
projection requires a minimum of 5 embedded chunks before UMAP/PCA becomes selectable (spec
FR-018). Projection is 2D-only for this feature (research.md §6) — 3D deferred.

**Scale/Scope**: 4 user stories (P1–P4) touching 3 existing screens (Fixed Size Chunking, Sources,
Embeddings/Vector View) plus 2 new backend endpoints and 2 new frontend dependencies.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — PASS. UMAP/PCA are added as a registered
  `embeddings/projections/` subpackage (mirroring the existing `chunking/strategies/` and
  `embeddings/models/` registry pattern), not hardcoded branching — see research.md §6.
- **II. Test-First, Test at Every Level** — PASS (to be enforced in tasks.md). New backend contract
  tests for `GET /api/sources/{document_id}/file` and `POST /api/embeddings/project`; new frontend
  unit tests for `assignChunkColors`, `ChunkedMarkdownView`, `SourceDocumentPreview`, and the
  projection view, per contracts/ui-contracts.md.
- **III. Single-User Simplicity (YAGNI)** — PASS. No auth added for the new file endpoint (matches
  every existing endpoint). "Entire Corpus" continues the existing client-side per-document/
  per-chunk fan-out pattern rather than introducing a new batch endpoint, deferred until corpus
  scale actually demands it (clarified ~50-doc scope).
- **IV. Fixed Technology Stack** — PASS with one pre-existing, unrelated note: the constitution
  names Qdrant as the vector store, but the current implementation (per `013-bert-pgvector-
  embeddings`, predating this feature) stores vectors in PostgreSQL via `pgvector` with no separate
  Qdrant service running. This feature does not touch that decision either way — it only adds a
  PCA/UMAP computation step over embeddings already read from the existing pgvector-backed store.
  No new stack element is introduced beyond two Python libraries (`scikit-learn`, `umap-learn`) and
  two frontend libraries (`react-pdf`, `recharts`), all additive within the existing
  Python/React stack, not a stack change.
- **V. Experiment Observability & Reproducibility** — PASS. This feature adds a visualization layer
  over already-recorded chunks/embeddings; it does not change what is recorded or how
  chunks/embeddings trace back to their source documents.

## Project Structure

### Documentation (this feature)

```text
specs/021-sources-chunking-embeddings-refresh/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── sources-file-api.md
│   ├── embeddings-projection-api.md
│   └── ui-contracts.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Existing web application structure (frontend + backend), extended in place — no new top-level
directories:

```text
backend/
├── app/
│   ├── sources/
│   │   ├── router.py          # + GET /{document_id}/file (new)
│   │   └── service.py         # + resolve document → storage_path → bytes (new)
│   ├── chunking/
│   │   └── router.py          # unchanged (GET /saved-chunks reused as-is)
│   └── embeddings/
│       ├── router.py          # + POST /project (new)
│       ├── projection_methods.py  # umap/pca available flips false → true
│       └── projections/       # new pluggable-registry subpackage
│           ├── base.py        # projection interface
│           ├── pca.py          # scikit-learn PCA implementation
│           └── umap.py         # umap-learn implementation
└── tests/
    ├── contract/
    │   ├── test_sources_file.py            # new
    │   └── test_embeddings_project.py      # new
    └── unit/
        ├── test_projections_pca.py         # new
        └── test_projections_umap.py        # new

frontend/
├── src/
│   ├── components/
│   │   ├── sources/
│   │   │   ├── DataSourcesScreen.tsx        # updated: split-pane layout
│   │   │   ├── SourceDocumentPreview.tsx    # new
│   │   │   └── ChunkedMarkdownView.tsx      # new
│   │   ├── chunking/
│   │   │   └── FixedSizeChunkingScreen.tsx  # updated: auto-load on mount
│   │   └── embeddings/
│   │       └── EmbeddingProjectionView.tsx  # new (or added into VectorViewScreen.tsx)
│   ├── hooks/
│   │   ├── useFixedSizeChunking.ts          # updated: fetch saved-chunks on mount
│   │   └── useEmbeddingProjection.ts        # new
│   └── lib/
│       ├── sourcesApi.ts                    # + fetchDocumentFile
│       ├── embeddingsApi.ts                 # + fetchProjection
│       └── chunkColorPalette.ts             # new: CHUNK_COLOR_PALETTE, assignChunkColors
└── tests/
    ├── unit/
    │   ├── chunkColorPalette.test.ts        # new
    │   ├── ChunkedMarkdownView.test.tsx      # new
    │   ├── SourceDocumentPreview.test.tsx    # new
    │   ├── useFixedSizeChunking.test.ts      # updated
    │   └── useEmbeddingProjection.test.ts    # new
    └── integration/
        └── DataSourcesScreen.test.tsx        # updated
```

**Structure Decision**: Extends the existing `backend/app/{sources,chunking,embeddings}` and
`frontend/src/components/{sources,chunking,embeddings}` feature-module layout in place — no new
services, no new top-level directories. The one new backend subpackage
(`embeddings/projections/`) follows the project's established pluggable-strategy registry
convention (Constitution Principle I), matching `chunking/strategies/` and `embeddings/models/`.

## Complexity Tracking

*No constitution violations requiring justification — all gates in the Constitution Check above
pass without exception. This section is intentionally left without entries.*
