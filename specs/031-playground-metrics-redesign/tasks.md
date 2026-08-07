# Tasks: Playground Sequential Flow & Metrics Pipeline List

**Input**: Design documents from `/specs/031-playground-metrics-redesign/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included at unit, integration, and e2e levels for both user
stories, written (or rewritten, where existing coverage targets now-removed behavior) before
the implementation that makes them pass.

**Organization**: Tasks are grouped by user story. User Story 1 (Playground) and User Story 2
(Metrics) touch entirely separate screens/components/hooks with zero file overlap, so they are
fully independent and can be implemented in either order or in parallel by different people.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Web app: `frontend/src/`, `frontend/tests/` (this feature is frontend-only; `backend/` is
untouched — see plan.md Summary and research.md).

---

## Phase 1: Setup

No setup tasks are required — no new dependency, build tooling, or test infrastructure. Both
stories reuse existing components, hooks, and test patterns already established in this
codebase.

## Phase 2: Foundational

No foundational/blocking tasks are required. User Story 1 and User Story 2 are fully
independent (different screens, different files) — proceed directly to whichever you want
first.

---

## Phase 3: User Story 1 - Ask a question and read everything in one sequential flow (Priority: P1) 🎯 MVP

**Goal**: Replace Playground's two-panel layout with one full-width column where each turn
shows, in order, its question, query embedding, retrieved evidence, and answer — with no
manual "Generate" step.

**Independent Test**: Open the Playground screen, ask a single question, and confirm the
question, its embedding preview, its retrieved evidence, and its final answer all appear as
one continuous, full-width sequence with no separate side panel and no manual step required to
see the answer.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T001 [P] [US1] Rewrite `frontend/tests/unit/usePlaygroundConversation.test.ts`: update
      the "appends a new turn" test to also assert an answer eventually appears on that turn
      with no explicit `generate()` call; add a test asserting `generate` fires automatically
      (exactly once, with the new turn's id) immediately after a successful `send()`; update
      the "records an error on generate fails" test to trigger via the auto-chain (send, not a
      manual `generate()` call) and still assert the turn's `error` is set with `answer` null
      and `isBusy` false afterward; delete the entire `describe('usePlaygroundConversation —
      turn selection (017 US2)', ...)` block (3 tests) since `selectTurn`/`selectedTurnId` are
      being removed from the hook.
- [X] T002 [P] [US1] New unit tests `frontend/tests/unit/PlaygroundTurnDetail.test.tsx`: given
      a `Turn`, renders question, then a collapsed query-embedding preview with a working show
      more/show less, then retrieved chunks (each collapsed by default with its own show
      more/show less), then the answer — in that top-to-bottom order; shows a "Generating…"
      state and no answer while `isGenerating`; shows the failure message and a retry control
      (calling `onRetry`) when `turn.error` is set and `answer` is null; renders no button
      anywhere labeled "Generate".
- [X] T003 [P] [US1] Rewrite `frontend/tests/unit/PlaygroundScreen.test.tsx`: replace the
      `describe('PlaygroundScreen — split layout shell (017 FR-001)', ...)` test (which asserts
      `playground-conversation-panel`/`playground-retrieval-panel` both exist) with a test
      asserting a single full-width column testid exists and neither old testid does; delete
      every Generate-button-specific test (`calls generate() with the active turn id when
      Generate is clicked`, `disables Generate while a request is in flight`, `disables
      Generate when the active turn has no retrieved chunks`) since no Generate button exists
      anymore; delete the turn-selection tests inside `describe('PlaygroundScreen — inspect
      retrieved chunks and query embedding (017 US2)', ...)` (`defaults the right panel to the
      newest turn`, `shows the explicitly selected turn`, `calls selectTurn() ... when a past
      answer is clicked`); keep and adapt the per-chunk and embedding show-more/show-less
      tests to assert against a rendered turn's own controls (via `PlaygroundTurnDetail`)
      rather than a single right-panel selection; keep the `describe('PlaygroundScreen —
      playground context display', ...)` block unchanged (chunking strategy/embedding model
      header is unaffected by this redesign).
- [X] T004 [P] [US1] Delete `frontend/tests/unit/TurnBubble.test.tsx` (its component is being
      superseded by `PlaygroundTurnDetail`, see T009) and, in
      `frontend/tests/unit/PlaygroundScopeSelector.test.tsx`, remove the now-nonexistent
      `selectedTurnId`/`selectTurn` fields from its mocked `usePlaygroundConversation` return
      shape.
- [X] T005 [P] [US1] Rewrite `frontend/tests/e2e/playground.spec.ts`: delete the `US2:
      revisiting an earlier turn shows its own retrieved chunks in the right panel` test
      entirely (the feature it covers is removed); in every remaining test, replace `await
      page.getByRole('button', { name: 'Generate' }).click()` sequences with an assertion that
      the answer (or its terminal error+retry state) appears automatically after `Send`, with
      no Generate click; keep the Markdown-rendering and conversation-persistence assertions,
      adapted the same way.

### Implementation for User Story 1

- [X] T006 [US1] In `frontend/src/hooks/usePlaygroundConversation.ts`: in `send`'s
      `createTurn(...).then(...)` callback, after `setTurns((prev) => [...prev, turn])`, call
      `generate(turn.id)` directly instead of leaving it to a separate manual trigger; remove
      `selectedTurnId` state, the `selectTurn` callback, and both from the
      `UsePlaygroundConversation` interface and the hook's returned object. (depends on T001
      failing first)
- [X] T007 [US1] Create `frontend/src/components/playground/PlaygroundTurnDetail.tsx`: a new
      component taking one `Turn` plus `isBusy`/`isGenerating`/`onRetry` (the props `TurnBubble`
      and `RetrievalPanel` already take today), rendering in order: the question (from
      `TurnBubble`'s existing bubble markup), the query-embedding preview (from
      `RetrievalPanel`'s existing `EMBEDDING_COLUMNS`/`EMBEDDING_PREVIEW_ROWS` logic, now scoped
      to this one turn — a plain `embeddingExpanded` boolean instead of a
      `expandedEmbeddingTurns` set keyed by turn id), the retrieved chunk list (from
      `RetrievalPanel`'s existing per-chunk `expandedChunks` logic, now scoped to this turn),
      and the answer/generating/error+retry block (from `TurnBubble`'s existing rendering) —
      with no "Generate" button anywhere. (depends on T002 failing first)
- [X] T008 [US1] Rewrite `frontend/src/components/playground/PlaygroundScreen.tsx`: replace the
      two `w-1/2` panel `div`s with one full-width column rendering
      `turns.map((turn) => <PlaygroundTurnDetail key={turn.id} turn={turn} ... />)`; move the
      question input + Send button (from the old `ConversationPanel`) to the bottom of this
      column, pinned below the growing history, matching the existing chat-input pattern;
      remove `activeTurn`/`newestTurn`/`selectedTurnId`-derived logic and the `handleGenerate`
      wiring that only existed for the manual Generate button (generation is now automatic via
      T006). (depends on T003 failing first, T006, T007)
- [X] T009 [US1] Delete `frontend/src/components/playground/ConversationPanel.tsx`,
      `frontend/src/components/playground/RetrievalPanel.tsx`, and
      `frontend/src/components/playground/TurnBubble.tsx` (all superseded by
      `PlaygroundTurnDetail` + the question input now living directly in `PlaygroundScreen`).
      (depends on T008)

**Checkpoint**: User Story 1 is fully functional and independently testable — run T001-T005 to
confirm green. This alone delivers the full Playground redesign.

---

## Phase 4: User Story 2 - See every RAG pipeline's quality metrics at a glance, for the active corpus only (Priority: P2)

**Goal**: Metrics always reflects the app-wide active corpus (no in-screen picker) and lists
every one of that corpus's RAG pipelines with its own four quality metrics simultaneously; the
existing Compare action stays, unchanged, as a secondary view (FR-015).

**Independent Test**: Make a corpus active from the Corpora section, open the Metrics screen,
and confirm it shows every one of that corpus's RAG pipelines as a list, each with its own four
quality metrics, with no corpus-switching control present on the Metrics screen itself.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US2] Rewrite `frontend/tests/unit/useMetrics.test.ts`: remove the
      `corpora`/`isLoadingCorpora`/`corporaError`-related tests (`loads the corpora list on
      mount`, `reports a corpora-fetch error`) entirely — the hook only fetches pipelines for
      the given `corpusId` going forward; keep and adapt `loads pipelines for the selected
      corpus` and `clears pipelines when no corpus is selected` (`useMetrics(null)` still
      yields `pipelines: []`, no network call).
- [X] T011 [P] [US2] Rewrite `frontend/tests/unit/MetricsScreen.test.tsx`: remove
      `corpora`/`isLoadingCorpora`/`corporaError` from `mockState()`'s shape entirely; delete
      the `shows an empty-corpora message when there are no corpora at all` and `shows a
      loading state while corpora are loading` tests (no longer this screen's concern); update
      `shows a no-pipeline message for a corpus with no saved chunks` to derive purely from
      `mockState({ pipelines: [] })` (no `hasPipelines`/`corpora` field needed); add a new test
      rendering `mockState({ pipelines: [makePipeline(), makePipeline({ chunkingStrategy:
      'semantic', scores: null })] })` and asserting both pipelines' technique names and both
      their score/no-score states are simultaneously visible with zero clicks; keep the two
      Compare-button tests unchanged (FR-015) other than scoping their pipeline lookups if the
      list rendering requires it.
- [X] T012 [P] [US2] Rewrite `frontend/tests/integration/MetricsScreen.test.tsx`: remove the
      `GET /api/metrics/corpora` (plain, no id) stub route from `stubFetch` (no longer called);
      keep `GET /api/metrics/corpora/corpus-a/pipelines`; replace the
      `describe('MetricsScreen technique switching ...)'` test's `pipeline-selector` click
      sequence with an assertion that, on load, both `fixed-size` and `semantic` pipeline
      entries are visible at once (technique name, question count, and their respective
      scores/`metrics-no-scores` state), with no selector interaction at all.
- [X] T013 [P] [US2] Delete `frontend/tests/unit/PipelineSelector.test.tsx` (its component is
      being deleted, see T017).
- [X] T014 [P] [US2] Update `frontend/tests/e2e/metrics.spec.ts`: replace the
      `page.getByTestId('metrics-corpus-list').getByText(corpusName).click()` steps with
      switching the active corpus via the Corpora screen (matching the pattern already
      established in `corpora-management.spec.ts`'s `switchToCorpus` helper) before navigating
      to Metrics; assert the corpus's pipeline(s) and their four metrics are shown with no
      in-screen corpus-picker element present.

### Implementation for User Story 2

- [X] T015 [US2] Simplify `frontend/src/hooks/useMetrics.ts`: remove the `corpora`/
      `isLoadingCorpora`/`corporaError` state and the `fetchCorpora()`-backed `useEffect`
      entirely; the hook keeps its existing `useMetrics(corpusId: string | null)` signature
      (no caller-facing change needed) but now only performs the pipelines fetch, returning
      `{ pipelines, isLoadingPipelines, pipelinesError }`. (depends on T010 failing first)
- [X] T016 [US2] Rewrite `frontend/src/components/metrics/MetricsScreen.tsx`: replace
      `selectedCorpusId` state and the corpus-picker `<ul data-testid="metrics-corpus-list">`
      with `activeCorpusId` from `useCorpus()`; remove `selectedPipelineIndex` and the
      `PipelineSelector` usage; render every entry in `pipelines` as its own `<ScoreSummary
      pipeline={pipeline} />`, each wrapped in a container carrying a unique per-pipeline
      testid (e.g. `` `metrics-pipeline-${pipeline.chunkingStrategy}-${pipeline.embeddingModel}` ``)
      so list entries stay individually queryable now that `ScoreSummary`'s internal testids
      repeat once per pipeline; derive the "no pipeline established yet" empty state from
      `pipelines.length === 0` once loading finishes (not from the removed `hasPipelines`
      flag); keep the "Select or create a corpus first" fallback for `activeCorpusId === null`
      matching every other screen's existing pattern (e.g. `GoldenDatasetScreen.tsx`); leave
      the Compare button and `ComparisonModal` wiring untouched (FR-015). (depends on T011,
      T012 failing first; T015)
- [X] T017 [US2] Delete `frontend/src/components/metrics/PipelineSelector.tsx` (superseded by
      T016's list rendering). (depends on T016)

**Checkpoint**: Both user stories are independently functional — run T010-T014 to confirm
green, then the full quickstart.md validation below.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across both stories.

- [X] T018 [P] Grep the `frontend/src` and `frontend/tests` trees for any remaining reference
      to `ConversationPanel`, `RetrievalPanel`, `TurnBubble`, `PipelineSelector`, `selectTurn`,
      `selectedTurnId`, `corpora` (on `useMetrics`'s return shape), `isLoadingCorpora`,
      `corporaError`, or `hasPipelines` (from `CorpusSummary`) outside of `metricsApi.ts`/
      `types/metrics.ts` themselves (left alone per research.md — only the frontend call site
      is removed, not the API client function/types) — confirm none remain, fixing any missed
      spot.
- [X] T019 Run `cd frontend && npm run test` and
      `npm run test:e2e -- playground.spec.ts metrics.spec.ts` per quickstart.md and confirm
      all suites pass, including unrelated pre-existing coverage that happens to render
      Playground/Metrics indirectly (e.g. `App.test.tsx`, navigation tests) — regression check.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational (Phases 1-2)**: None required — proceed directly to either story.
- **User Story 1 (Phase 3)**: No dependency on User Story 2. Fully independent — different
  screen, different files.
- **User Story 2 (Phase 4)**: No dependency on User Story 1. Fully independent.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within Each User Story

- Tests MUST be written/rewritten and FAIL before implementation.
- US1: hook change (T006) and the new `PlaygroundTurnDetail` component (T007) before
  `PlaygroundScreen` is rewritten to use them (T008); old components deleted only after nothing
  references them (T009).
- US2: hook simplification (T015) before `MetricsScreen` is rewritten to rely on
  `useCorpus()`/the new list rendering (T016); `PipelineSelector` deleted only after
  `MetricsScreen` no longer imports it (T017).
- Story complete (all its tasks done, its tests green) before moving to the next priority.

### Parallel Opportunities

- T001-T005 (US1 tests) can run in parallel — different files.
- T010-T014 (US2 tests) can run in parallel — different files.
- User Story 1 (Phase 3) and User Story 2 (Phase 4) can be worked on entirely in parallel by
  different people — zero file overlap between them.
- T018 can run in parallel with starting T019, though running T019 last is recommended so it
  validates whatever T018 fixed.

---

## Parallel Example: User Story 1 tests

```bash
Task: "Rewrite usePlaygroundConversation.test.ts for auto-chained generate, remove turn-selection tests"
Task: "New PlaygroundTurnDetail.test.tsx"
Task: "Rewrite PlaygroundScreen.test.tsx for single-column layout, remove Generate/selection tests"
Task: "Delete TurnBubble.test.tsx, fix PlaygroundScopeSelector.test.tsx's mocked hook shape"
Task: "Rewrite playground.spec.ts for auto-generate, remove turn-selection e2e test"
```

## Parallel Example: User Story 2 tests

```bash
Task: "Rewrite useMetrics.test.ts, removing corpora-fetch tests"
Task: "Rewrite MetricsScreen.test.tsx (unit) for pipeline-list rendering"
Task: "Rewrite MetricsScreen.test.tsx (integration) for pipeline-list rendering"
Task: "Delete PipelineSelector.test.tsx"
Task: "Update metrics.spec.ts to switch corpus via the Corpora screen"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (T001-T009).
2. **STOP and VALIDATE**: Run T001-T005, then manually verify via quickstart.md steps 1-4.
3. This alone delivers the full Playground redesign — the larger, more visible of the two asks.

### Incremental Delivery

1. User Story 1 → Test independently → this is the MVP.
2. User Story 2 → Test independently → adds the Metrics pipeline list on top, fully
   independent of US1.
3. Polish → full regression pass (T018-T019).

### Parallel Team Strategy

With two developers: one takes User Story 1 (Playground) end to end, the other takes User
Story 2 (Metrics) end to end — no coordination needed between them until Polish.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- This feature deletes more code than it adds in several places (`ConversationPanel`,
  `RetrievalPanel`, `TurnBubble`, `PipelineSelector`, and their dedicated test files) — that is
  expected and correct per research.md's decisions, not a sign of incomplete work.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at either checkpoint to validate that story independently.
