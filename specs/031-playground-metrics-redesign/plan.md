# Implementation Plan: Playground Sequential Flow & Metrics Pipeline List

**Branch**: `031-playground-metrics-redesign` | **Date**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-playground-metrics-redesign/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Two independent frontend-only redesigns, grounded directly against the current implementation:

**Playground (US1)**: Collapse the existing two-panel layout (`ConversationPanel` left /
`RetrievalPanel` right) into one full-width column where each turn renders, in order: question
→ query embedding (already exists, already has show-more/show-less) → retrieved chunks
(already exists, already has show-more/show-less) → answer. The manual "Generate" button goes
away by chaining `usePlaygroundConversation`'s existing `generate(turnId)` call directly onto
`send()`'s success callback, so asking a question is the only step a user takes. The
"select a past turn to inspect the right panel" mechanism (`selectTurn`/`selectedTurnId`) is
removed entirely since every turn now always shows its own full detail inline — there is
nothing left to select into.

**Metrics (US2)**: Replace `MetricsScreen`'s own corpus-selection list (fetched via
`fetchCorpora()`/`GET /api/metrics/corpora`) with the app-wide active corpus from
`useCorpus()`, matching every other screen. Replace the single-pipeline
`PipelineSelector`-then-`ScoreSummary` pattern with always rendering `ScoreSummary` for every
pipeline `fetchPipelines(activeCorpusId)` returns, as a list. Per the `/speckit-clarify`
session, the existing `ComparisonModal`/"Compare" button is kept unchanged as a secondary
action — not removed, not the new default view.

## Technical Context

**Language/Version**: TypeScript 5 / React 19 (existing `frontend/` app, Vite build)

**Primary Dependencies**: None new. Reuses `usePlaygroundConversation`'s existing `send`/
`generate` calls (`frontend/src/hooks/usePlaygroundConversation.ts`), `RetrievalPanel`'s
existing query-embedding and chunk show-more/show-less UI (to be inlined per-turn rather than
shown once for a selected turn), and Metrics' existing `fetchPipelines`/`ScoreSummary`/
`ComparisonModal` (`frontend/src/components/metrics/`, `frontend/src/lib/metricsApi.ts`).

**Storage**: N/A — no schema change. Every data point involved (turns, query embeddings,
chunks, answers, pipelines, quality scores) is already persisted and already fetched by
existing endpoints; this feature only changes how the already-fetched data is laid out and
which existing client calls fire automatically vs. on manual click.

**Testing**: Vitest (`frontend/tests/unit`, `frontend/tests/integration`) and Playwright
(`frontend/tests/e2e`), matching the existing suites: `usePlaygroundConversation.test.ts`,
`PlaygroundScreen.test.tsx`, `PlaygroundScopeSelector.test.tsx`, `playground.spec.ts`,
`useMetrics.test.ts`, `MetricsScreen.test.tsx` (unit + integration), `metrics.spec.ts`.

**Target Platform**: Web (existing React SPA), same browser support envelope as the rest of
the frontend.

**Project Type**: Web application (existing `frontend/` + `backend/` structure) — this
feature is frontend-only; no backend route, schema, or contract changes for either screen.

**Performance Goals**: N/A beyond existing expectations. Auto-chaining `generate()` onto
`send()` does not add a new network call — it removes the wait for a manual click between two
calls that already both happen for every fully-answered turn today.

**Constraints**: Must not change the backend `createTurn`/`generateAnswer`/`fetchPipelines`/
`fetchComparison` contracts (`contracts/playground-api.md` from 016/017,
`contracts/metrics-api.md` from 019) — every behavior change is achieved by re-orchestrating
and re-laying-out existing client calls, not new backend surface. The `ComparisonModal`/
Compare action must remain functionally unchanged (FR-015).

**Scale/Scope**: Two screens (`PlaygroundScreen.tsx`, `MetricsScreen.tsx`), each substantially
restructured but reusing existing sub-components/hooks; `TurnBubble.tsx` and `RetrievalPanel.tsx`
are merged into one per-turn presentation; `ConversationPanel.tsx` is retired in favor of that
merged component plus the existing question input, moved to the bottom of the single column
(matching the existing chat-style "input pinned below the growing history" pattern).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: N/A — no ingestion/chunking/embedding/retrieval/
  generation pipeline stage is touched; both screens only change how already-computed
  results are displayed and sequenced. PASS.
- **II. Test-First, Test at Every Level**: Plan includes updating/extending unit coverage for
  `usePlaygroundConversation` (auto-chained generate, removed `selectTurn`), new unit coverage
  for the merged per-turn presentation component, updated `PlaygroundScreen`/`MetricsScreen`
  integration tests for the new layouts, and updated e2e coverage in `playground.spec.ts`/
  `metrics.spec.ts`. PASS (see tasks.md for the test-first breakdown).
- **III. Multi-User Simplicity**: N/A — no change to corpus/document/turn/pipeline ownership
  or access control; both screens already scope to the requesting user's own corpora via
  existing auth and `useCorpus()`. PASS.
- **IV. Fixed Technology Stack**: No new dependency, no backend/database/vector-store change;
  stays within the existing React frontend calling existing backend endpoints. PASS.
- **V. Experiment Observability & Reproducibility**: Directly reinforced, not just neutral —
  US2 makes every RAG pipeline's recorded configuration and quality scores simultaneously
  visible and comparable for a corpus, which is this principle's exact stated purpose. PASS.

No violations — Complexity Tracking section is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/031-playground-metrics-redesign/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — N/A, no backend/API change
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── hooks/
│   │   └── usePlaygroundConversation.ts    # US1: send() auto-chains generate(); selectTurn/
│   │                                        #   selectedTurnId removed
│   ├── components/
│   │   ├── playground/
│   │   │   ├── PlaygroundScreen.tsx        # US1: single-column layout, no right pane
│   │   │   ├── ConversationPanel.tsx       # US1: retired — question input + turn history
│   │   │   │                               #   move directly into PlaygroundScreen/new component
│   │   │   ├── RetrievalPanel.tsx          # US1: retired as a standalone side panel — its
│   │   │   │                               #   embedding-preview and chunk-list rendering
│   │   │   │                               #   logic moves into the new per-turn component
│   │   │   ├── TurnBubble.tsx              # US1: superseded by the new per-turn component
│   │   │   │                               #   (question + embedding + chunks + answer)
│   │   │   └── PlaygroundTurnDetail.tsx    # US1: new — one turn's full sequence, reusing
│   │   │                                   #   RetrievalPanel's embedding/chunk rendering
│   │   │                                   #   patterns and TurnBubble's answer rendering
│   │   └── metrics/
│   │       ├── MetricsScreen.tsx           # US2: reads useCorpus() instead of its own corpus
│   │       │                               #   list; renders ScoreSummary per pipeline in a list
│   │       ├── PipelineSelector.tsx        # US2: retired — no more single-pipeline switching
│   │       ├── ScoreSummary.tsx            # US2: unchanged — reused once per pipeline
│   │       └── ComparisonModal.tsx         # US2: unchanged (FR-015 — kept as secondary action)
│   └── lib/
│       ├── playgroundApi.ts                # unchanged — createTurn/generateAnswer reused as-is
│       └── metricsApi.ts                   # US2: fetchCorpora()/CorpusSummary no longer called
│                                            #   from MetricsScreen; fetchPipelines/fetchComparison
│                                            #   reused as-is
└── tests/
    ├── unit/
    │   ├── usePlaygroundConversation.test.ts   # extended: auto-chain, selectTurn removal
    │   ├── PlaygroundTurnDetail.test.tsx       # new
    │   ├── PlaygroundScreen.test.tsx           # extended: single-column layout
    │   ├── PlaygroundScopeSelector.test.tsx    # unchanged
    │   ├── useMetrics.test.ts                  # extended/simplified: no corpus-list fetching
    │   └── MetricsScreen.test.tsx              # extended: pipeline list, no corpus picker
    ├── integration/
    │   └── MetricsScreen.test.tsx              # extended
    └── e2e/
        ├── playground.spec.ts                  # extended: sequential flow, no Generate click
        └── metrics.spec.ts                     # extended: pipeline list, Compare still works

backend/    # untouched — no route, schema, or contract changes for either screen
```

**Structure Decision**: Existing web application layout (`frontend/` + `backend/`). Both
screens are restructured within the existing `frontend/` component tree. Playground merges
`ConversationPanel`/`RetrievalPanel`/`TurnBubble` into a single new `PlaygroundTurnDetail`
component rendered once per turn in one column, and the hook gains auto-chained generation.
Metrics drops its own corpus list in favor of the shared `useCorpus()` context (already used
by every other screen) and replaces `PipelineSelector`'s single-pipeline switch with rendering
every pipeline's existing `ScoreSummary` in a list; `ComparisonModal` is untouched per FR-015.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

N/A — no Constitution Check violations.
