# Quickstart: Validate Metrics Retrieval/Generation Stage Grouping

## Prerequisites

- Backend running against a Postgres instance with `019-metrics-dashboard` already applied
  (`turn_quality_scores` table exists).
- **Schema addition required**: this feature adds a `judge_model` column to
  `turn_quality_scores`. Since `turn_quality_scores` has zero rows in a fresh 019 install, this
  is a plain `ALTER TABLE ... ADD COLUMN ... NOT NULL` with no backfill (data-model.md
  Operational Note) — safe to apply directly, no schema reset needed.
- `ANTHROPIC_API_KEY` set in the backend's environment (used for both generation and judging,
  unchanged from 019).
- A corpus with saved chunks, saved embeddings, and at least one answered, scored Playground
  question (see `019-metrics-dashboard/quickstart.md` Scenario 1 to produce one if needed).

## Scenario 1 — View retrieval and generation details grouped separately (US1, FR-001–FR-004)

1. Open the Metrics screen and select a corpus with an answered, scored question.
2. **Expected**: the pipeline detail view shows two labeled sections — "Retrieval" (chunking
   technique, embedding model, retrieval strategy, Context Precision, Context Recall) and
   "Generation" (generation LLM name, Response Relevancy, Faithfulness).
3. **Expected**: the judge LLM name is shown once (not duplicated in both sections), clearly
   labeled as having produced the scores in both sections.

## Scenario 2 — See retrieval strategy before any question, and correct LLM names after (US2, FR-005–FR-008)

1. Select a corpus with saved chunks and embeddings but no questions asked yet.
2. **Expected**: the retrieval strategy is shown; the generation LLM name and judge LLM name show
   a "not available yet" indication.
3. Ask and successfully answer a question for that pipeline (generation succeeds and scoring
   completes).
4. **Expected**: the generation LLM name and judge LLM name now show the actual models used.
5. If your environment allows changing `ANTHROPIC_MODEL` and asking a second question under the
   new setting: confirm the displayed generation LLM name and judge LLM name update to the newer
   model (most-recently-used — research.md §3), not the original one.

## Scenario 3 — See the same fields in the comparison view (US3, FR-009)

1. With a corpus that has two or more pipelines (see `019-metrics-dashboard/quickstart.md`
   Scenario 3 for how to produce a second pipeline for testing), open the comparison view.
2. **Expected**: each pipeline's row shows its own retrieval strategy, generation LLM name, and
   judge LLM name alongside its existing chunk/question/answer counts and scores.

## Edge cases to spot-check

- A pipeline where every generation attempt has failed (errored, no successful answer): confirm
  the generation LLM name shows "not available yet," not a stale or incorrect value.
- A pipeline with an answered-but-unscored question (judge call failed or is still pending):
  confirm the judge LLM name shows "not available yet" independent of the generation LLM name
  already being populated.
