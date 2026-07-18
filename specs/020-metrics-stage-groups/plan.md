# Implementation Plan: Metrics Retrieval/Generation Stage Grouping

**Branch**: `020-metrics-stage-groups` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-metrics-stage-groups/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Extends the `019-metrics-dashboard` Metrics screen's pipeline detail and comparison views to
group information by RAG stage — a "Retrieval" section (chunking technique, embedding model,
retrieval strategy, Context Precision, Context Recall) and a "Generation" section (generation LLM
name, Response Relevancy, Faithfulness) — and adds three previously-invisible fields: which
retrieval strategy is in use, which LLM generated answers, and which LLM judged/scored them.
Technical approach: capture the judge's actual model name (already available from the Anthropic
API response but currently discarded) into a new `TurnQualityScore.judge_model` column, mirroring
the existing `ConversationTurn.llm_provider`/`llm_model` split; promote the hardcoded
`"cosine-similarity"` retrieval-strategy literal to a shared constant surfaced on every pipeline
regardless of question history; add two small "most recently used" queries (generation LLM, judge
LLM) reusing the existing per-pipeline turn-id lookup; reorganize the frontend's `ScoreSummary`
into two labeled sections and add three columns to `ComparisonModal`.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript 5 / React 19 (frontend) — unchanged, no version change.

**Primary Dependencies**: No new dependencies — reuses the existing `anthropic` SDK response (`response.model`, already returned by the API call `AnthropicJudge.score()` already makes) and the existing React/Vite frontend stack.

**Storage**: PostgreSQL (existing). Schema addition: one new not-null column (`turn_quality_scores.judge_model`) — see data-model.md's operational note on why no backfill is needed (the table is empty at this feature's implementation time).

**Testing**: pytest (`backend/tests/{contract,integration,unit}`), Vitest + Testing Library (`frontend/tests/{unit,integration}`) — existing tooling, extending existing test files/suites from 019 rather than introducing new frameworks.

**Target Platform**: Dockerized local web app, single local user — unchanged.

**Project Type**: Web application (existing `backend/` + `frontend/` split) — unchanged.

**Performance Goals**: The two new "most recently used" queries are single-row lookups (`ORDER BY ... DESC LIMIT 1`) over an already-computed `turn_ids` list, adding negligible latency to the existing per-pipeline read that already performs comparable lookups (e.g. `aggregate_pipeline_scores`).

**Constraints**: None beyond those already established by 019 (no ALTER-based migration tooling in this stack — irrelevant here since the new column ships against an empty table, per data-model.md).

**Scale/Scope**: Single local user, small corpora — unchanged from 019; no new aggregation/caching strategy needed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Pluggable RAG Architecture | `retrievalStrategy` is surfaced as a single named constant read from the same place `playground.service` already resolves its retrieval strategy from — when a second `RetrievalStrategy` is registered in the future, this becomes a per-pipeline value instead of a constant without changing the API contract's field name/shape. `judge_model`/`generationLlm` similarly just expose data already produced by the existing pluggable `EvaluationJudge`/`GenerationProvider` registries. | PASS |
| II. Test-First, Test at Every Level | New/extended contract tests (`metrics-api` pipelines/compare response shape), unit tests (`latest_generation_model`, `latest_judge_model`, judge-model capture in `AnthropicJudge`), frontend unit/integration tests for the two-section `ScoreSummary` and the extended `ComparisonModal`. Enforced in `tasks.md` (next phase). | PASS (planned) |
| III. Single-User Simplicity | No new auth/multi-tenant concepts; reuses existing single-judge, single-retrieval-strategy configuration model. | PASS |
| IV. Fixed Technology Stack | No new stack element — reuses the existing Anthropic SDK response field and Postgres column addition within the existing schema-management approach. | PASS |
| V. Experiment Observability & Reproducibility | Directly strengthens this principle — a pipeline's retrieval strategy, generation LLM, and judge LLM were previously invisible on the Metrics screen despite directly affecting its scores; making them visible is exactly the "traceable back to the experiment configuration" requirement this principle calls for. | PASS |

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/020-metrics-stage-groups/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── metrics-api-stage-fields.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── db/
│   │   └── models.py                    # add TurnQualityScore.judge_model column
│   ├── retrieval/strategies/
│   │   └── base.py                      # add DEFAULT_RETRIEVAL_STRATEGY constant
│   ├── evaluation/
│   │   ├── schemas.py                   # judge score result gains a model field
│   │   ├── strategies/
│   │   │   ├── base.py                  # EvaluationJudge.score() return type gains model
│   │   │   └── anthropic_judge.py       # capture response.model, return it
│   │   └── service.py                   # persist judge_model; add latest_generation_model, latest_judge_model
│   ├── playground/
│   │   └── service.py                   # use the shared DEFAULT_RETRIEVAL_STRATEGY constant
│   └── metrics/
│       ├── schemas.py                   # PipelineSummary gains retrievalStrategy/generationLlm/judgeLlm
│       └── service.py                   # populate the three new fields per pipeline
└── tests/
    ├── contract/
    │   └── test_metrics_pipelines.py    # extend: new response fields
    ├── unit/
    │   ├── test_anthropic_judge.py      # extend: model captured in result
    │   └── test_metrics_service.py      # extend: retrievalStrategy/generationLlm/judgeLlm aggregation
    └── integration/
        └── test_evaluation_scoring_pipeline.py  # extend: judge_model persisted

frontend/
├── src/
│   ├── types/metrics.ts                 # PipelineSummary gains the three new fields
│   └── components/metrics/
│       ├── ScoreSummary.tsx             # reorganize into Retrieval/Generation sections
│       └── ComparisonModal.tsx          # add Retrieval Strategy / Generation LLM / Judge LLM columns
└── tests/
    └── unit/
        ├── ScoreSummary.test.tsx        # new — was inline in MetricsScreen.test.tsx before
        ├── ComparisonModal.test.tsx     # extend
        └── MetricsScreen.test.tsx       # extend
```

**Structure Decision**: Extends the existing `backend/app/{evaluation,retrieval,playground,metrics}`
packages and `frontend/src/components/metrics/` from `019-metrics-dashboard` in place — no new
packages, screens, or top-level directories. `ScoreSummary.tsx` gains its own dedicated test file
since it grows enough internal structure (two sections) to warrant testing independently of
`MetricsScreen.tsx`'s existing tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted (Constitution Check above is all PASS).
