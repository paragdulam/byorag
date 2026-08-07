# Feature Specification: Playground Sequential Flow & Metrics Pipeline List

**Feature Branch**: `031-playground-metrics-redesign`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "We need some UI changes in Playground screen and in Metrics screen. In Playground screen, We have 2 sections in left and right side. I want it in one detailed screen but in sequence. When I enter a question, it should show quey embedding below it as a row with show more/show less combination. Then show the results the same way as its shown now but below the query embedding. Let the generate button go away, hit the api call here and put anthorpic api to work, get the response and show as the final block completely as the answer. Utilize the entire detail screen and remove the right side of the screen. In Metrics screen, I dont want to select any other corpus, Everything happens on one corpus at a time which is selectable only in Corpus section. We need to understand one thing here. In future scope, we will be adding other chunking techniques, other embedding models, other LLM genreation tools etc. All these changes we do in the future should be seen as a new RAG Pipeline as a combination. fixed chunking + bert embedding + claude sonnet is one. One change in this should be another pipeline. There can be any combination here uniquely maintained. The 4 metrics we show currently should be shown as metrics against these RAG pipelines. So the metrics should be a list of pipelines with each pipeline showing the 4 metrices that we are showing already."

## Clarifications

### Session 2026-08-05

- Q: The Metrics screen currently has a separate "Compare" button that opens a side-by-side comparison modal for two or more pipelines. Once every pipeline's metrics are always visible in one list, what should happen to that Compare interaction? → A: Keep it as a secondary action — retain the existing Compare button/modal alongside the new always-visible list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask a question and read everything in one sequential flow (Priority: P1)

A user on the Playground screen asks a question and wants to follow, top to bottom, exactly what the system did with it: what the question was, what that question turned into internally, what evidence it found, and what it finally answered — without splitting their attention across two side-by-side panels or taking a separate manual step to get an answer.

**Why this priority**: This is the core, most substantial change requested and reshapes the screen's entire interaction model — every other Playground behavior (asking, retrieving, answering) now happens inside this one redesigned flow.

**Independent Test**: Can be fully tested by opening the Playground screen, asking a single question, and confirming the question, its embedding preview, its retrieved evidence, and its final answer all appear as one continuous, full-width sequence with no separate side panel and no manual step required to see the answer.

**Acceptance Scenarios**:

1. **Given** the Playground screen is open, **When** the user submits a question, **Then** the question appears, and the screen uses its full width as a single column rather than two side-by-side sections.
2. **Given** a question has just been submitted, **When** the system finishes processing it, **Then** a query embedding preview appears directly below the question, collapsed by default with a way to show more of it and show less again.
3. **Given** the query embedding preview is shown, **When** the user looks below it, **Then** the retrieved supporting evidence for that question appears next, presented the same way it already is today (each piece collapsed by default with its own show more/show less).
4. **Given** the retrieved evidence is shown, **When** the system finishes generating a response, **Then** the final answer appears as its own block below the evidence, without the user having to click anything to request it.
5. **Given** a question is asked, **When** the user looks for a manual "Generate" action, **Then** none exists — asking the question is the only step required to eventually see the answer.
6. **Given** the user asks a second question, **When** it is submitted, **Then** its own question/embedding/evidence/answer sequence appears in the same continuous flow (e.g., appended below the first), and the first question's own sequence remains visible and intact.

---

### User Story 2 - See every RAG pipeline's quality metrics at a glance, for the active corpus only (Priority: P2)

A user on the Metrics screen wants to see how every distinct combination of chunking technique, embedding model, and generation model ("RAG pipeline") used on their current corpus is performing, side by side, without switching corpora from inside the Metrics screen itself — corpus selection is something they do once, from the Corpora section, the same way it works everywhere else in the app.

**Why this priority**: Valuable and explicitly requested, but it's a narrower, more contained change (removing an in-screen corpus picker and turning a one-at-a-time pipeline view into an always-visible list) than User Story 1's full interaction redesign.

**Independent Test**: Can be fully tested by making the current corpus active from the Corpora section, opening the Metrics screen, and confirming it shows every one of that corpus's RAG pipelines as a list, each with its own four quality metrics, with no corpus-switching control present on the Metrics screen itself.

**Acceptance Scenarios**:

1. **Given** the currently active corpus has more than one distinct RAG pipeline (e.g., it was processed with more than one chunking/embedding/generation combination over time), **When** the user opens the Metrics screen, **Then** every one of that corpus's pipelines is listed, each showing its own four quality metrics.
2. **Given** the Metrics screen is open, **When** the user looks for a way to pick a different corpus from within the screen, **Then** no such control exists — the screen always reflects whichever corpus is currently active app-wide.
3. **Given** the user switches the active corpus from the Corpora section, **When** they return to (or are already on) the Metrics screen, **Then** it now shows the pipelines and metrics for the newly active corpus.
4. **Given** the active corpus has exactly one pipeline so far, **When** the user opens the Metrics screen, **Then** that single pipeline is still shown in the same list form, with its four metrics.
5. **Given** the active corpus has no established pipeline yet (e.g., nothing has been chunked/embedded), **When** the user opens the Metrics screen, **Then** the screen explains that clearly instead of showing an empty or confusing list.
6. **Given** two of the corpus's pipelines each used a different chunking technique, embedding model, or generation model, **When** they are both shown in the list, **Then** each is clearly distinguishable as its own pipeline with its own metrics, not merged together.
7. **Given** the active corpus has two or more pipelines, **When** the user wants a focused, side-by-side comparison of specific pipelines rather than scanning the full list, **Then** the existing Compare action is still available and still opens that side-by-side comparison view.

---

### Edge Cases

- What happens if generating the final answer fails after the question, embedding, and evidence have already appeared? The user must still be able to see what went wrong and retry generating just the answer, without having to re-ask the question or lose the already-shown embedding/evidence.
- What happens if a question retrieves no supporting evidence at all? The flow still proceeds to the answer step in sequence (matching today's existing "no chunks available" handling), rather than getting stuck.
- What happens when two of the corpus's pipelines happen to produce identical quality metric values? Both are still listed as separate pipelines, since they are distinguished by their technique/model combination, not by their scores.
- What happens to a pipeline that has no quality scores yet (not enough questions asked/answered against it)? It still appears in the list, showing that scores aren't available yet, consistent with today's per-pipeline "not enough data" handling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Playground screen MUST present a single, full-width sequence for each question instead of two separate side-by-side sections.
- **FR-002**: For each question, the system MUST show, in this order: the question itself, then a query embedding preview, then the retrieved supporting evidence for that question, then the final generated answer.
- **FR-003**: The query embedding preview MUST be collapsed by default and MUST offer a way to reveal more of it ("show more") and collapse it again ("show less"), consistent with the collapse/expand pattern already used for retrieved evidence.
- **FR-004**: The retrieved supporting evidence MUST continue to be presented the same way it is today (each piece collapsed by default, individually expandable).
- **FR-005**: The system MUST NOT require a separate manual action to generate the answer — submitting the question is sufficient to eventually produce and show the final answer.
- **FR-006**: The final answer MUST be shown as its own distinct block, positioned after the query embedding and the retrieved evidence.
- **FR-007**: Asking multiple questions MUST preserve every previous question's full sequence (question, embedding, evidence, answer) visibly in the flow — a new question does not hide or replace an earlier one.
- **FR-008**: If answer generation fails, the system MUST show the failure clearly and MUST offer a way to retry generating the answer for that specific question, without requiring the question to be re-asked.
- **FR-009**: The Metrics screen MUST always reflect the corpus that is currently active app-wide, with no separate corpus-selection control on the Metrics screen itself.
- **FR-010**: The Metrics screen MUST list every distinct RAG pipeline (unique combination of chunking technique, embedding model, and generation model used to produce results) that exists for the active corpus.
- **FR-011**: Each pipeline in the list MUST show its own four quality metrics (the same four metrics already shown today), without requiring the user to first select that pipeline out of a switcher.
- **FR-012**: When the active corpus has no established pipeline yet, the Metrics screen MUST clearly explain that instead of showing an empty or misleading list.
- **FR-013**: When a pipeline does not yet have enough data for quality scores, its entry in the list MUST clearly indicate that scores aren't available yet rather than showing blank or misleading values.
- **FR-014**: Changing the active corpus (from the Corpora section) MUST update what the Metrics screen shows, the next time it is viewed.
- **FR-015**: The existing side-by-side "Compare" action MUST remain available as a secondary way to view specific pipelines together, alongside (not replaced by) the always-visible pipeline list.

### Key Entities

- **Playground Turn**: One question-and-answer exchange already tracked by the system; this feature changes only how a turn's parts (question, query embedding, evidence, answer) are laid out and sequenced, not what a turn is or how it's stored.
- **RAG Pipeline**: An already-tracked, uniquely identified combination of chunking technique, embedding model, and generation model applied to a corpus's content. Every future addition of a new chunking technique, embedding model, or generation option that gets used produces its own distinct pipeline identity rather than altering an existing one. This feature changes how a corpus's pipelines and their quality metrics are displayed (as an always-visible list) — it does not introduce this identity concept, which already exists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from asking a question to seeing its final answer, its query embedding, and its supporting evidence — all in one place, in reading order — without any manual step beyond asking the question.
- **SC-002**: The Playground screen's usable width for a question's information is not reduced by an unused or redundant second section.
- **SC-003**: Users can see every one of the active corpus's RAG pipelines and their quality metrics within a single view of the Metrics screen, with zero additional clicks to switch between pipelines just to see their metrics.
- **SC-004**: The Metrics screen never requires switching corpora from within itself — 100% of corpus switching happens through the Corpora section.
- **SC-005**: A new future chunking technique, embedding model, or generation model, once used, is distinguishable in the Metrics pipeline list as its own entry, without being confused with or merged into an existing pipeline's metrics.

## Assumptions

- "Utilize the entire detail screen and remove the right side" is interpreted as removing the two-panel (left conversation / right retrieval) split entirely in favor of one full-width, sequential column — not merely widening the left panel.
- Removing the manual "Generate" button means asking a question triggers both evidence retrieval and answer generation as one continuous action from the user's perspective; the system may still show intermediate progress (e.g., evidence appearing before the answer finishes generating) as described in the acceptance scenarios, rather than making the user wait for everything to resolve before seeing anything.
- The existing per-turn retry-on-failure capability is preserved for the answer-generation step specifically (per Edge Cases), since removing the general-purpose "Generate" button should not remove the ability to recover from a failed generation.
- The "select a past turn to inspect its own retrieval details" behavior is no longer needed once every question's full sequence (embedding, evidence, answer) is always shown inline for every turn — there is nothing separate left to "select into."
- The RAG Pipeline identity (chunking + embedding + generation combination) and its four quality metrics are already tracked by the system today; this feature is a display change (list every pipeline for the active corpus at once) rather than a request to build new pipeline-tracking capability.
