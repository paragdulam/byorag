# Quickstart: Validating Playground Sequential Flow & Metrics Pipeline List

No `contracts/` directory — this feature has no backend/API surface change (see
[research.md](./research.md)). Validation is entirely through running the app and its test
suites.

## Prerequisites

- Repo running per the existing project setup (Docker Compose backend + `npm run dev` for
  `frontend/`).
- A corpus with saved chunks and embeddings, and a personal Anthropic key on file (Playground
  and Metrics are both already gated behind one, unchanged by this feature).
- For Metrics US2: a corpus that has been chunked/embedded more than once with different
  settings, so more than one pipeline exists to list (a single-pipeline corpus works too, for
  the "still shown as a list of one" acceptance scenario).

## Automated validation

```bash
cd frontend
npm run test              # unit + integration: usePlaygroundConversation.test.ts,
                           # PlaygroundTurnDetail.test.tsx, PlaygroundScreen.test.tsx,
                           # useMetrics.test.ts, MetricsScreen.test.tsx (unit + integration)
npm run test:e2e -- playground.spec.ts metrics.spec.ts
```

Expected: all new/extended cases pass —
- unit: `send()` auto-invokes `generate()` on the newly created turn with no manual trigger;
  `selectTurn`/`selectedTurnId` no longer exist on the hook's return shape;
  `PlaygroundTurnDetail` renders question → embedding preview → chunks → answer in that order
  for a given `Turn`; `useMetrics` no longer fetches/exposes a corpus list; `MetricsScreen`
  renders one `ScoreSummary` per pipeline with no `PipelineSelector`.
- integration: `PlaygroundScreen` shows no right-pane testid and a single full-width column;
  `MetricsScreen` shows no corpus-picker list and reflects `useCorpus()`'s active corpus.
- e2e: asking a question in Playground shows its full sequence with no Generate click; Metrics
  lists every pipeline for the active corpus with all four metrics visible per entry, and the
  Compare button still opens the existing comparison modal.

## Manual validation (matches spec Acceptance Scenarios)

1. **Playground sequential flow** (User Story 1): Open Playground, ask a question. Confirm the
   screen is one full-width column with no separate side section. Confirm, in order below the
   question: a collapsed query-embedding preview with a working show more/show less, the
   retrieved evidence (same collapsed-by-default behavior as today), then the final answer —
   appearing without clicking anything beyond asking the question itself.
2. **No manual Generate button** (FR-005): Confirm no "Generate" control exists anywhere on the
   screen.
3. **Multiple questions preserved** (Acceptance Scenario 6): Ask a second question. Confirm the
   first question's full sequence (question/embedding/evidence/answer) is still visible,
   unchanged, above or below the new one.
4. **Generation failure retry** (Edge Case / FR-008): Trigger a generation failure (e.g.,
   temporarily break the Anthropic key), confirm the question/embedding/evidence still appear
   with a clear failure message and a retry control that doesn't require re-asking the question.
5. **Metrics — no in-screen corpus picker** (User Story 2 / FR-009): Open Metrics. Confirm
   there is no control on this screen for picking a different corpus, and that it reflects
   whichever corpus is currently active (as set from the Corpora section).
6. **Metrics — pipeline list** (FR-010/FR-011): With a corpus that has 2+ pipelines, confirm
   every one is listed with its own four metrics simultaneously, no selector/switch required.
   With a single-pipeline corpus, confirm that one pipeline still renders in the same list form.
7. **Metrics — empty/no-data states** (FR-012/FR-013): With a never-chunked corpus, confirm a
   clear "no pipeline established yet" message instead of an empty list. With a pipeline that
   has too little data for scores, confirm its entry clearly says scores aren't available yet.
8. **Metrics — Compare still works** (FR-015): With 2+ pipelines, confirm the existing Compare
   button is still present and still opens the existing side-by-side comparison modal,
   unchanged, alongside the new list.
