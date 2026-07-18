# Feature Specification: Metrics Retrieval/Generation Stage Grouping

**Feature Branch**: `020-metrics-stage-groups`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Show Judge LLM name used, Show LLM name that is used for generation. Show 2 different groups called Retrieval and Generation. Show Retrieval strategy as well in the Metrics"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See retrieval-stage and generation-stage details grouped separately (Priority: P1)

A user reviewing a pipeline's metrics wants the information that describes how context was retrieved (chunking technique, embedding model, retrieval strategy, Context Precision, Context Recall) visually separated from the information that describes how the answer was generated (the generation LLM, Response Relevancy, Faithfulness), instead of one undifferentiated list of fields.

**Why this priority**: This is the core visual reorganization the request asks for — without it, the new fields (retrieval strategy, generation LLM, judge LLM) would just be more items added to an already-flat list, defeating the purpose of making retrieval quality and generation quality separately scannable.

**Independent Test**: Can be fully tested by opening the Metrics screen for a corpus with saved chunks, embeddings, and at least one answered question, and confirming the pipeline detail view shows two clearly labeled sections — "Retrieval" and "Generation" — each containing only the fields relevant to that stage.

**Acceptance Scenarios**:

1. **Given** a pipeline with saved chunks and embeddings, **When** the user views its metrics, **Then** a "Retrieval" section shows the chunking technique, embedding model, retrieval strategy, Context Precision, and Context Recall.
2. **Given** the same pipeline, **When** the user views its metrics, **Then** a separate "Generation" section shows the generation LLM name, Response Relevancy, and Faithfulness.
3. **Given** a pipeline with at least one scored question, **When** the user views its metrics, **Then** the name of the LLM used to judge/score that pipeline's questions is shown, associated with both sections since one judge call produces all four scores.

---

### User Story 2 - See retrieval strategy, generation LLM, and judge LLM for a pipeline (Priority: P1)

A user wants to know exactly which retrieval strategy, which LLM generated the answers, and which LLM judged their quality for a given pipeline — information that today is invisible on the Metrics screen even though it directly affects the scores shown.

**Why this priority**: Without this information, a user comparing pipelines or troubleshooting an unexpected score has no way to attribute results to a specific configuration — this is foundational to the experimentation/comparison purpose of the Metrics screen.

**Independent Test**: Can be fully tested by opening the Metrics screen for a pipeline that has at least one answered, scored question, and confirming the retrieval strategy, generation LLM name, and judge LLM name are all visible and correctly reflect what actually produced that pipeline's answers and scores.

**Acceptance Scenarios**:

1. **Given** a pipeline with saved chunks and embeddings but no answered questions yet, **When** the user views its metrics, **Then** the retrieval strategy is shown (it does not depend on any question having been asked), while the generation LLM name and judge LLM name show a "not available yet" indication rather than a blank or misleading value.
2. **Given** a pipeline with at least one answered question, **When** the user views its metrics, **Then** the generation LLM name shown reflects the LLM most recently used to generate an answer for that pipeline.
3. **Given** a pipeline with at least one scored question, **When** the user views its metrics, **Then** the judge LLM name shown reflects the LLM most recently used to score a question for that pipeline.

---

### User Story 3 - See the same grouping and fields when comparing pipelines (Priority: P2)

A user comparing multiple pipelines for a corpus side by side wants the same Retrieval/Generation grouping and the same new fields (retrieval strategy, generation LLM, judge LLM) available in the comparison view, not just the single-pipeline view.

**Why this priority**: Consistency across the two views that already exist on this screen; valuable but secondary to establishing the grouping and fields themselves in the primary view (User Stories 1–2).

**Independent Test**: Can be fully tested by opening the comparison view for a corpus with two or more pipelines and confirming each pipeline's row/card shows its own retrieval strategy, generation LLM name, and judge LLM name, organized consistently with the single-pipeline view's Retrieval/Generation grouping.

**Acceptance Scenarios**:

1. **Given** a corpus with two or more pipelines, **When** the user opens the comparison view, **Then** each pipeline's retrieval strategy, generation LLM name, and judge LLM name are shown alongside its existing chunk/question/answer counts and scores.

---

### Edge Cases

- What happens when a pipeline's answered questions used more than one generation LLM over time (e.g., the configured LLM was changed between questions)? The most recently used generation LLM is shown, consistent with how the embedding model and chunking technique already reflect "most recent" elsewhere on this screen.
- What happens when a pipeline's scored questions used more than one judge LLM over time? The most recently used judge LLM is shown, for the same reason.
- What happens when no question for a pipeline has been answered yet? Retrieval-stage fields (chunking technique, embedding model, retrieval strategy) still show, since they don't depend on any question being asked; generation LLM name and judge LLM name show a clear "not available yet" state instead of a blank field.
- What happens when a question was asked and retrieved context but generation failed (errored) for every attempt? The generation LLM name shows "not available yet" the same as if no question had been asked, since no answer was ever successfully generated for that pipeline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST group a pipeline's displayed metrics into two labeled sections: "Retrieval" and "Generation."
- **FR-002**: The "Retrieval" section MUST show the chunking technique, the embedding model, the retrieval strategy, Context Precision, and Context Recall.
- **FR-003**: The "Generation" section MUST show the generation LLM name, Response Relevancy, and Faithfulness.
- **FR-004**: System MUST show the name of the LLM used to judge/score a pipeline's questions, presented once and understood to apply to both the Retrieval and Generation sections' scores (a single judge call produces all four measures for a given question).
- **FR-005**: System MUST show the retrieval strategy for a pipeline regardless of whether any question has been asked yet, since retrieval strategy is determined by configuration, not by question history.
- **FR-006**: System MUST show a clear "not available yet" indication for the generation LLM name and the judge LLM name when a pipeline has no successfully answered question or no scored question, respectively, rather than a blank or misleading value.
- **FR-007**: When a pipeline has answered questions that used more than one generation LLM over time, System MUST show the most recently used one.
- **FR-008**: When a pipeline has scored questions that used more than one judge LLM over time, System MUST show the most recently used one.
- **FR-009**: The comparison view MUST show each pipeline's retrieval strategy, generation LLM name, and judge LLM name alongside its existing figures, organized consistently with the single-pipeline Retrieval/Generation grouping.

### Key Entities

- **Retrieval Details**: The subset of a pipeline's information that describes how context was retrieved — chunking technique, embedding model, retrieval strategy, Context Precision, Context Recall.
- **Generation Details**: The subset of a pipeline's information that describes how the answer was produced — generation LLM name, Response Relevancy, Faithfulness.
- **Judge LLM**: The LLM that produced a question's quality scores, distinct from the generation LLM that produced the answer being judged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can identify, without leaving the Metrics screen, which retrieval strategy, embedding model, chunking technique, generation LLM, and judge LLM produced a pipeline's results.
- **SC-002**: Retrieval-related and generation-related information are visually distinguishable into two separate, clearly labeled groups on first glance, for 100% of pipelines shown.
- **SC-003**: The retrieval strategy is visible for every pipeline that has saved chunks and embeddings, even before any question has been asked against it.
- **SC-004**: A user comparing two or more pipelines can see each one's generation LLM, judge LLM, and retrieval strategy without switching between the single-pipeline view and the comparison view.

## Assumptions

- This feature extends the existing Metrics screen delivered by `019-metrics-dashboard`; it does not introduce a new screen.
- "Judge LLM name" and "generation LLM name" refer to the specific underlying model (e.g., a model identifier), not just the provider/vendor name — the same level of detail already recorded for a Playground turn's generation model.
- Retrieval strategy, generation LLM, and judge LLM are additional descriptive fields on an existing pipeline; they do not change what identifies a pipeline (a pipeline is still identified by corpus, chunking technique, and embedding model) or introduce a new way to switch/filter pipelines.
- A single judge evaluation produces all four quality measures (Context Precision, Context Recall, Response Relevancy, Faithfulness) at once, so "Judge LLM name" is shown once per pipeline rather than duplicated in both the Retrieval and Generation sections.
- "Most recently used" is the basis for showing a single generation LLM / judge LLM value when a pipeline's history includes more than one, consistent with how the embedding model and chunking technique are already displayed elsewhere in the product.
