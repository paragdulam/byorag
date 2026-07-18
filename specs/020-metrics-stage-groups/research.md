# Phase 0 Research: Metrics Retrieval/Generation Stage Grouping

## 1. Capturing the judge's actual model name

**Decision**: Extend the `EvaluationJudge` protocol's `score(...)` return type to include the
actual model name the provider echoed back (e.g. `"claude-sonnet-5"`), not just the four quality
values. `AnthropicJudge.score()` already receives this on `response.model` from the Anthropic
Messages API call (identical to how `AnthropicProvider.generate()` already captures
`response.model` into `GenerationResult.model`) but currently discards it. Add a `judge_model`
column to `TurnQualityScore` (alongside the existing `judge` registry-key column) to persist it.

**Rationale**: `judge` already stores the registry key (`"anthropic"`) exactly as `Chunk.strategy`
and `Embedding.model` store registry keys rather than display names (019-metrics-dashboard
convention) — but the feature explicitly asks for the "Judge LLM name," which means the underlying
model, not the provider key. `ConversationTurn` already keeps this exact split
(`llm_provider` = registry key, `llm_model` = actual model) for generation; mirroring it for
scoring keeps the two concepts symmetric and reuses a pattern already proven in this codebase.

**Alternatives considered**:
- Store only the model name and drop `judge` — rejected: `judge` is still useful as the
  registry key for future multi-judge support (Constitution Principle I), and removing it would
  be an unrelated behavior change to already-shipped data.
- Derive the judge model from `settings.anthropic_model` at read time instead of persisting it —
  rejected: `settings.anthropic_model` reflects the *current* configuration, not necessarily what
  was actually used for a score computed under a previous configuration; persisting the value
  actually returned by the API call is the only way to make FR-007/FR-008's "most recently used"
  requirement correct after a config change.

## 2. Displaying the retrieval strategy

**Decision**: Expose the existing hardcoded `"cosine-similarity"` constant (currently a literal
string in `app/playground/service.py`) as a single shared, named constant importable from the
`retrieval` package, and surface that same value for every pipeline in the Metrics API response —
not derived from any turn's history.

**Rationale**: Retrieval strategy is a global configuration/registration fact today (there is
exactly one registered `RetrievalStrategy`, `"cosine-similarity"` — Constitution Principle I keeps
the door open for more, but none exist yet), not something that varies per turn the way
`chunking_strategy` does (which really can differ across a corpus's chunks). Spec FR-005
explicitly requires the retrieval strategy to be visible even before any question has been asked,
which only a configuration-level value (not a turn-history aggregate) can satisfy. Introducing a
per-turn `retrieval_strategy` snapshot column purely to serve a value that is currently always the
same one constant would be unjustified complexity (YAGNI) until a second retrieval strategy
actually exists to select between.

**Alternatives considered**:
- Snapshot `retrieval_strategy` per turn (mirroring `chunking_strategy`) — rejected for now as
  premature: with only one registered strategy, this adds a column and write-path complexity with
  no behavioral difference from a shared constant, and doesn't fulfill FR-005's "before any
  question is asked" requirement any better. Revisit if/when a second retrieval strategy is
  registered and users can actually choose between them per pipeline.

## 3. "Most recently used" generation/judge LLM per pipeline

**Decision**: For a given pipeline's `turn_ids` (already computed by
`evaluation.service.turn_ids_for_pipeline`, reused unchanged from 019), find the most recent
successfully-answered turn's `llm_model` (ordered by `answered_at` descending) for the generation
LLM, and the most recently scored turn's `judge_model` (via `TurnQualityScore`, ordered by
`scored_at` descending) for the judge LLM. Both return `None` when no qualifying turn exists yet.

**Rationale**: Matches the exact pattern `playground.service.get_context` already uses for
"most recently saved" `embeddingModel` (`order_by(EmbeddingRow.created_at.desc()).limit(1)`) —
reusing an established convention rather than inventing a new aggregation rule, per spec's
Assumptions section.

**Alternatives considered**:
- Show every distinct model used, as a list — rejected: spec explicitly resolved this via
  Assumptions to "most recently used," matching existing precedent; a list would also complicate
  the single-value comparison-table column requested in FR-009.

## 4. UI grouping shape

**Decision**: Reorganize the single-pipeline detail view (`ScoreSummary`) into two `<section>`
blocks headed "Retrieval" and "Generation," with the judge LLM name shown once, outside/above
both sections (labeled distinctly, e.g. "Scored by"), since one judge call produces measures for
both sections (spec FR-004). The comparison table (`ComparisonModal`) gains three new columns —
Retrieval Strategy, Generation LLM, Judge LLM — ordered so retrieval-related columns precede
generation-related columns, achieving the same conceptual grouping in tabular form without a
second header row (kept simple; a grouped `<thead>` sub-header was considered unnecessary
complexity for three added columns).

**Rationale**: Directly satisfies FR-001–FR-004 for the primary view; a table's column order is
the natural way to express "grouping" without restructuring the existing table into two separate
tables, which would break the row-per-pipeline comparison at a glance that is the whole point of
FR-009/US3.

**Alternatives considered**:
- Two separate tables (Retrieval table + Generation table) in the comparison modal — rejected:
  splits a single pipeline's row across two tables, making it harder, not easier, to compare
  pipelines side by side.
