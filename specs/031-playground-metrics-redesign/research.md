# Research: Playground Sequential Flow & Metrics Pipeline List

No `NEEDS CLARIFICATION` items remain — the one open fork (the Compare modal's fate) was
resolved via `/speckit-clarify` before this plan (spec.md's Clarifications section, FR-015).
This document records the findings from the existing codebase that shaped the plan, and the
concrete implementation decisions made for each screen.

## Playground: auto-chaining generate() onto send()

**Investigated**: `frontend/src/hooks/usePlaygroundConversation.ts`.

**Finding**: `send(query)` already calls `createTurn(...)`, which does retrieval synchronously
and returns a `Turn` with `question`, `queryEmbedding`, and `chunks` already populated —
`answer` starts `null`. `generate(turnId)` is a wholly separate call
(`generateAnswer(turnId)`) that fills in `answer`. Both already exist; today's UI just requires
a manual "Generate" click between them.

**Decision**: In `send`'s `.then()` success callback (after `setTurns((prev) => [...prev,
turn])`), call `generate(turn.id)` directly instead of leaving the turn to sit with
`answer: null` until a manual click. Remove the `RetrievalPanel`'s "Generate" button entirely
(FR-005). `isBusy` (already `sendStatus === 'sending' || generatingTurnId !== null`) continues
to gate `Send` exactly as it does today — asking a second question is already blocked while
either retrieval or generation is in flight, so auto-chaining introduces no new concurrency
question (this was the one candidate ambiguity considered and dismissed before the
`/speckit-clarify` session, since the existing behavior already fully determines the answer).

**Rationale**: Zero new network calls, zero new backend surface — the two calls already existed
and already always both fire for a turn that gets fully answered today; this only removes the
manual click in between and lets the second call fire automatically.

**Alternatives considered**:
- **Backend endpoint that does retrieval+generation in one call**: Rejected — would require a
  new backend contract (`contracts/playground-api.md` changes, new tests on the backend) for a
  need that's already fully satisfiable by sequencing two existing frontend calls. Violates the
  "don't add complexity beyond what's needed" default for a feature scoped as UI-only.

## Playground: retiring the two-panel split and the turn-selection mechanism

**Investigated**: `PlaygroundScreen.tsx`, `ConversationPanel.tsx`, `RetrievalPanel.tsx`,
`TurnBubble.tsx`.

**Finding**: Today, `ConversationPanel` (left) renders every turn as a question/answer chat
bubble via `TurnBubble`, with the question input pinned below. `RetrievalPanel` (right) shows
only the *currently selected* turn's query-embedding preview and retrieved chunks, defaulting
to the newest turn; clicking a past answer bubble (`TurnBubble`'s `onSelect`) re-targets the
right panel at that turn instead. This selection mechanism exists specifically because only
one turn's retrieval detail could be shown at a time in the fixed right panel.

**Decision**: Introduce a new `PlaygroundTurnDetail` component, rendered once per turn, that
combines: the question (from `TurnBubble`'s existing bubble markup), the query-embedding
preview and chunk list (from `RetrievalPanel`'s existing rendering, reused as-is), and the
answer/generating/error+retry state (from `TurnBubble`'s existing rendering, reused as-is) — in
that order, per FR-002. `PlaygroundScreen` renders a single scrollable column of these, newest
last, matching the existing turn ordering. `selectTurn`/`selectedTurnId` and the click-to-select
affordance on past answers are removed from the hook and from `TurnBubble`'s rendering
entirely — every turn's detail is now always visible, so there is nothing to "select into"
(per spec Assumptions).

**Rationale**: Reuses 100% of the existing embedding-preview, chunk-list, and answer-rendering
JSX/logic (just relocated and reordered), rather than rewriting any of it — the only genuinely
new code is the component that assembles the pieces in per-turn sequence instead of
split-by-selection.

**Alternatives considered**:
- **Keep `RetrievalPanel` as a separate component, rendered inline per-turn instead of once for
  a selection**: Considered, but `RetrievalPanel` also currently renders the "Generate" button
  and a `turn === null` empty state, both of which no longer apply per-turn (a rendered turn is
  never null, and there's no button to render) — cleaner to fold its remaining
  embedding/chunk-list JSX into the new merged component than to keep an increasingly
  purpose-mismatched component around.

## Metrics: dropping the in-screen corpus picker for the shared active-corpus context

**Investigated**: `MetricsScreen.tsx`, `useMetrics.ts`, `metricsApi.ts`, `CorpusContext.tsx`.

**Finding**: `MetricsScreen` currently fetches its own full corpus list via `fetchCorpora()`
(`GET /api/metrics/corpora`, returning `CorpusSummary[]` with a `hasPipelines` flag per corpus)
and manages its own `selectedCorpusId` state with a corpus-picker list in the left column —
duplicating what `useCorpus()`/`CorpusContext` (the app-wide active-corpus source already used
by every other screen, including the sidebar's own corpus subtitle from
029-pdf-preview-page-count's sibling work) already provides.

**Decision**: Replace `selectedCorpusId` state and the `fetchCorpora()`-backed corpus list with
`activeCorpusId` from `useCorpus()`. `useMetrics` no longer needs to fetch or expose `corpora`/
`isLoadingCorpora`/`corporaError` at all — it only needs `fetchPipelines(activeCorpusId)`.
The "no chunking pipeline established yet" empty state (FR-012) is now derived from
`pipelines.length === 0` once loading finishes, rather than from the separate `hasPipelines`
flag — equivalent in practice (a corpus that's never been chunked has zero pipelines) and
removes a second network call that existed only to support the now-removed picker.

**Rationale**: Matches the established, already-used pattern for "the one active corpus,
selected only from the Corpora section" (FR-009) exactly as every other screen already does it
— no new context, no new API shape, just consuming the existing one instead of a
screen-local duplicate.

**Alternatives considered**:
- **Keep `fetchCorpora()`/`hasPipelines` and just hide the picker UI**: Rejected — would keep
  an unnecessary network call and a `CorpusSummary`/`hasPipelines` distinction that no longer
  serves any purpose once `pipelines.length === 0` already answers the same question directly
  from the data actually needed. `GET /api/metrics/corpora` itself is left alone on the
  backend (out of scope for a frontend-only feature) — only the frontend stops calling it from
  this screen.

## Metrics: pipeline list replaces PipelineSelector, ComparisonModal unchanged

**Investigated**: `PipelineSelector.tsx`, `ScoreSummary.tsx`, `ComparisonModal.tsx`.

**Decision**: Remove `PipelineSelector` (the tab-like single-pipeline switcher) entirely.
`MetricsScreen` instead maps every entry in `pipelines` (already the full list for the active
corpus, from the existing `fetchPipelines` call) to its own `ScoreSummary` render, stacked in
a list (FR-010, FR-011) — `ScoreSummary` itself is reused completely unchanged, since it
already renders one pipeline's full four-metric detail. The existing `ComparisonModal` and its
"Compare" button are kept exactly as they are today (FR-015, per `/speckit-clarify`) — a
secondary, opt-in side-by-side table view, additive to (not replaced by) the new default list.

**Rationale**: `ScoreSummary` was already a per-pipeline, fully self-contained detail view —
rendering it in a loop instead of for a single selected index is a minimal, low-risk change
that reuses the existing component verbatim.

**Alternatives considered**:
- **Build a new, more compact "list row" component instead of reusing full `ScoreSummary` per
  pipeline**: Rejected for this feature's scope — the spec asks for "each pipeline showing the
  4 metrics we are showing already," which `ScoreSummary` already does exactly; a new compact
  layout would be a design change beyond what was requested. Can be revisited later as a
  separate, explicitly-requested visual refinement if the full-detail-per-pipeline list proves
  too long for corpora with many pipelines.

## Non-decisions confirmed by existing code (no new research needed)

- **Query embedding show-more/show-less**: Already exists in `RetrievalPanel.tsx`
  (`EMBEDDING_COLUMNS`/`EMBEDDING_PREVIEW_ROWS`/`expandedEmbeddingTurns`) — reused as-is,
  relocated into the per-turn component (FR-003).
- **Retrieved-evidence show-more/show-less**: Already exists in `RetrievalPanel.tsx`
  (`expandedChunks` keyed by turn id) — reused as-is (FR-004).
- **Answer-generation retry-on-failure**: Already exists in `TurnBubble.tsx` (the `turn.error`
  branch with a "Retry" button calling `onRetry`) — reused as-is, satisfying FR-008 without new
  code beyond relocating it into the merged component.
- **Four quality metrics**: Already exactly `contextPrecision`, `contextRecall`,
  `responseRelevancy`, `faithfulness` on `PipelineSummary.scores`, already rendered by
  `ScoreSummary` — no redefinition needed (FR-011).
- **"No enough data yet" per-pipeline state**: Already exists in `ScoreSummary.tsx`
  (`hasScores`/`metrics-no-scores`) — reused as-is per list item (FR-013).
