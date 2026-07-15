# Implementation Plan: Generate and Save Chunk Embeddings

**Branch**: `013-bert-pgvector-embeddings` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-bert-pgvector-embeddings/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Adds an Embeddings screen that mirrors the Chunking screen's preview → explicit-save pattern
(`012-save-chunks-button`): pick a document (reusing the existing per-corpus document dropdown),
view its already-saved chunks, pick an embedding model from a dropdown (one option today, a local
BERT model, structured for more later), click "Generate Embeddings" to compute a non-persisted
preview with progress, then click "Save" to persist it. Persisting is additive, not
replace-on-resave: a chunk accumulates one saved `Embedding` row per successful save (one chunk →
many embeddings), so the same or different models can be compared later. Embeddings are stored in
PostgreSQL via the `pgvector` extension rather than a dedicated vector database for this iteration
— an explicit, user-requested, intentionally temporary deviation from this project's stated fixed
stack, justified below and in Complexity Tracking.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript with React 19 (frontend) — unchanged.

**Primary Dependencies**: FastAPI + SQLAlchemy + psycopg (backend, unchanged) plus two new backend
dependencies: `transformers` + `torch` (local BERT inference — `bert-base-uncased`, mean-pooled
token embeddings, no external embedding API call) and `pgvector` (the Python package providing a
SQLAlchemy `Vector` column type that maps to Postgres's `vector` type). Frontend: React + Vite,
unchanged, no new dependency.

**Storage**: PostgreSQL, extended with the `pgvector` extension (`CREATE EXTENSION IF NOT EXISTS
vector`) and a new `embeddings` table (`chunk_id` FK → `chunks.id`, `model`, `vector(768)`,
`created_at`) — one chunk to many embeddings, rows are never replaced, only added. Requires
switching the Postgres image in `docker-compose.yml` from `postgres:16` to a `pgvector`-enabled
image (e.g. `pgvector/pgvector:pg16`), since the plain image doesn't ship the extension.

**Testing**: pytest (backend contract/integration/unit — `backend/tests/`), Vitest + React Testing
Library (frontend unit/component — `frontend/tests/unit/`), Playwright (frontend e2e —
`frontend/tests/e2e/`) — same tooling as every prior feature, new test files/cases only.

**Target Platform**: Web application served via Docker Compose (frontend, backend, Postgres,
Qdrant containers) — Qdrant remains part of the compose file per the constitution but is not used
by this feature (deferred, per spec Assumptions).

**Project Type**: Web application (existing `backend/` + `frontend/` split); new `embeddings`
vertical slice added to each, mirroring the existing `chunking` slice's shape.

**Performance Goals**: No hard numeric target (single local user, consistent with every prior
feature in this project). BERT-base CPU inference is the expected bottleneck for
generate/save — both surface real per-chunk progress (not an indeterminate spinner) specifically
because that cost is now large enough to be worth showing, unlike chunking's near-instant save.

**Constraints**: Embedding generation runs entirely inside the backend process on CPU, with no
outbound network call to a third-party embedding API — consistent with the spec's own intent to
avoid adding new external/network dependencies (the same reasoning that motivated deferring
Qdrant). The `vector` column's dimensionality is fixed to the one supported model today (768,
`bert-base-uncased`'s hidden size); adding a second model with a different output dimension will
require a schema change, deliberately not solved now (YAGNI, constitution Principle III) and
recorded as a known limitation.

**Scale/Scope**: Same single-user, single-document-at-a-time screen pattern as the Chunking
screen; bounded to ≤200 chunks per document (the existing save cap from `012-save-chunks-button`
already bounds how many `Chunk` rows can exist per document, which in turn bounds how many
embeddings a single generate/save cycle touches).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. Embedding models are registered in a strategy dict
  (`EMBEDDING_MODELS`, mirroring `app.chunking.strategies.base.STRATEGIES`) keyed by a stable
  identifier (`"bert"`); the picker and the persisted `Embedding.model` column both use that key,
  not a hardcoded branch, so a second model is addable by registering a new entry — no picker
  redesign (spec FR-003).
- **II. Test-First, Test at Every Level**: PASS (must remain true through tasks/implementation).
  Plan requires: contract tests for the two new SSE endpoints (generate, save) and the new saved-
  chunks read endpoint, unit tests for the BERT strategy's pooling output shape and the
  accumulate-not-replace persistence behavior, an integration test proving saved embeddings survive
  a fresh DB session, and frontend unit/component tests for the new screen, hook, and API client,
  plus an e2e walkthrough.
- **III. Single-User Simplicity**: PASS. No new auth/locking/job-queue infrastructure — concurrent
  double-saves are handled the same way `012` handles them (client-side disable while in flight;
  server-side, each request's inserts are just additive, so a genuine race produces two valid
  row-sets, never corruption). The single fixed vector dimension (no multi-dimension schema) is
  itself a deliberate YAGNI simplification, not an oversight.
- **IV. Fixed Technology Stack**: **FAIL, justified deviation.** The constitution names Qdrant as
  the vector store; this feature stores embeddings in PostgreSQL via `pgvector` instead, per the
  user's explicit request ("avoid qdrant for now... will use qdrant in future scope"). This is
  recorded in Complexity Tracking below rather than resolved with a constitution amendment, because
  the user has explicitly framed it as temporary/experimental, not a permanent stack change — per
  the constitution's own Governance section, an amendment is required only "if adopted permanently."
  Recommend revisiting this — either amend Principle IV to formally allow pgvector, or actually
  migrate to Qdrant — once the future-scope Qdrant work is scheduled, so this deviation doesn't
  linger indefinitely.
- **V. Experiment Observability & Reproducibility**: PASS (strengthened). The accumulate-not-
  replace design for `Embedding` rows exists specifically so multiple models' (or repeated runs')
  embeddings for the same chunk remain simultaneously queryable and comparable — a direct
  implementation of this principle, not just compliance with it. Every saved embedding records its
  producing model and source chunk (spec FR-010).

One violation (Principle IV), explicitly justified below — proceeding to Phase 0.

**Post-Phase 1 re-check**: Design artifacts (`data-model.md`, `contracts/embeddings-api.md`,
`quickstart.md`) introduce nothing beyond what this gate already covers — no new stack element,
no new pluggability gap, no new auth/multi-user surface. The `Embedding` entity's traceability
fields (`chunk_id`, `model`) and accumulate-not-replace persistence are exactly what Principle V
called for. Conclusion unchanged: PASS on I/II/III/V, justified deviation on IV.

## Project Structure

### Documentation (this feature)

```text
specs/013-bert-pgvector-embeddings/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── embeddings-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── chunking/
│   │   ├── router.py        # add GET /api/chunking/saved-chunks?documentId= (new read endpoint)
│   │   └── service.py       # add list_saved_chunks(db, document_id) -> list[ChunkRow]
│   ├── embeddings/          # new vertical slice, mirrors app/chunking/
│   │   ├── __init__.py
│   │   ├── router.py        # GET /api/embeddings/models, /generate/stream, /save/stream
│   │   ├── schemas.py       # EmbeddingVector, EmbeddingGenerateResponse, EmbeddingModel, etc.
│   │   ├── service.py       # resolve_run(), stream_generate(), save_embeddings()
│   │   └── models/          # mirrors app/chunking/strategies/
│   │       ├── __init__.py
│   │       ├── base.py      # EmbeddingModelStrategy protocol + EMBEDDING_MODELS registry
│   │       └── bert.py      # BertEmbeddingStrategy (transformers + torch, mean pooling)
│   └── db/
│       └── models.py        # add Embedding model; add Chunk.embeddings relationship
└── tests/
    ├── contract/
    │   ├── test_chunking_saved_chunks.py    # new
    │   ├── test_embeddings_models.py        # new
    │   ├── test_embeddings_generate.py      # new
    │   └── test_embeddings_save.py          # new
    ├── unit/
    │   ├── test_bert_embedding_strategy.py  # new
    │   └── test_embeddings_service.py       # new
    └── integration/
        └── test_embeddings_persistence.py   # new

frontend/
├── src/
│   ├── lib/
│   │   └── embeddingsApi.ts             # new: listModels, generateEmbeddingsStream, saveEmbeddingsStream
│   ├── hooks/
│   │   └── useChunkEmbeddings.ts        # new: documents/chunks load, model select, generate/save + progress
│   ├── components/embeddings/
│   │   └── EmbeddingsScreen.tsx         # replaces the current "coming soon" placeholder
│   └── types/
│       └── embeddings.ts                # new
└── tests/
    ├── unit/
    │   ├── useChunkEmbeddings.test.ts       # new
    │   └── EmbeddingsScreen.test.tsx        # new
    └── e2e/
        └── embeddings.spec.ts                # new

docker-compose.yml   # postgres image: postgres:16 -> pgvector/pgvector:pg16
backend/pyproject.toml  # add transformers, torch, pgvector dependencies
```

**Structure Decision**: Reuses the existing `backend/` (FastAPI) + `frontend/` (React/Vite) split.
A new `embeddings` vertical slice is added on both sides, deliberately mirroring the shape of the
existing `chunking` slice (router/schemas/service/pluggable-strategy-registry on the backend;
lib/hook/screen/types on the frontend) rather than introducing a new architectural pattern.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Principle IV (Fixed Technology Stack) — embeddings stored via PostgreSQL `pgvector` instead of the constitution-named Qdrant vector store | Explicit, deliberate user request to avoid standing up/integrating Qdrant for this iteration, reusing the PostgreSQL dependency already present in the stack; user has explicitly stated Qdrant is future scope, not abandoned | Using Qdrant now would satisfy the letter of Principle IV immediately, but contradicts the user's explicit, current instruction and would mean building and wiring a second stateful service (Qdrant client, collection management, embedding upsert/query API) for a single-user local tool before it's actually needed — deferring it until the future-scope Qdrant work is real is consistent with Principle III (YAGNI) and does not block anything in this feature's own scope, since `pgvector` gives real vector storage/similarity capability today |
