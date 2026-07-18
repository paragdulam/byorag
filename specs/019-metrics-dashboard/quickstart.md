# Quickstart: Validate Metrics Dashboard

## Prerequisites

- Backend running against a Postgres instance with the `vector` extension bootstrapped.
- **Schema reset required**: this feature adds new columns to `conversation_turns`/
  `conversation_turn_chunks` and a new `turn_quality_scores` table. Since this project applies
  schema via `Base.metadata.create_all` only (no ALTER-based migrations — research.md §3), a local
  database created before this feature must be reset: `docker compose down -v` then
  `docker compose up` so `create_all` recreates the schema from scratch.
- `ANTHROPIC_API_KEY` set in the backend's environment — used both for answer generation (existing)
  and for the new LLM-judge quality scoring (this feature). `GENERATION_PROVIDER`/`ANTHROPIC_MODEL`
  may be left at their defaults.
- Frontend dev server running.
- A corpus with at least two documents, each with saved chunks (fixed-size) and saved embeddings.

## Scenario 1 — View a corpus's pipeline summary and quality scores (US1, FR-001–FR-005, FR-007–FR-009, FR-013)

1. In the Playground, ask and generate answers for 2–3 questions against one document in the
   corpus.
2. Wait a few seconds for background scoring to complete (no user action needed — FR-009).
3. Open the Metrics screen and select the corpus.
4. **Expected**: the chunking technique ("fixed-size"), embedding model, total questions asked,
   total answers received, and all four quality scores (Context Precision, Context Recall,
   Response Relevancy, Faithfulness) are shown for the corpus's pipeline.
5. Select a corpus with saved chunks but no questions asked yet.
6. **Expected**: technique and embedding model are shown; question/answer counts read 0; quality
   scores show a "not enough data yet" indication rather than blank or zero values (FR-013).
7. Select a corpus with no saved chunks at all.
8. **Expected**: an indication that no chunking pipeline has been established yet; no embedding
   model, counts, or scores are shown (FR-014).

## Scenario 2 — Switch between two chunking techniques on the same corpus (US2, FR-002–FR-004)

1. For the same corpus, run and save a second chunking technique (or a second fixed-size run
   distinguishable as its own pipeline) so the corpus now has ≥2 techniques with saved
   embeddings.
2. Open the Metrics screen for that corpus.
3. **Expected**: a technique selector lists every technique with saved chunks for the corpus.
4. Switch the selector to the second technique.
5. **Expected**: embedding model, question/answer counts, and quality scores update to that
   technique's own pipeline data, within ~2 seconds (SC-002).

## Scenario 3 — Compare all pipelines for a corpus (US3, FR-010)

1. With the same ≥2-technique corpus from Scenario 2, click the "Compare" action on the Metrics
   screen.
2. **Expected**: a modal opens listing every technique/embedding-model pipeline for the corpus,
   each with its own chunk count, question/answer counts, and quality scores, in a single view
   (SC-003).
3. Close the modal.
4. **Expected**: the screen returns to the single-pipeline view, still showing the technique that
   was selected before opening the modal.
5. Select a corpus with only one chunking technique.
6. **Expected**: the "Compare" action is disabled or hidden.

## Scenario 4 — Ask a question against an entire corpus and see the scope breakdown (US4, FR-006, FR-011, FR-012, SC-005)

1. Open the Playground for the corpus used above.
2. Select "Entire Corpus" as the question scope (alongside the existing per-document option).
3. Ask a question and generate an answer.
4. **Expected**: the answer is generated from context retrieved across multiple documents in the
   corpus (inspect the retrieved chunks list — entries should show which document each came
   from).
5. Return to the Metrics screen for that corpus.
6. **Expected**: the question/answer counts increase by one, and the scope breakdown now shows at
   least one question attributed to "Entire Corpus" alongside any individual-document questions
   already counted.

## Edge cases to spot-check

- A Playground turn that errors (no answer generated): confirm it is included in "questions
  asked" but excluded from "answers received" and from the quality-score aggregate.
- Ask several questions in quick succession, then immediately open the Metrics screen before
  background scoring finishes: confirm the sample size shown for quality scores reflects only the
  turns scored so far, not a stale or blocking count.
