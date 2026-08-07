# Data Model: Playground Sequential Flow & Metrics Pipeline List

No new persisted entities, database columns, or API payload shapes — both screens are display
and orchestration changes over data that's already fetched today. The existing types
(`frontend/src/types/playground.ts`'s `Turn`, `frontend/src/types/metrics.ts`'s
`PipelineSummary`) are reused unchanged.

## Existing types reused (unchanged)

| Type | Used for | Relevant fields for this feature |
|------|----------|-----------------------------------|
| `Turn` | Each rendered question/answer sequence (`PlaygroundTurnDetail`) | `question`, `queryEmbedding`, `chunks`, `answer`, `error` — every field the new merged component needs already exists |
| `PipelineSummary` | Each rendered list entry (`ScoreSummary`, looped) | `chunkingStrategy`, `embeddingModel`, `retrievalStrategy`, `generationLlm`, `judgeLlm`, `scores` — the pipeline's identity and its four metrics, already exactly as needed |

## Removed client-side (component/hook) state

Not persisted; these are React state/props being deleted, not data model changes.

### `usePlaygroundConversation`

| Removed | Was for | Why it goes away |
|---------|---------|-------------------|
| `selectedTurnId` | Tracking which turn the right panel should show | No right panel exists anymore; every turn always shows its own detail (research.md) |
| `selectTurn(turnId)` | Setting `selectedTurnId` on a past-answer click | Same — nothing left to select into |

### `useMetrics`

| Removed | Was for | Why it goes away |
|---------|---------|-------------------|
| `corpora` | The in-screen corpus-picker list | Replaced by `useCorpus()`'s app-wide `activeCorpusId` (FR-009) |
| `isLoadingCorpora` / `corporaError` | Loading/error state for the above | Same |

`useMetrics`'s signature changes from taking a locally-managed `selectedCorpusId` to simply
being driven by `activeCorpusId` from context; its `pipelines`/`isLoadingPipelines`/
`pipelinesError` outputs are unchanged in shape.

## New client-side (component) state

### `PlaygroundScreen` (existing component)

No new state — `activeTurn`/`newestTurn` selection logic is deleted along with
`selectedTurnId`; `turns` (already existing) is rendered as a full list instead of picking one.

### `PlaygroundTurnDetail` (new component)

Purely presentational — receives one `Turn` plus the existing `isBusy`/`isGenerating`/`onRetry`
props `TurnBubble` and `RetrievalPanel` already take today, and owns the same two pieces of
local expand/collapse state those components already own today, just co-located in one place:

| State | Type | Source |
|-------|------|--------|
| `expandedChunks` | `Set<string>` (chunk ids) | Moved from `RetrievalPanel`, now scoped to this one turn instead of keyed by turn id across turns |
| `embeddingExpanded` | `boolean` | Moved from `RetrievalPanel`'s `expandedEmbeddingTurns`, now a plain boolean since this instance only ever renders one turn |

### `MetricsScreen` (existing component)

| Value | Type | Derivation |
|-------|------|------------|
| `activeCorpusId` | `string \| null` | From `useCorpus()`, replacing the removed `selectedCorpusId` state |

`selectedPipelineIndex` and the `PipelineSelector` it drove are deleted — every pipeline in
`pipelines` renders its own `ScoreSummary` in the list, so there is no "currently selected
pipeline" concept left for the default view (Compare's own pipeline-picking, if any, is
internal to `ComparisonModal` and unchanged).

## Relationships

- Each `PlaygroundTurnDetail` instance is keyed by its `Turn.id`, same as `TurnBubble` is keyed
  today — no relationship changes, just where the rendering happens.
- The Metrics pipeline list has no new relationship to model: it is `pipelines.map(...)`, a
  direct 1:1 render of the array `fetchPipelines(activeCorpusId)` already returns.
