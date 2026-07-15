# Implementation Plan: Playground Similarity Search

**Branch**: `016-playground-similarity-search` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/016-playground-similarity-search/spec.md`

## Summary

Replace the Playground placeholder with a working similarity-search screen: a query text field
and send button, read-only context (selected document, its chunking strategy, and the embedding
model used for its saved data) shown above the field, and a ranked top-5 list of the selected
document's saved chunks most similar to the query. On submit, the backend embeds the query with
the same model used for that document's stored chunk embeddings, ranks the document's saved
chunks by cosine similarity (deduping to each chunk's single best-scoring saved embedding), and
returns the query embedding plus the ranked results. The frontend displays a loading state while
the request is in flight and a clear error state on failure, including a distinguishable message
when the query exceeds the embedding model's maximum input length (per Clarifications).

Per Constitution Principle I (Pluggable RAG Architecture), the retrieval step is implemented
behind a new registered `RetrievalStrategy` — a `cosine-similarity` strategy — rather than as a
one-off query embedded directly in a router/service, mirroring the existing `STRATEGIES`
(chunking) and `EMBEDDING_MODELS` (embeddings) registries. The query-length check is likewise
added to the existing `EmbeddingModelStrategy` protocol rather than special-cased per model name,
so a future embedding model supplies its own limit-checking logic.

## Technical Context

**Language/Version**: Python 3.12 (backend, FastAPI); TypeScript 5 (frontend, React 18, Vite)

**Primary Dependencies**: FastAPI, SQLAlchemy, `pgvector` (SQLAlchemy `Vector.cosine_distance()`,
confirmed available on the installed `pgvector-sqlalchemy` version — see research.md), the
existing `transformers`/`torch`-backed BERT embedding strategy (reused, not duplicated), React

**Storage**: PostgreSQL + pgvector — no schema changes; this feature only *reads* the existing
`chunks` and `embeddings` tables (013-bert-pgvector-embeddings) via a new cosine-similarity query

**Testing**: pytest (contract, unit, integration) for the backend; Vitest + React Testing Library
for frontend components/hooks; Playwright for the end-to-end flow

**Target Platform**: Existing byorag web app (local single-user)

**Project Type**: Web application (existing `frontend/` + `backend/` split)

**Performance Goals**: A single BERT CPU inference for the query text (same cost profile as
embedding one chunk today) plus one indexed-scope SQL query over at most `MAX_CHUNKS` (200) rows
for the selected document — no new performance envelope beyond what chunk embedding generation
already does.

**Constraints**: No database schema changes; must reuse the existing `EMBEDDING_MODELS` registry
for query embedding (never a second, divergent embedding code path); chunk deduplication (a
chunk's best-scoring saved embedding only) must happen in the query/service layer, not the UI;
search is scoped to a single document, never cross-document.

**Scale/Scope**: One new backend module (`app/playground/`), one new backend registry module
(`app/retrieval/`), a small protocol extension to `app/embeddings/models/base.py`, one frontend
screen implementation (replacing the existing placeholder), one new hook, one new API client
module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: Retrieval is an explicitly named pipeline stage in this
  principle. Similarity search is implemented behind a new `RetrievalStrategy` Protocol and
  `RETRIEVAL_STRATEGIES` registry (`app/retrieval/strategies/`), registering a `cosine-similarity`
  strategy — mirroring the existing `STRATEGIES` (chunking) and `EMBEDDING_MODELS` (embeddings)
  registries exactly. The Playground service looks up the strategy by key rather than calling a
  hardcoded SQL query directly. PASS.
- **II. Test-First, Test at Every Level (NON-NEGOTIABLE)**: Contract tests for the new
  `/api/playground/*` endpoints, unit tests for the `cosine-similarity` retrieval strategy and the
  new `fits()` query-length check, and component/e2e tests for the Playground screen will be part
  of the task breakdown, written before implementation. PASS (satisfied in tasks).
- **III. Single-User Simplicity (YAGNI)**: No user-facing retrieval-strategy or embedding-model
  picker is added to the Playground UI — the spec explicitly scopes those to read-only context
  display (only one of each is registered today; a picker would be speculative). PASS.
- **IV. Fixed Technology Stack**: No new stack element — reuses FastAPI, PostgreSQL/pgvector, and
  React exactly as already deployed. PASS.
- **V. Experiment Observability & Reproducibility**: This feature directly serves this principle —
  showing the document/chunking-strategy/embedding-model context (US2) and the generated query
  embedding (US3) makes every search result traceable back to the exact configuration that
  produced it. PASS.

No violations. Complexity Tracking is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/016-playground-similarity-search/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── playground/                    # NEW — mirrors chunking/embeddings/corpora layout
│   │   ├── __init__.py
│   │   ├── router.py                  # GET /api/playground/context, POST /api/playground/search
│   │   ├── schemas.py                 # PlaygroundContextResponse, PlaygroundSearchRequest/Response
│   │   └── service.py                 # resolve context; orchestrate embed-query + retrieve
│   ├── retrieval/                     # NEW — mirrors chunking/strategies and embeddings/models
│   │   ├── __init__.py
│   │   └── strategies/
│   │       ├── __init__.py
│   │       ├── base.py                # RetrievalStrategy Protocol, RETRIEVAL_STRATEGIES registry
│   │       └── cosine_similarity.py   # registers "cosine-similarity"
│   ├── embeddings/
│   │   ├── models/
│   │   │   ├── base.py                # MODIFIED — add fits(text) -> bool to the Protocol
│   │   │   └── bert.py                # MODIFIED — implement fits() via tokenizer.model_max_length
│   │   └── ...                        # unchanged otherwise
│   └── main.py                        # MODIFIED — register the new playground router
└── tests/
    ├── contract/
    │   └── test_playground_search.py         # NEW
    ├── unit/
    │   ├── test_cosine_similarity_strategy.py # NEW
    │   ├── test_bert_fits.py                  # NEW
    │   └── test_playground_service.py         # NEW
    └── integration/                            # not needed — this feature is read-only,
                                                  # no new persisted state to verify

frontend/
├── src/
│   ├── components/playground/
│   │   └── PlaygroundScreen.tsx        # MODIFIED — replace placeholder with full implementation
│   ├── hooks/
│   │   └── usePlaygroundSearch.ts      # NEW
│   ├── lib/
│   │   └── playgroundApi.ts            # NEW
│   └── types/
│       └── playground.ts               # NEW
└── tests/
    ├── unit/
    │   ├── PlaygroundScreen.test.tsx    # NEW
    │   └── usePlaygroundSearch.test.ts  # NEW
    └── e2e/
        └── playground.spec.ts           # NEW — extends the existing embeddings → vector-view
                                          # → playground e2e chain (embeddings.spec.ts)
```

**Structure Decision**: Existing `frontend/` + `backend/` web-application layout, unchanged. Two
new backend modules (`app/playground/`, `app/retrieval/`) follow the exact package shape already
established by `app/chunking/` and `app/embeddings/` (router + schemas + service, with a
`strategies`/`models` sub-package for the pluggable piece). No existing module is restructured.

## Complexity Tracking

*No violations — this section is not applicable.*
