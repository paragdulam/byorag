# Feature Specification: Metrics Dashboard

**Feature Branch**: `019-metrics-dashboard`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Lets build Metrics screen. I want to see a list of corpora here. I see chunking technique(s) used. Currently there is only Fixed Size chunking, there will be more chunking techniques. I should be able to change different chunking technique and the chunks will change. I see embedding model for chunks based on selected chunking technique. I may create chunks using 2 different techiniques on same corpus. It should show that accordingly. I should see number of questions asked and answers received. I should see Context Precision and Context Recall for Retrieval for that RAG pipeline. I should see Response Relevancy and Faithfulness for Generation of that RAG pipeline. Also show if user has asked question to entire corpus or individual PDF"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View corpus pipeline summary and quality scores (Priority: P1)

A user who has been chunking, embedding, and asking questions against a corpus wants to open a single Metrics screen and see, for any corpus, which chunking technique was used, its embedding model, how many questions have been asked and answered, and how well the RAG pipeline is performing (retrieval and generation quality scores) — without piecing this together from separate screens.

**Why this priority**: This is the core value of the feature — a single place to judge pipeline quality. Without it, nothing else in this feature has a purpose.

**Independent Test**: Can be fully tested by opening the Metrics screen with a corpus that has saved chunks, a saved embedding model, and at least one answered Playground question, and confirming the chunking technique, embedding model, question/answer counts, and all four quality scores are shown for that corpus.

**Acceptance Scenarios**:

1. **Given** a corpus with saved chunks from one chunking technique, a saved embedding model, and answered questions, **When** the user opens the Metrics screen and selects that corpus, **Then** the screen shows the chunking technique name, the embedding model name, the total number of questions asked, the total number of answers received, Context Precision, Context Recall, Response Relevancy, and Faithfulness.
2. **Given** a corpus with saved chunks but no questions asked yet, **When** the user views that corpus's metrics, **Then** the screen shows the chunking technique and embedding model, a question/answer count of zero, and an indication that quality scores are not yet available rather than blank or misleading values.
3. **Given** a corpus with no saved chunks yet, **When** the user views that corpus's metrics, **Then** the screen shows the corpus with an indication that no chunking technique has been applied yet, and no embedding model, question/answer counts, or quality scores are shown.

---

### User Story 2 - Switch between chunking techniques for a corpus (Priority: P1)

A user who has chunked the same corpus using more than one chunking technique (e.g., Fixed Size today, others in the future) wants to switch between them on the Metrics screen and see each technique's own embedding model, question/answer counts, and quality scores update accordingly.

**Why this priority**: Comparing techniques on the same corpus is the reason a user would run more than one in the first place; without switching, the second technique's results are invisible on this screen.

**Independent Test**: Can be fully tested by saving chunks for the same corpus under two different chunking techniques, opening the Metrics screen, switching the technique selector between them, and confirming the displayed embedding model, question/answer counts, and quality scores change to match the selected technique each time.

**Acceptance Scenarios**:

1. **Given** a corpus with saved chunks from exactly one chunking technique, **When** the user views its metrics, **Then** that technique is shown without requiring a selection step (no switcher needed, or a switcher with a single, pre-selected option).
2. **Given** a corpus with saved chunks from two or more chunking techniques, **When** the user opens the Metrics screen for that corpus, **Then** a technique selector lists every technique that has saved chunks for that corpus.
3. **Given** the technique selector is showing multiple techniques, **When** the user selects a different technique, **Then** the embedding model, question/answer counts, and all four quality scores update to reflect the newly selected technique's pipeline.

---

### User Story 3 - Compare all pipelines for a corpus side by side (Priority: P2)

A user evaluating which chunking technique performs best for a corpus wants a single comparison view showing every technique/embedding-model pipeline for that corpus side by side, instead of switching back and forth one at a time.

**Why this priority**: This directly serves the experimentation/comparison goal of the tool, but it is a convenience layered on top of User Story 2's single-pipeline view, so it can ship after the core viewing experience.

**Independent Test**: Can be fully tested by saving chunks for a corpus under two or more chunking techniques, opening the Metrics screen for that corpus, clicking the "Compare" action, and confirming a modal appears listing every technique/embedding-model pipeline for that corpus with its own chunk count, question/answer counts, and all four quality scores.

**Acceptance Scenarios**:

1. **Given** a corpus with saved chunks from two or more chunking techniques, **When** the user clicks the "Compare" action on that corpus, **Then** a modal opens showing one row or card per technique/embedding-model pipeline, each with its chunk count, question/answer counts, and quality scores.
2. **Given** a corpus with saved chunks from only one chunking technique, **When** the user views that corpus, **Then** the "Compare" action is disabled or hidden, since there is nothing to compare.
3. **Given** the comparison modal is open, **When** the user closes it, **Then** the Metrics screen returns to the single-pipeline view for the technique that was selected before the modal was opened.

---

### User Story 4 - Ask a question against an entire corpus and see the scope reflected (Priority: P2)

A user in the Playground wants the option to ask a question against every document in a corpus at once (not just one PDF), and wants the Metrics screen to reflect how many questions were asked at the corpus level versus the individual-document level.

**Why this priority**: The Metrics screen's scope breakdown (corpus-wide vs. individual PDF) is meaningless without a way to actually ask corpus-wide questions. This capability is needed to produce real data for User Story 1's counts, but the core viewing experience (US1/US2) can be built and demoed against individual-document questions first.

**Independent Test**: Can be fully tested by opening the Playground for a corpus, selecting "Entire Corpus" as the question scope, asking a question, confirming an answer is generated using context retrieved across the whole corpus, and then confirming the Metrics screen for that corpus shows that question counted under the "entire corpus" scope alongside any individual-document questions.

**Acceptance Scenarios**:

1. **Given** a corpus with saved chunks and embeddings for a chunking technique, **When** the user opens the Playground, **Then** a question scope option lets them choose between an individual document and "Entire Corpus."
2. **Given** "Entire Corpus" is selected as the scope, **When** the user asks a question, **Then** the system retrieves context across all documents in the corpus for that technique/embedding-model pipeline and generates an answer, and the resulting turn is recorded with an "Entire Corpus" scope.
3. **Given** a corpus has both individual-document and entire-corpus questions recorded, **When** the user views that corpus's metrics, **Then** the question/answer counts and the scope breakdown (how many were asked to the entire corpus vs. an individual document) are both shown, and the quality scores are computed at the corpus (pipeline) level across all questions regardless of scope.

---

### Edge Cases

- What happens when a corpus has saved chunks and an embedding model but every Playground turn for it errored (no answer generated)? Questions-asked count includes the errored turns; answers-received count excludes them; quality scores are computed only from turns with a generated answer.
- What happens when quality-score computation for a turn fails or is still pending at the time the user views the Metrics screen? That turn is excluded from the aggregated scores shown, and the screen indicates the scores are based on a partial/growing sample rather than presenting an incomplete number as final.
- How does the screen handle a corpus that has no corpora at all in the system (empty state before any corpus exists)?
- What happens when the user switches chunking technique or opens the comparison modal while new questions are still being answered in the background? The screen reflects the data available at the time of the view and does not block on in-flight turns.
- What happens when two chunking techniques on the same corpus share the same embedding model? Both are still listed as distinct pipelines (technique + embedding model + their own chunk set) since their resulting chunks and thus retrieval results differ.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Metrics screen listing every corpus in the system.
- **FR-002**: For a selected corpus, the system MUST show which chunking technique(s) have saved chunks for that corpus.
- **FR-003**: When a corpus has saved chunks from more than one chunking technique, the system MUST provide a way to select which technique's pipeline is currently displayed, and MUST update all displayed pipeline data (embedding model, question/answer counts, quality scores) when the selection changes.
- **FR-004**: System MUST show the embedding model associated with the chunks produced by the currently selected chunking technique.
- **FR-005**: System MUST show the total number of questions asked and the total number of answers received for the currently selected corpus/technique pipeline, counted across both individual-document and entire-corpus questions.
- **FR-006**: System MUST show, for the currently selected corpus/technique pipeline, how many questions were asked against the entire corpus versus how many were asked against an individual document.
- **FR-007**: System MUST compute and display Context Precision and Context Recall as retrieval quality scores for the currently selected corpus/technique pipeline, aggregated across that pipeline's answered questions.
- **FR-008**: System MUST compute and display Response Relevancy and Faithfulness as generation quality scores for the currently selected corpus/technique pipeline, aggregated across that pipeline's answered questions.
- **FR-009**: Quality scores (Context Precision, Context Recall, Response Relevancy, Faithfulness) MUST be computed automatically for each answered Playground question, without requiring the user to supply reference answers or expected context.
- **FR-010**: System MUST provide a "Compare" action, available when a corpus has saved chunks from more than one chunking technique, that opens a view showing every technique/embedding-model pipeline for that corpus side by side, each with its own chunk count, question/answer counts, and quality scores.
- **FR-011**: System MUST allow a user to ask a Playground question against an entire corpus (retrieving context from every document in the corpus for the active technique/embedding-model pipeline) in addition to the existing option of asking against one individual document.
- **FR-012**: System MUST record, for every Playground question, whether it was asked against the entire corpus or an individual document, so the Metrics screen can report the breakdown required by FR-006.
- **FR-013**: System MUST indicate clearly, for a corpus/technique pipeline with zero answered questions, that quality scores are not yet available, rather than showing a blank, zero, or otherwise misleading score.
- **FR-014**: System MUST indicate clearly, for a corpus with no saved chunks from any technique, that no chunking pipeline has been established yet, and MUST NOT show embedding model, question/answer counts, or quality scores for that corpus.

### Key Entities

- **RAG Pipeline**: The combination of a corpus, a chunking technique, and the embedding model used for the chunks that technique produced. A corpus MAY have more than one pipeline (e.g., the same corpus chunked with two different techniques). Question/answer counts and quality scores are tracked per pipeline.
- **Playground Question (Turn)**: An asked question and its generated answer (if any), already tracked by the existing Playground; extended with a scope (entire corpus or individual document) and a set of computed quality scores.
- **Question Scope**: Whether a given question was asked against every document in the corpus ("Entire Corpus") or against one specific document.
- **Quality Score**: A computed value for one of four measures — Context Precision, Context Recall (retrieval quality), Response Relevancy, Faithfulness (generation quality) — produced automatically per answered question and aggregated at the pipeline level for display.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can see a corpus's chunking technique, embedding model, question/answer counts, and all four quality scores within a single screen view, without navigating to another screen.
- **SC-002**: Switching the chunking-technique selector for a corpus updates all displayed pipeline data (embedding model, counts, scores) in under 2 seconds.
- **SC-003**: For a corpus with two or more chunking techniques, the comparison view shows every technique's pipeline data within a single interaction (one click) of the Metrics screen.
- **SC-004**: Every answered Playground question contributes an automatically computed quality score set without any additional user action beyond asking the question.
- **SC-005**: A user can ask a question against an entire corpus and see it correctly counted in the corpus-wide portion of the question scope breakdown on the Metrics screen.
- **SC-006**: 100% of corpora with saved chunks show at least one chunking technique and, once at least one question has been answered, a non-empty set of quality scores.

## Assumptions

- "Context Precision," "Context Recall," "Response Relevancy," and "Faithfulness" refer to the standard RAG evaluation measures of retrieval quality (precision/recall of retrieved context) and generation quality (how relevant and grounded the generated answer is), computed automatically per question using an automated judge rather than manually labeled by the user.
- Quality scores are computed asynchronously after (or shortly following) each answered question and aggregated for display; they are not required to be instantaneous at the moment the answer is generated.
- The Metrics screen shows chunk-level summary information (technique, embedding model, chunk count) rather than the full chunk content browsing experience, which remains the responsibility of the existing Vector View screen.
- "Entire Corpus" Playground questions retrieve context from across all documents in the corpus for the active technique/embedding-model pipeline, consistent with the "Entire Corpus" pattern already used elsewhere in the product (chunking, embeddings, vector view).
- Quality scores are aggregated at the corpus/technique-pipeline level (combining both entire-corpus and individual-document questions into one set of scores per pipeline), not broken out separately per individual document.
- A corpus with only one chunking technique does not require a visible technique switcher, though the underlying selection mechanism still applies for consistency.
