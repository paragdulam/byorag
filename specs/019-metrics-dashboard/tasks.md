---

description: "Task list for Metrics Dashboard implementation"

---

# Tasks: Metrics Dashboard

**Input**: Design documents from `/specs/019-metrics-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story (spec.md priorities: US1/US2 = P1, US3/US4 = P2)
to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths follow the existing `backend/app/<package>/{router,schemas,service}.py` and
  `frontend/src/{components/<feature>,hooks,lib}/` conventions (plan.md Project Structure)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the two new backend packages this feature introduces

- [X] T001 Create `backend/app/evaluation/__init__.py` and `backend/app/evaluation/strategies/__init__.py`
- [X] T002 [P] Create `backend/app/metrics/__init__.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and navigation changes every user story reads or depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Extend `ConversationTurn` (`document_id` → nullable, add nullable `corpus_id` FK to
      `corpora.id`, add not-null `scope` column) and `ConversationTurnChunk` (add nullable
      `document_id` snapshot column), and add the new `TurnQualityScore` table
      (`turn_id` FK unique, `context_precision`, `context_recall`, `response_relevancy`,
      `faithfulness`, `judge`, `scored_at`) in `backend/app/db/models.py`, per data-model.md
- [X] T004 [P] Add `'metrics'` to the `ScreenId` union and set the existing "Metrics" nav entry's
      `screen: 'metrics'` in `frontend/src/components/layout/SidebarNav.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - View corpus pipeline summary and quality scores (Priority: P1) 🎯 MVP

**Goal**: A user opens the Metrics screen, picks a corpus, and sees its chunking technique,
embedding model, question/answer counts, and the four automatically computed quality scores
(Context Precision, Context Recall, Response Relevancy, Faithfulness) — with correct empty states
when there are no chunks or no answered questions yet.

**Independent Test**: Open the Metrics screen for a corpus with saved chunks, a saved embedding
model, and at least one answered Playground question; confirm technique, embedding model, counts,
and all four scores render. Also verify the "no questions yet" and "no chunks yet" empty states on
two other corpora.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T005 [P] [US1] Contract test for `GET /api/metrics/corpora` in `backend/tests/contract/test_metrics_corpora.py`
- [X] T006 [P] [US1] Contract test for `GET /api/metrics/corpora/{corpusId}/pipelines` (incl. empty-chunks and no-scores-yet response shapes, 404 for unknown corpus) in `backend/tests/contract/test_metrics_pipelines.py`
- [X] T007 [P] [US1] Unit test for the Anthropic evaluation judge's prompt assembly and response parsing (incl. malformed-response handling) in `backend/tests/unit/test_anthropic_judge.py`
- [X] T008 [P] [US1] Unit test for pipeline aggregation math (chunk/question/answer counts, score averaging, `sampleSize`, `scores: null` when no scored turns) in `backend/tests/unit/test_metrics_service.py`
- [X] T009 [P] [US1] Integration test: ask and generate a Playground answer, confirm a `TurnQualityScore` row is created asynchronously (background task) and is reflected in the pipeline's aggregated scores in `backend/tests/integration/test_evaluation_scoring_pipeline.py`
- [X] T010 [P] [US1] Frontend unit test for `useMetrics` hook (fetches corpora/pipelines, exposes loading/empty/error state) in `frontend/tests/unit/useMetrics.test.ts`
- [X] T011 [P] [US1] Frontend unit test for `MetricsScreen` (renders technique, embedding model, counts, four scores; FR-013 "not enough data" and FR-014 "no pipeline yet" empty states) in `frontend/tests/unit/MetricsScreen.test.tsx`

### Implementation for User Story 1

- [X] T012 [P] [US1] Implement `EvaluationJudge` protocol and `JUDGES` registry dict in `backend/app/evaluation/strategies/base.py`
- [X] T013 [P] [US1] Implement `QualityScores` schema in `backend/app/evaluation/schemas.py`
- [X] T014 [US1] Implement the Anthropic-backed judge (assembles a scoring prompt from question + retrieved chunks + answer, parses the four 0.0–1.0 values) in `backend/app/evaluation/strategies/anthropic_judge.py`, registering into `JUDGES` (depends on T012, T013)
- [X] T015 [US1] Implement `score_turn(db, turn_id)` (persists a `TurnQualityScore`, tolerating judge failure by leaving the turn unscored) and `aggregate_pipeline_scores(db, corpus_id, chunking_strategy, embedding_model)` (mean + sample size) in `backend/app/evaluation/service.py` (depends on T003, T013, T014)
- [X] T016 [US1] Trigger `score_turn()` as a FastAPI `BackgroundTask` from the generate-answer endpoint, after a successful answer commit, in `backend/app/playground/router.py` (depends on T015)
- [X] T017 [P] [US1] Implement metrics response schemas (`CorpusSummary`, `PipelineSummary`, `ScopeBreakdown`, `ScoreSummary`) in `backend/app/metrics/schemas.py`
- [X] T018 [US1] Implement `list_corpora_summary(db)` (per-corpus distinct chunking techniques + `hasPipelines`) and `list_pipelines(db, corpus_id)` (chunk count, embedding model, question/answer counts, scope breakdown, aggregated scores per `(chunking_strategy, embedding_model)` pipeline) in `backend/app/metrics/service.py` (depends on T003, T015, T017)
- [X] T019 [US1] Implement `GET /api/metrics/corpora` and `GET /api/metrics/corpora/{corpusId}/pipelines` in `backend/app/metrics/router.py`, and register the router in `backend/app/main.py` (depends on T018)
- [X] T020 [P] [US1] Implement `fetchCorpora()`/`fetchPipelines()` in `frontend/src/lib/metricsApi.ts`
- [X] T021 [US1] Implement `useMetrics` hook (loads the corpora list, loads the selected corpus's pipelines, loading/empty/error state) in `frontend/src/hooks/useMetrics.ts` (depends on T020)
- [X] T022 [US1] Implement `MetricsScreen` (corpus list, and — for the selected corpus's first/only pipeline — chunking technique, embedding model, question/answer counts, four quality scores, FR-013/FR-014 empty states) in `frontend/src/components/metrics/MetricsScreen.tsx` (depends on T021)
- [X] T023 [US1] Wire `MetricsScreen` into the app's screen routing in `frontend/src/app/App.tsx` (depends on T022, T004)

**Checkpoint**: User Story 1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Switch between chunking techniques for a corpus (Priority: P1)

**Goal**: When a corpus has saved chunks from more than one chunking technique, a technique
selector lets the user switch which technique/embedding-model pipeline's data is displayed.

**Independent Test**: Save chunks for the same corpus under two chunking techniques; open the
Metrics screen; switch the selector between them; confirm embedding model, counts, and scores
update to match each selection.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T024 [P] [US2] Frontend unit test for `PipelineSelector` (hidden/single-option when the corpus has one technique; lists and selects among techniques when there are ≥2) in `frontend/tests/unit/PipelineSelector.test.tsx`
- [X] T025 [P] [US2] Frontend integration test: selecting a different technique on `MetricsScreen` updates the displayed embedding model, counts, and scores in `frontend/tests/integration/MetricsScreen.test.tsx`

### Implementation for User Story 2

- [X] T026 [P] [US2] Implement `PipelineSelector` (renders the pipelines already fetched by `useMetrics`; no switcher needed when only one) in `frontend/src/components/metrics/PipelineSelector.tsx`
- [X] T027 [P] [US2] Extract the technique/embedding-model/counts/scores display into a `ScoreSummary` component in `frontend/src/components/metrics/ScoreSummary.tsx`
- [X] T028 [US2] Wire `PipelineSelector` and `ScoreSummary` into `MetricsScreen`, tracking the selected pipeline and re-rendering on change (SC-002: under 2 seconds, purely client-side since all pipelines are already fetched) in `frontend/src/components/metrics/MetricsScreen.tsx` (depends on T026, T027, T022)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Compare all pipelines for a corpus side by side (Priority: P2)

**Goal**: A "Compare" action opens a modal listing every technique/embedding-model pipeline for a
corpus at once, each with its own chunk count, question/answer counts, and quality scores.

**Independent Test**: With a corpus that has ≥2 pipelines, click "Compare"; confirm the modal
shows one row/card per pipeline with all figures; confirm the action is disabled/hidden for a
corpus with only one pipeline; confirm closing the modal restores the prior single-pipeline view.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T029 [P] [US3] Contract test for `GET /api/metrics/corpora/{corpusId}/compare` (full comparison payload; 400 when fewer than 2 pipelines; 404 for unknown corpus) in `backend/tests/contract/test_metrics_compare.py`
- [X] T030 [P] [US3] Frontend unit test for `ComparisonModal` (one entry per pipeline; correctly reflects each pipeline's own figures) in `frontend/tests/unit/ComparisonModal.test.tsx`

### Implementation for User Story 3

- [X] T031 [US3] Implement `GET /api/metrics/corpora/{corpusId}/compare` (reuses `list_pipelines` from T018, returns 400 when the corpus has fewer than 2 pipelines) in `backend/app/metrics/router.py` (depends on T018, T019)
- [X] T032 [P] [US3] Implement `fetchComparison()` in `frontend/src/lib/metricsApi.ts` (depends on T020)
- [X] T033 [US3] Implement `ComparisonModal` (one row/card per pipeline: technique, embedding model, chunk count, question/answer counts, four scores) in `frontend/src/components/metrics/ComparisonModal.tsx` (depends on T032)
- [X] T034 [US3] Add the "Compare" action to `MetricsScreen` — enabled only when the corpus has ≥2 pipelines, opens `ComparisonModal`, and restores the previously selected pipeline on close — in `frontend/src/components/metrics/MetricsScreen.tsx` (depends on T033, T028)

**Checkpoint**: User Stories 1, 2, and 3 all work independently.

---

## Phase 6: User Story 4 - Ask a question against an entire corpus and see the scope reflected (Priority: P2)

**Goal**: The Playground gains an "Entire Corpus" question scope alongside the existing
per-document scope; the Metrics screen's question/answer counts correctly split by scope.

**Independent Test**: In the Playground, select "Entire Corpus", ask and generate an answer,
confirm retrieved chunks can span multiple documents; return to the Metrics screen and confirm the
scope breakdown now counts that question under "Entire Corpus".

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

- [X] T035 [P] [US4] Unit test for `CosineSimilarityStrategy.search_corpus` (global top-K ranking across a corpus's documents, not top-K per document) in `backend/tests/unit/test_cosine_similarity_corpus.py`
- [X] T036 [P] [US4] Contract test for the `corpusId`-scoped `GET /api/playground/context` in `backend/tests/contract/test_playground_corpus_scope.py`
- [X] T037 [P] [US4] Contract test for the `corpusId`-scoped `POST /api/playground/turns` (incl. the mutual-exclusivity and no-saved-embeddings validation errors) in `backend/tests/contract/test_playground_corpus_scope.py`
- [X] T038 [P] [US4] Contract test for the `corpusId`-scoped `GET /api/playground/turns` (`scope`, `corpusId`, `chunks[].documentId` fields present and correct) in `backend/tests/contract/test_playground_corpus_scope.py`
- [X] T039 [P] [US4] Integration test: an entire-corpus question retrieves chunks from more than one document and persists with `scope="corpus"` in `backend/tests/integration/test_corpus_wide_retrieval.py`
- [X] T040 [P] [US4] Integration test: after an entire-corpus question and a document-scoped question both exist, the Metrics screen's pipeline data reports both in `scopeBreakdown` in `backend/tests/integration/test_metrics_aggregation.py`
- [X] T041 [P] [US4] Frontend unit test for the Playground question-scope selector (Entire Corpus vs. individual document) in `frontend/tests/unit/PlaygroundScopeSelector.test.tsx`

### Implementation for User Story 4

- [X] T042 [US4] Add `search_corpus(db, corpus_id, model, query_vector, limit)` to the `RetrievalStrategy` protocol in `backend/app/retrieval/strategies/base.py` and implement it in `backend/app/retrieval/strategies/cosine_similarity.py` (global cosine ranking across every document linked to the corpus) (depends on T035)
- [X] T043 [P] [US4] Extend Playground schemas — `scope`, `corpusId`, `documentId: str | None` on `TurnOut`, `chunks[].documentId`, and `corpusId` accepted alongside `documentId` on the context/create-turn requests — in `backend/app/playground/schemas.py`
- [X] T044 [US4] Extend `get_context`, `create_turn`, and `list_turns` to accept `corpusId` as an alternative to `documentId` (mutually exclusive), use `search_corpus` for corpus-scoped turns, and persist `scope`/`corpus_id`/each retrieved chunk's `document_id` snapshot in `backend/app/playground/service.py` (depends on T003, T042, T043)
- [X] T045 [US4] Extend the context/turns endpoints to accept `corpusId` in `backend/app/playground/router.py` (depends on T044)
- [X] T046 [P] [US4] Extend `frontend/src/lib/playgroundApi.ts` to support asking against a `corpusId` (depends on T045)
- [X] T047 [US4] Add a question-scope selector (Entire Corpus vs. individual document) to the Playground UI in `frontend/src/components/playground/` (depends on T046)
- [X] T048 [US4] Update `usePlaygroundConversation` to carry the selected scope through context/ask/list calls in `frontend/src/hooks/usePlaygroundConversation.ts` (depends on T046, T047)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across all four stories together

- [X] T049 [P] Add an e2e test covering quickstart.md Scenarios 1–4 (view scores, switch technique, compare modal, entire-corpus question) in `frontend/tests/e2e/metrics.spec.ts`
- [X] T050 Run `quickstart.md` validation end-to-end (including the documented local database reset via `docker compose down -v`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; its selector UI (T026–T028) builds on US1's `MetricsScreen`/`useMetrics` (T021, T022) but the endpoint it consumes (`GET .../pipelines`) is unchanged from US1 — reuses rather than duplicates
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's `list_pipelines`/`metricsApi.ts`/`MetricsScreen` (T018, T020, T022) and US2's selected-pipeline state (T028)
- **User Story 4 (Phase 6)**: Depends on Foundational only for its own read/write path (T003's `scope`/`corpus_id` columns); does not require US2/US3 to be built first — independently testable via the Playground and a direct API/DB check even before US2/US3 exist
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories — the MVP
- **US2 (P1)**: Functionally layers a selector on top of US1's already-fetched pipeline data; US1 must be built first for US2's UI to have something to wire into, but US2 introduces no new backend contract
- **US3 (P2)**: Layers a comparison view on top of US1's pipeline data and US2's selected-pipeline state; built after both
- **US4 (P2)**: Independent of US2/US3 — only requires the Foundational schema and US1's read-side metrics endpoints to have somewhere to show its data; could be implemented in parallel with US2/US3 by a different developer

### Within Each User Story

- Tests are written first and MUST fail before implementation begins
- Schemas before services; services before routers/endpoints; backend before the frontend API client that calls it; API client before hooks; hooks before screen components
- Story complete (checkpoint) before moving to the next priority, unless working in parallel per the Parallel Team Strategy below

### Parallel Opportunities

- T001 and T002 (Setup) run in parallel
- T003 and T004 (Foundational) run in parallel — different files, unrelated concerns
- All 7 US1 test tasks (T005–T011) run in parallel — 7 different files
- Within US1 implementation: T012/T013/T017/T020 run in parallel (independent files); the rest form a dependency chain as noted per-task
- Both US2 test tasks (T024, T025) run in parallel; T026/T027 (US2 impl) run in parallel
- Both US3 test tasks (T029, T030) run in parallel; T032 runs in parallel with T029/T030
- All 7 US4 test tasks (T035–T041) run in parallel — 7 different files; T043/T046 run in parallel with adjacent independent-file tasks
- **Once Foundational (Phase 2) is done, US4 can be staffed in parallel with US1/US2/US3** since it shares no implementation files with them (only the Foundational schema)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Contract test for GET /api/metrics/corpora in backend/tests/contract/test_metrics_corpora.py"
Task: "Contract test for GET /api/metrics/corpora/{corpusId}/pipelines in backend/tests/contract/test_metrics_pipelines.py"
Task: "Unit test for Anthropic evaluation judge in backend/tests/unit/test_anthropic_judge.py"
Task: "Unit test for pipeline aggregation in backend/tests/unit/test_metrics_service.py"
Task: "Integration test for scoring pipeline in backend/tests/integration/test_evaluation_scoring_pipeline.py"
Task: "Frontend unit test for useMetrics in frontend/tests/unit/useMetrics.test.ts"
Task: "Frontend unit test for MetricsScreen in frontend/tests/unit/MetricsScreen.test.tsx"

# Launch independent-file US1 implementation together:
Task: "Implement EvaluationJudge protocol + registry in backend/app/evaluation/strategies/base.py"
Task: "Implement QualityScores schema in backend/app/evaluation/schemas.py"
Task: "Implement metrics response schemas in backend/app/metrics/schemas.py"
Task: "Implement metricsApi.ts client in frontend/src/lib/metricsApi.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 independently
5. Deploy/demo if ready — a corpus with one chunking technique already shows the full metrics view

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate (quickstart Scenario 1) → deploy/demo (MVP!)
3. Add US2 → validate (quickstart Scenario 2) → deploy/demo
4. Add US3 → validate (quickstart Scenario 3) → deploy/demo
5. Add US4 → validate (quickstart Scenario 4) → deploy/demo
6. Each story adds value without breaking the previous ones

### Parallel Team Strategy

With multiple developers, after Foundational completes:

- Developer A: US1, then US2, then US3 (sequential — each builds on the last's frontend surface)
- Developer B: US4 in parallel (touches `retrieval`/`playground` backend + Playground frontend — no file overlap with A's `evaluation`/`metrics`/Metrics-screen work)
- Merge and run the Phase 7 e2e suite once both tracks reach their checkpoints

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify each test fails before implementing the code that makes it pass
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- The Foundational schema change (T003) requires a local Postgres reset (`docker compose down -v`) before it takes effect, since this project has no ALTER-based migration tooling (research.md §3) — do this once, early, not per-task
