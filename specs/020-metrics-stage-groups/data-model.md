# Phase 1 Data Model: Metrics Retrieval/Generation Stage Grouping

## Overview

This feature extends entities already introduced by `019-metrics-dashboard` (`TurnQualityScore`,
the `PipelineSummary` API projection); it adds one new column and three new API/UI fields, with no
new tables. See `research.md` for the rationale behind each choice below.

## Extended Entities

### TurnQualityScore (extended)

Existing table (`app/db/models.py`); new column only:

| Column | Type | Change | Notes |
|---|---|---|---|
| `judge_model` | String, not null | **new** | The actual model name the judge's provider returned (e.g. `"claude-sonnet-5"`) — distinct from the existing `judge` column, which stores the registry key (`"anthropic"`), exactly mirroring `ConversationTurn.llm_provider`/`llm_model`'s existing split. |

Operational note: by the time this feature is implemented, real usage of `019-metrics-dashboard`
has produced a handful of scored turns in the local dev database. Since every existing row was
scored under the same, unchanged `settings.anthropic_model`, the column is added nullable, backfilled
with that current value (accurate, not a guess, because the configuration hasn't changed since
those rows were scored), then set `NOT NULL` — the same three-step pattern 019 used for its own
schema additions against a non-empty database.

## New Read-Model Fields (no schema change)

### RetrievalStrategy constant

Not a stored value — a single named constant (`DEFAULT_RETRIEVAL_STRATEGY = "cosine-similarity"`)
promoted from its current hardcoded literal in `app/playground/service.py` to a shared,
importable location in the `retrieval` package. Both `playground.service` (which already uses it
for actual retrieval) and `metrics.service` (which now also *reports* it) import the same constant
— eliminates the duplicated literal.

## API Projection Changes

### PipelineSummary (extended)

Existing Pydantic response model (`app/metrics/schemas.py`); new fields only:

| Field | Type | Notes |
|---|---|---|
| `retrievalStrategy` | `str` | The constant above — always present once a pipeline exists, independent of question history (spec FR-005). |
| `generationLlm` | `str \| None` | The `llm_model` of the pipeline's most recently *successfully answered* turn; `None` when no turn has been answered yet (spec FR-006). |
| `judgeLlm` | `str \| None` | The `judge_model` of the pipeline's most recently *scored* turn (via `TurnQualityScore`); `None` when no turn has been scored yet (spec FR-006). |

These three fields appear identically in both `GET /api/metrics/corpora/{corpusId}/pipelines` and
`GET /api/metrics/corpora/{corpusId}/compare` (spec FR-009) — both already return
`PipelineSummary` objects, so no separate schema is needed for the comparison view.

## Query Additions

Two new small helper queries in `app/evaluation/service.py`, both taking the same `turn_ids` list
`aggregate_pipeline_scores` already accepts (from `turn_ids_for_pipeline`, unchanged):

- `latest_generation_model(db, turn_ids) -> str | None` — `ConversationTurn.llm_model` for the
  turn in `turn_ids` with `answer IS NOT NULL`, ordered by `answered_at` descending, limit 1.
- `latest_judge_model(db, turn_ids) -> str | None` — `TurnQualityScore.judge_model` joined to
  `turn_id IN turn_ids`, ordered by `scored_at` descending, limit 1.

## Entity Relationship Summary

```
ConversationTurn ──< TurnQualityScore (context_precision, context_recall,
    │                                   response_relevancy, faithfulness,
    │                                   judge, judge_model [new], scored_at)
    │
    └── llm_model (existing, generation) ──> latest_generation_model() per pipeline
                                              latest_judge_model() per pipeline (via TurnQualityScore)

DEFAULT_RETRIEVAL_STRATEGY (constant) ──> PipelineSummary.retrievalStrategy (every pipeline)
```

## State / Lifecycle Notes

- `judge_model` is set once, at the same time as the rest of a `TurnQualityScore` row (created
  exactly once per successfully scored turn, never updated afterward — unchanged lifecycle from
  019).
- `retrievalStrategy` has no lifecycle — it is a build-time/config-time constant, present for
  every pipeline unconditionally.
