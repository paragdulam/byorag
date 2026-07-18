---

description: "Task list for Metrics Retrieval/Generation Stage Grouping implementation"

---

# Tasks: Metrics Retrieval/Generation Stage Grouping

**Input**: Design documents from `/specs/020-metrics-stage-groups/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story (spec.md priorities: US1/US2 = P1, US3 = P2).
Several existing 019-metrics-dashboard files are extended in place rather than created new.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths follow the existing `backend/app/<package>/{router,schemas,service}.py` and
  `frontend/src/{components/<feature>,types}/` conventions (plan.md Project Structure)

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Schema and shared-constant changes every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T001 [P] Add a not-null `judge_model` column to `TurnQualityScore` in `backend/app/db/models.py` (data-model.md — no backfill needed, table is empty)
- [X] T002 [P] Add a `DEFAULT_RETRIEVAL_STRATEGY = "cosine-similarity"` constant in `backend/app/retrieval/strategies/base.py`
- [X] T003 Update `backend/app/playground/service.py` to import and use `DEFAULT_RETRIEVAL_STRATEGY` instead of the hardcoded `"cosine-similarity"` literal (depends on T002)
- [X] T004 [P] Extend the `PipelineSummary` type with `retrievalStrategy: string`, `generationLlm: string | null`, `judgeLlm: string | null` in `frontend/src/types/metrics.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 2: User Story 2 - See retrieval strategy, generation LLM, and judge LLM for a pipeline (Priority: P1)

**Goal**: The Metrics API reports, for every pipeline, its retrieval strategy (always), and the
most recently used generation LLM and judge LLM (once a question has been answered/scored,
`null` otherwise).

**Independent Test**: Query `GET /api/metrics/corpora/{corpusId}/pipelines` directly for a
pipeline with saved chunks/embeddings but no questions yet — confirm `retrievalStrategy` is
present while `generationLlm`/`judgeLlm` are `null`; then answer and score a question and query
again — confirm both fields now reflect the actual models used.

*Note*: Implemented before User Story 1 even though both are P1 — US1's grouped sections need
real data to display, and this story's correctness is independently verifiable via the API alone
(see quickstart.md Scenario 2), without requiring US1's UI grouping to exist yet.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US2] Extend `backend/tests/unit/test_anthropic_judge.py`: `AnthropicJudge.score()` returns the actual model name (from the stubbed Anthropic response) alongside the four quality values
- [X] T006 [P] [US2] Extend `backend/tests/unit/test_metrics_service.py`: `latest_generation_model`/`latest_judge_model`-driven fields are `null` with no answered/scored turns, and reflect the most recently answered/scored turn's model when multiple turns used different models
- [X] T007 [P] [US2] Extend `backend/tests/contract/test_metrics_pipelines.py`: response includes `retrievalStrategy` (always `"cosine-similarity"`), `generationLlm`/`judgeLlm` (`null` before any answered/scored question, populated after)
- [X] T008 [P] [US2] Extend `backend/tests/integration/test_evaluation_scoring_pipeline.py`: after a successful generate+score, `TurnQualityScore.judge_model` is persisted with the judge's actual model name

### Implementation for User Story 2

- [X] T009 [US2] Extend the `EvaluationJudge` protocol and `AnthropicJudge.score()` to return the model name alongside `QualityScores` in `backend/app/evaluation/strategies/base.py` and `backend/app/evaluation/strategies/anthropic_judge.py` (depends on T005, T001)
- [X] T010 [US2] In `backend/app/evaluation/service.py`: persist `judge_model` on the `TurnQualityScore` created by `score_turn()`, and add `latest_generation_model(db, turn_ids)` / `latest_judge_model(db, turn_ids)` (most-recent-by-timestamp lookups per data-model.md) (depends on T009, T006, T001)
- [X] T011 [P] [US2] Add `retrievalStrategy`, `generationLlm`, `judgeLlm` fields to `PipelineSummary` in `backend/app/metrics/schemas.py`
- [X] T012 [US2] Populate `retrievalStrategy` (from `DEFAULT_RETRIEVAL_STRATEGY`), `generationLlm`, and `judgeLlm` in `_build_pipeline_summary` in `backend/app/metrics/service.py` (depends on T002, T010, T011)

**Checkpoint**: User Story 2 is independently verifiable via the Metrics API.

---

## Phase 3: User Story 1 - See retrieval-stage and generation-stage details grouped separately (Priority: P1) 🎯 MVP (user-facing)

**Goal**: The Metrics screen's pipeline detail view visually separates retrieval-stage
information from generation-stage information into two labeled sections, with the judge LLM
shown once, applying to both.

**Independent Test**: Open the Metrics screen for a corpus with an answered, scored question and
confirm a "Retrieval" section (chunking technique, embedding model, retrieval strategy, Context
Precision, Context Recall) and a separate "Generation" section (generation LLM, Response
Relevancy, Faithfulness) both render, with the judge LLM name shown once.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

- [X] T013 [P] [US1] Create `frontend/tests/unit/ScoreSummary.test.tsx`: asserts the "Retrieval" section contains chunking technique/embedding model/retrieval strategy/Context Precision/Context Recall, the "Generation" section contains generation LLM/Response Relevancy/Faithfulness, the judge LLM name appears once (not duplicated), and "not available yet" renders for null generation/judge LLM (spec FR-006)

### Implementation for User Story 1

- [X] T014 [US1] Reorganize `ScoreSummary` into "Retrieval" and "Generation" `<section>`s with the new fields, a single judge-LLM display, and "not available yet" empty states in `frontend/src/components/metrics/ScoreSummary.tsx` (depends on T013, T004, T012)

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the
user-visible MVP of this feature.

---

## Phase 4: User Story 3 - See the same grouping and fields when comparing pipelines (Priority: P2)

**Goal**: The comparison view shows each pipeline's retrieval strategy, generation LLM, and
judge LLM alongside its existing figures.

**Independent Test**: Open the comparison view for a corpus with two or more pipelines and
confirm each row shows its own retrieval strategy, generation LLM, and judge LLM.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T015 [P] [US3] Extend `frontend/tests/unit/ComparisonModal.test.tsx`: each pipeline row shows its own Retrieval Strategy, Generation LLM, and Judge LLM columns
- [X] T016 [P] [US3] Extend `backend/tests/contract/test_metrics_compare.py`: response includes the same three new fields per pipeline as the `.../pipelines` endpoint

### Implementation for User Story 3

- [X] T017 [US3] Add Retrieval Strategy / Generation LLM / Judge LLM columns to `frontend/src/components/metrics/ComparisonModal.tsx` (depends on T015, T004, T012)

**Checkpoint**: All three user stories independently functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across all three stories together

- [X] T018 [P] Run `quickstart.md` validation end-to-end (all 3 scenarios plus the two edge cases: failed-generation pipeline, answered-but-unscored pipeline)
- [X] T019 Extend `frontend/tests/e2e/metrics.spec.ts` Scenario 1 assertions to also confirm the "Retrieval"/"Generation" section headings and the retrieval strategy value are visible on the real Metrics screen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — BLOCKS all user stories
- **User Story 2 (Phase 2)**: Depends on Foundational only; independently verifiable via the API without US1's UI existing
- **User Story 1 (Phase 3)**: Depends on Foundational and on US2's API fields (T012) actually returning data — this is the story's real prerequisite, not merely a priority-ordering choice
- **User Story 3 (Phase 4)**: Depends on Foundational and US2's `_build_pipeline_summary` (T012, shared by both the pipelines and compare endpoints) — independent of US1's frontend work (touches a different component)
- **Polish (Phase 5)**: Depends on all three user stories being complete

### Within Each User Story

- Tests are written first and MUST fail before implementation begins
- Schema/constant changes before service logic; service logic before schema field population; backend fields before the frontend components that render them

### Parallel Opportunities

- T001, T002, T004 (Foundational) run in parallel — different files, no interdependency; T003 follows T002
- All 4 US2 test tasks (T005–T008) run in parallel — 4 different files
- T011 (metrics/schemas.py) runs in parallel with T009/T010 (evaluation package) — different files
- T013 (US1 test) has no US1 sibling to parallelize with, but can be written concurrently with any remaining US2/US3 work by a different developer
- T015 and T016 (US3 tests) run in parallel — different files (frontend vs. backend)
- **US3 (Phase 4) can be staffed in parallel with US1 (Phase 3)** once US2 (Phase 2) is done — they touch different components (`ComparisonModal.tsx` vs. `ScoreSummary.tsx`) and different test files, with no shared implementation files

---

## Parallel Example: User Story 2

```bash
# Launch all US2 tests together:
Task: "Extend test_anthropic_judge.py for model-name capture"
Task: "Extend test_metrics_service.py for latest-model aggregation"
Task: "Extend test_metrics_pipelines.py for the three new response fields"
Task: "Extend test_evaluation_scoring_pipeline.py for judge_model persistence"

# T011 (metrics/schemas.py) can run alongside T009/T010 (evaluation package):
Task: "Add retrievalStrategy/generationLlm/judgeLlm fields to PipelineSummary"
Task: "Extend EvaluationJudge protocol + AnthropicJudge to return the model name"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Foundational
2. Complete Phase 2: User Story 2 (backend data correctness — validate via quickstart.md Scenario 2's API-level check)
3. Complete Phase 3: User Story 1 (the user-visible grouped-sections MVP)
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Foundational → foundation ready
2. Add US2 → validate via the API → not yet user-visible, but correct
3. Add US1 → validate (quickstart Scenario 1) → deploy/demo (user-visible MVP!)
4. Add US3 → validate (quickstart Scenario 3) → deploy/demo
5. Each story adds value without breaking the previous ones

### Parallel Team Strategy

With multiple developers, after Foundational and US2 complete:

- Developer A: US1 (`ScoreSummary.tsx`)
- Developer B: US3 (`ComparisonModal.tsx` + its contract test)
- No file overlap between the two tracks

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify each test fails before implementing the code that makes it pass
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Unlike 019-metrics-dashboard, the new `turn_quality_scores.judge_model` column ships against
  an empty table (data-model.md), so no local database reset is required for T001
