# Implementation Plan: Metrics Dashboard

**Branch**: `019-metrics-dashboard` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-metrics-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A new Metrics screen lists every corpus and, for a selected corpus/chunking-technique/embedding-model
pipeline, shows question/answer counts (split by "entire corpus" vs. "individual document" scope)
and four automatically computed RAG quality scores — Context Precision, Context Recall, Response
Relevancy, Faithfulness. Users switch between a corpus's chunking techniques (when more than one
has been run) and can open a comparison modal showing all of a corpus's pipelines side by side.
Technical approach: extend the existing `ConversationTurn` model with a nullable `corpus_id` +
`scope` so Playground questions can target an entire corpus (new corpus-wide retrieval added to the
existing pluggable `RetrievalStrategy`), add a new pluggable `EvaluationJudge` that scores each
answered turn via the same Anthropic provider already used for generation (run as a background task
so it never blocks the answer response), persist scores in a new `turn_quality_scores` table, and
compute all Metrics-screen figures on demand at read time (no rollup cache, given single-user scale).

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5 / React 19 (frontend) — both already in use, no version change.

**Primary Dependencies**: Backend (existing, reused): FastAPI, SQLAlchemy 2.0, psycopg3, pgvector, `anthropic` SDK. Frontend (existing, reused): React 19, Vite, the existing internal `lib/*Api.ts` + `hooks/use*.ts` + `components/<feature>/*Screen.tsx` pattern. No new external dependencies are introduced by this feature (research.md §1).

**Storage**: PostgreSQL + pgvector (existing containerized service). Schema additions: nullable `corpus_id`/`scope` columns on `conversation_turns`, a nullable `document_id` snapshot column on `conversation_turn_chunks`, and a new `turn_quality_scores` table (data-model.md).

**Testing**: pytest with the existing `backend/tests/{contract,integration,unit}` structure; Vitest + Testing Library for frontend unit/integration tests under `frontend/tests/{unit,integration}`; Playwright for `frontend/tests/e2e` — all existing tooling, no new frameworks (Constitution Principle II: tests required at every level for every new component/service/endpoint).

**Target Platform**: Dockerized local web app, single local user (existing `docker-compose.yml`).

**Project Type**: Web application (existing `backend/` + `frontend/` split).

**Performance Goals**: Technique-switch updates the displayed pipeline data in under 2 seconds (SC-002); the comparison modal populates in one click/request (SC-003); LLM-judge scoring runs asynchronously after answer generation and must not add latency to the answer response itself (research.md §2).

**Constraints**: No ALTER-based migration tooling exists in this stack (`Base.metadata.create_all` only creates missing tables) — the new nullable columns require a local dev database reset, documented as a quickstart prerequisite rather than solved with new migration infrastructure (research.md §3). Quality scoring depends on the same `ANTHROPIC_API_KEY` already required for generation; when unset, scoring simply fails per-turn and that turn is excluded from aggregates (mirrors existing `GenerationError` handling), rather than requiring new configuration.

**Scale/Scope**: Single local user; small corpora/turn volumes per Constitution Principle III — justifies computing all aggregates on demand at read time instead of a precomputed rollup (research.md §5).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Pluggable RAG Architecture | New `EvaluationJudge` behind a `JUDGES` registry (mirrors `GENERATION_PROVIDERS`/`RETRIEVAL_STRATEGIES`); new corpus-wide retrieval added as a method on the existing swappable `RetrievalStrategy` protocol/registry, not a hardcoded branch. | PASS |
| II. Test-First, Test at Every Level | New backend contract tests (`metrics-api`, extended `playground-corpus-scope-api`), integration tests (scoring pipeline, corpus-wide retrieval, aggregation), unit tests (judge parsing, pipeline aggregation math); new frontend unit/integration tests for `MetricsScreen`/`useMetrics`/scope selector, plus an e2e scenario. Enforced in `tasks.md` (next phase). | PASS (planned) |
| III. Single-User Simplicity | No auth/multi-tenant concepts introduced; on-demand aggregation chosen over a cache specifically to avoid unneeded infrastructure (research.md §5). | PASS |
| IV. Fixed Technology Stack | No new stack element — reuses Postgres/pgvector, the existing Anthropic SDK, React, and Docker Compose. Schema changes are additive tables/columns within the existing `create_all` approach. | PASS |
| V. Experiment Observability & Reproducibility | This feature *is* the observability layer the constitution calls for — pipelines, their configuration (technique + embedding model), and their measured quality become traceable and comparable via the new `turn_quality_scores` table and per-pipeline aggregation. | PASS |

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/019-metrics-dashboard/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── metrics-api.md
│   └── playground-corpus-scope-api.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── db/
│   │   ├── models.py                    # extend ConversationTurn/ConversationTurnChunk; add TurnQualityScore
│   │   └── lookups.py                   # extend with corpus-turn lookups as needed
│   ├── retrieval/strategies/
│   │   ├── base.py                      # extend RetrievalStrategy protocol with search_corpus
│   │   └── cosine_similarity.py         # implement search_corpus
│   ├── evaluation/                      # new package
│   │   ├── schemas.py                   # QualityScores
│   │   ├── service.py                   # score_turn(), aggregate_pipeline_scores()
│   │   └── strategies/
│   │       ├── base.py                  # EvaluationJudge protocol + JUDGES registry
│   │       └── anthropic_judge.py       # LLM-as-judge implementation
│   ├── playground/
│   │   ├── router.py                    # extend for corpusId scope on context/turns endpoints
│   │   ├── schemas.py                   # extend TurnOut/CreateTurnRequest with scope/corpusId
│   │   └── service.py                   # extend create_turn for corpus scope; trigger scoring background task
│   └── metrics/                         # new package
│       ├── router.py                    # GET /api/metrics/corpora, .../pipelines, .../compare
│       ├── schemas.py
│       └── service.py                   # pipeline aggregation queries
└── tests/
    ├── contract/
    │   ├── test_metrics_corpora.py
    │   ├── test_metrics_pipelines.py
    │   ├── test_metrics_compare.py
    │   └── test_playground_corpus_scope.py
    ├── integration/
    │   ├── test_evaluation_scoring_pipeline.py
    │   ├── test_corpus_wide_retrieval.py
    │   └── test_metrics_aggregation.py
    └── unit/
        ├── test_anthropic_judge.py
        ├── test_metrics_service.py
        └── test_cosine_similarity_corpus.py

frontend/
├── src/
│   ├── components/
│   │   ├── metrics/                     # new
│   │   │   ├── MetricsScreen.tsx
│   │   │   ├── PipelineSelector.tsx
│   │   │   ├── ScoreSummary.tsx
│   │   │   └── ComparisonModal.tsx
│   │   ├── playground/                  # extend with scope selector (entire corpus vs. document)
│   │   └── layout/SidebarNav.tsx        # wire ScreenId "metrics" + nav entry (already stubbed)
│   ├── hooks/
│   │   └── useMetrics.ts                # new
│   ├── lib/
│   │   └── metricsApi.ts                # new
│   └── app/App.tsx                      # route to MetricsScreen
└── tests/
    ├── unit/
    │   ├── MetricsScreen.test.tsx
    │   └── useMetrics.test.ts
    ├── integration/
    │   └── MetricsScreen.test.tsx
    └── e2e/
        └── metrics.spec.ts
```

**Structure Decision**: Existing `backend/` + `frontend/` web application split (Constitution
Principle IV: Fixed Technology Stack). Backend gains two new packages (`app/evaluation`,
`app/metrics`) following the same `router.py`/`schemas.py`/`service.py` (+ `strategies/` for
pluggable pieces) shape already used by every existing backend feature package (`chunking`,
`embeddings`, `retrieval`, `generation`, `playground`). Frontend gains a new `components/metrics/`
screen following the same `components/<feature>/*Screen.tsx` + `hooks/use<Feature>.ts` +
`lib/<feature>Api.ts` pattern used by `corpora`, `embeddings`, `vector-view`, etc. No new
top-level directories or build tooling.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted (Constitution Check above is all PASS).
