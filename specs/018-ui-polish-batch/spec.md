# Feature Specification: RAG Workflow Screens — UI Polish Batch

**Feature Branch**: `[018-ui-polish-batch]`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "1. Bigger PDF names is making Sources screen horizontally scrollable. Lets make the PDF name multiline and avoid the scrolling. Fit it in one place
2. In chunking, only individual documents are being taken as input. Lets add an option called "Entire Corpus" which will chunk the all the PDFs belonging to that corpus
3. In Corpora screen, Lets show PDF list as the part of the list item with a show more button. It should show only 5 documents in the list item otherwise.
4. In Corpora screen, lets remove the Make Active on list item click and keep it explicit on the button click
5. In Chunking, Fixed Size chunking screen, Save Chunks button does not show progress like other buttons do. Lets add the same for "Save Chunks" button
6. In Embeddings screen, Let the dropdown have new option of Entire corpus that does embeddings for all PDFs
7. In Vector View screen, update the document selector dropdown
8. The LLM response is shown as is in the Playground screen, Make it Markdown compatible before showing it on Playground UI and make the answer shown as markdown"

## Clarifications

### Session 2026-07-17

- Q: How should "Entire Corpus" batch chunking/embedding runs be orchestrated under the hood? → A: Frontend loops over the existing per-document chunk/embed streaming endpoints sequentially (once per document) and combines their progress into one view; no new backend batch endpoints are introduced.
- Q: While an "Entire Corpus" run is in progress, how should progress be displayed? → A: One overall progress bar/percentage plus a text line naming which document is currently running and its position (e.g., "Processing document 3 of 12 (name.pdf)… 42%").
- Q: In Vector View, when "Entire Corpus" combines chunks from every document, how should they be organized? → A: Grouped by document, with a header for each document's name, so all of one document's chunks appear together before the next document's, in list order.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Chunk an entire corpus in one action (Priority: P1)

A user working with a corpus of many source documents wants to run fixed-size chunking across every document at once instead of selecting and running each document one at a time.

**Why this priority**: This is the biggest functional gap in the current workflow — corpora commonly hold dozens of documents, and repeating the same chunking run once per document is slow and error-prone. Closing this gap unblocks realistic multi-document usage of the tool.

**Independent Test**: Can be fully tested by opening the Chunking screen for a corpus with multiple documents, selecting "Entire Corpus" from the document selector, running chunking, and confirming every document in the corpus receives chunks without the user repeating the action per document.

**Acceptance Scenarios**:

1. **Given** a corpus with multiple uploaded documents, **When** the user opens the Chunking screen, **Then** the document selector includes an "Entire Corpus" option alongside the individual documents.
2. **Given** "Entire Corpus" is selected, **When** the user runs chunking, **Then** the system chunks every document currently in the active corpus using the configured chunk size, overlap, and separator, showing one overall progress bar/percentage plus which document (and its position, e.g. "3 of 12") is currently being processed.
3. **Given** "Entire Corpus" chunking has completed, **When** the user saves the result, **Then** chunks for every document in the corpus are persisted, matching what would result from running and saving each document individually.
4. **Given** one document in the corpus fails text extraction during an "Entire Corpus" run, **When** chunking completes, **Then** the system reports which document(s) failed while still completing and saving the documents that succeeded.

---

### User Story 2 - Generate embeddings for an entire corpus in one action (Priority: P1)

A user who has saved chunks for multiple documents in a corpus wants to generate and save embeddings for all of them at once, using one selected model, instead of repeating the operation per document.

**Why this priority**: This mirrors User Story 1 and removes the same repetitive, per-document friction from the very next step of the pipeline. Without it, the corpus-wide chunking gain from Story 1 is undone by having to embed one document at a time.

**Independent Test**: Can be fully tested by opening the Embeddings screen for a corpus where multiple documents already have saved chunks, selecting "Entire Corpus" from the document selector, generating and saving embeddings, and confirming every eligible document ends up with saved embeddings.

**Acceptance Scenarios**:

1. **Given** a corpus with multiple documents that have saved chunks, **When** the user opens the Embeddings screen, **Then** the document selector includes an "Entire Corpus" option alongside the individual documents.
2. **Given** "Entire Corpus" and a model are selected, **When** the user generates embeddings, **Then** the system generates embeddings for every document in the corpus that has saved chunks, using the selected model, showing one overall progress bar/percentage plus which document (and its position, e.g. "3 of 12") is currently being processed.
3. **Given** the generated embeddings are saved, **When** saving completes, **Then** embeddings are persisted for every eligible document in the corpus.
4. **Given** a document in the corpus has no saved chunks yet, **When** an "Entire Corpus" embedding run executes, **Then** that document is skipped and reported rather than causing the entire run to fail.

---

### User Story 3 - Read source document names without horizontal scrolling (Priority: P2)

A user viewing the Sources screen with documents that have long file names wants to read the full name in place, without the document table forcing the page to scroll sideways.

**Why this priority**: This is a readability bug affecting the screen a user sees every time they manage source documents; it doesn't block functionality but it's a frequent, visible annoyance.

**Independent Test**: Can be fully tested by uploading (or viewing) a document with a very long name and confirming the Sources document list stays within the screen width, with the name wrapping onto multiple lines rather than the row/table scrolling horizontally.

**Acceptance Scenarios**:

1. **Given** a document with a long file name, **When** the Sources document list renders, **Then** the document name wraps onto multiple lines within its column instead of extending the row width.
2. **Given** one or more long document names are present, **When** the user views the document list, **Then** no horizontal scrollbar appears on the document table as a result of name length.
3. **Given** a document name has no natural break points (e.g., one long unbroken token), **When** it renders, **Then** it still wraps within the column rather than overflowing it.

---

### User Story 4 - See saving progress for chunk saves (Priority: P2)

A user who clicks "Save Chunks" on the Fixed Size Chunking screen wants the same kind of live progress feedback they already get when saving embeddings, instead of the button simply appearing disabled with no indication of how the save is progressing.

**Why this priority**: This is a consistency/feedback gap: an equivalent save action elsewhere in the tool already gives progress feedback, so its absence here reads as broken or unresponsive, especially for larger documents or entire-corpus saves.

**Independent Test**: Can be fully tested by running chunking, clicking "Save Chunks", and confirming a progress indicator (bar and percentage) is shown while the save is in flight, the same way it is on the Embeddings screen's "Save" action.

**Acceptance Scenarios**:

1. **Given** a successful chunking result, **When** the user clicks "Save Chunks", **Then** a progress indicator (progress bar and percentage text) is displayed while the save is in progress.
2. **Given** the save completes successfully, **When** the progress indicator finishes, **Then** it is replaced by the existing "Saved" status indicator.
3. **Given** a save is in progress, **When** the user looks at the "Save Chunks" button, **Then** the button is disabled so a second save cannot be started concurrently.
4. **Given** a save fails, **When** the failure occurs, **Then** the existing save-error message is shown and the progress indicator is cleared.

---

### User Story 5 - Prevent accidental corpus switching (Priority: P2)

A user browsing the list of corpora on the Corpora screen wants clicking anywhere on a corpus row (to expand its document list, for example) to never change which corpus is active — only an explicit "Make Active" button click should do that.

**Why this priority**: Switching the active corpus is a meaningful action (it changes what Sources, Chunking, Embeddings, etc. operate on); making it happen from an incidental row click risks silently working in the wrong corpus.

**Independent Test**: Can be fully tested by clicking on a non-active corpus row (not on its "Make Active" button) and confirming the active corpus does not change; then clicking the row's "Make Active" button and confirming it does.

**Acceptance Scenarios**:

1. **Given** a corpus row that is not currently active, **When** the user clicks anywhere on the row other than its "Make Active" button, **Then** the active corpus does not change.
2. **Given** a corpus row that is not currently active, **When** the user clicks its "Make Active" button, **Then** that corpus becomes the active corpus.
3. **Given** the active corpus's row, **When** the user clicks anywhere on it, **Then** no "Make Active" control is needed or shown for it, and the active corpus remains unchanged.

---

### User Story 6 - Read Playground answers as formatted text (Priority: P2)

A user asking a question in the Playground wants the generated answer to display with proper formatting — headings, bold/italic text, lists, and code — instead of seeing raw formatting characters mixed into the text.

**Why this priority**: The generated answer is the primary output of the whole tool; showing it unformatted undermines readability and trust in the result, even though the underlying retrieval/generation behavior is unaffected.

**Independent Test**: Can be fully tested by asking a question that produces a formatted answer (e.g., one containing a list and bold text) and confirming the answer renders with that formatting applied rather than showing the raw markup characters.

**Acceptance Scenarios**:

1. **Given** a generated answer containing Markdown formatting (headings, bold/italic, lists, inline code, code blocks, links), **When** it is displayed, **Then** it renders with that formatting applied rather than showing the literal Markdown syntax.
2. **Given** a generated answer with no special formatting, **When** it is displayed, **Then** it renders as plain readable text exactly as before.
3. **Given** an answer contains content that resembles raw HTML or script tags, **When** it is rendered, **Then** it is displayed as inert text/formatting only and never executed as active HTML/script.

---

### User Story 7 - Preview each corpus's documents from the corpus list (Priority: P3)

A user scanning the list of all corpora wants to see which documents belong to each corpus directly in the list, without first activating that corpus, and without the list becoming unwieldy for corpora with many documents.

**Why this priority**: This is a discoverability/convenience improvement — useful, but the same information (via the existing per-active-corpus documents panel) is already reachable another way, so it's lower urgency than the functional gaps above.

**Independent Test**: Can be fully tested by viewing a corpus with more than 5 documents in the corpus list and confirming only 5 are shown with a "Show more" control that reveals the rest, and by viewing a corpus with 5 or fewer documents and confirming no "Show more" control appears.

**Acceptance Scenarios**:

1. **Given** a corpus with more than 5 documents, **When** its row renders in the Corpora list, **Then** exactly 5 document names are shown along with a "Show more" control.
2. **Given** the user clicks "Show more" on a corpus row, **When** the list expands, **Then** all of that corpus's documents are shown and the control becomes a "Show less" (or equivalent) toggle.
3. **Given** a corpus with 5 or fewer documents, **When** its row renders, **Then** all of its documents are shown and no "Show more" control appears.
4. **Given** a corpus with zero documents, **When** its row renders, **Then** it shows an empty/no-documents indication instead of a document list.

---

### User Story 8 - Inspect chunks across an entire corpus in Vector View (Priority: P3)

A user reviewing saved vectors in the Vector View screen wants to select "Entire Corpus" from the document selector and see the saved chunks from every document in the active corpus together, instead of being limited to one document's chunks at a time.

**Why this priority**: This extends the existing single-document inspection view to a corpus-wide view for cross-document comparison; it's a convenience for exploration rather than something blocking the core pipeline.

**Independent Test**: Can be fully tested by opening Vector View for a corpus with saved chunks in more than one document, selecting "Entire Corpus," and confirming the chunk list shows chunks from all of that corpus's documents, with each chunk still selectable to inspect its own saved embedding(s).

**Acceptance Scenarios**:

1. **Given** a corpus with saved chunks in multiple documents, **When** the user opens Vector View, **Then** the document selector includes an "Entire Corpus" option alongside the individual documents.
2. **Given** "Entire Corpus" is selected, **When** the chunk list renders, **Then** it shows the saved chunks from every document in the active corpus, grouped under a header for each document's name.
3. **Given** "Entire Corpus" is selected and the chunk list is showing chunks from multiple documents, **When** the user selects any one chunk, **Then** its saved embedding(s) display exactly as they would if that chunk's own document had been selected individually.
4. **Given** "Entire Corpus" is selected, **When** no document in the corpus has any saved chunks, **Then** the existing "no saved chunks yet" guidance is shown instead of an empty list.

---

### Edge Cases

- What happens when "Entire Corpus" is selected for chunking or embeddings but the corpus has zero documents (or, for embeddings, zero documents with saved chunks)? The option should be disabled or clearly indicate there is nothing to process.
- How does the system handle a user switching the active corpus, navigating away, or deleting a document while an "Entire Corpus" chunking or embedding run is in progress?
- How does the Sources document name wrapping behave for extremely long single-token names (no spaces/hyphens) — it must still wrap rather than overflow the column.
- What happens if the user clicks "Save Chunks" multiple times in quick succession — the button must stay disabled for the duration of the in-flight save.
- What happens when a corpus's document count crosses the 5-document threshold while its "Show more" state is expanded or collapsed (e.g., a document is added or removed) — the shown count and control should stay consistent with the current document list.
- What happens when a corpus is deleted or documents are attached/removed while its row's document preview is expanded on the Corpora screen?
- Chunk index numbers (e.g., `CHUNK_0`) are only unique within a single document; the per-document grouping headers in the combined "Entire Corpus" chunk list are what disambiguate otherwise-repeating chunk indices across documents.

## Requirements *(mandatory)*

### Functional Requirements

**Sources screen — document name wrapping**

- **FR-001**: The Sources document list MUST display each document's full name wrapped across multiple lines within its column rather than truncating it or forcing the row to widen.
- **FR-002**: The Sources document list table MUST NOT require horizontal scrolling as a result of document name length, regardless of how long a name is.

**Chunking screen — Entire Corpus option**

- **FR-003**: The Chunking screen's document selector MUST offer an "Entire Corpus" option in addition to each individual document in the active corpus.
- **FR-004**: When "Entire Corpus" is selected and chunking is run, the system MUST apply the configured chunk size, overlap, and separator to every document currently in the active corpus.
- **FR-005**: When "Entire Corpus" chunking is run, the system MUST show progress across the set of documents being processed (not just a single document's progress) by running the existing single-document chunking flow once per document, sequentially, and displaying one overall progress bar/percentage plus which document is currently being processed and its position (e.g., "Processing document 3 of 12 (name.pdf)").
- **FR-006**: When the result of an "Entire Corpus" chunking run is saved, the system MUST persist chunks for every document in the corpus that was successfully chunked.
- **FR-007**: If one or more documents fail during an "Entire Corpus" chunking run (e.g., text extraction failure), the system MUST report which documents failed while still completing and saving the documents that succeeded.

**Corpora screen — document preview per corpus**

- **FR-008**: Each corpus row in the Corpora list MUST display that corpus's documents inline as part of the row.
- **FR-009**: A corpus row MUST show at most 5 documents by default; if the corpus has more than 5 documents, the row MUST include a "Show more" control that reveals the remaining documents when activated.
- **FR-010**: A corpus with 5 or fewer documents MUST show all of its documents without a "Show more" control.
- **FR-011**: A corpus with zero documents MUST show an explicit empty-state indication in place of a document list.

**Corpora screen — explicit activation only**

- **FR-012**: Clicking a corpus row MUST NOT change which corpus is active.
- **FR-013**: The active corpus MUST only change when the user explicitly clicks that row's "Make Active" button.

**Chunking screen — Save Chunks progress**

- **FR-014**: While a chunk save operation is in progress, the system MUST display a progress indicator (progress bar and percentage) for the "Save Chunks" action, consistent with the progress indicator already shown for saving embeddings.
- **FR-015**: The "Save Chunks" button MUST remain disabled for the duration of an in-flight save.
- **FR-016**: The existing "Saved" / "Not saved yet" status indicator MUST continue to reflect the outcome once a save completes or fails.

**Embeddings screen — Entire Corpus option**

- **FR-017**: The Embeddings screen's document selector MUST offer an "Entire Corpus" option in addition to each individual document in the active corpus.
- **FR-018**: When "Entire Corpus" and a model are selected and embeddings are generated, the system MUST generate embeddings, using the selected model, for every document in the active corpus that has saved chunks.
- **FR-019**: When "Entire Corpus" embedding generation is run, the system MUST show aggregate progress across the set of documents being processed by running the existing single-document embedding flow once per document, sequentially, and displaying one overall progress bar/percentage plus which document is currently being processed and its position (e.g., "Processing document 3 of 12 (name.pdf)").
- **FR-020**: When "Entire Corpus" embeddings are saved, the system MUST persist embeddings for every document that was successfully processed.
- **FR-021**: A document in the active corpus with no saved chunks MUST be skipped (and reported) during an "Entire Corpus" embedding run rather than causing the entire run to fail.

**Vector View screen — Entire Corpus option**

- **FR-022**: The Vector View document selector MUST offer an "Entire Corpus" option in addition to each individual document in the active corpus.
- **FR-023**: When "Entire Corpus" is selected, the chunk list MUST show the saved chunks from every document in the active corpus, grouped under a header for each document's name (all of one document's chunks together before the next document's), in list order.
- **FR-024**: When "Entire Corpus" is selected, selecting any individual chunk from the combined list MUST display that chunk's saved embedding(s) the same way as when its document is selected individually.
- **FR-025**: When "Entire Corpus" is selected and no document in the corpus has saved chunks, the existing "no saved chunks yet" guidance MUST be shown instead of an empty chunk list.

**Playground screen — Markdown rendering**

- **FR-026**: The Playground screen MUST render generated answer text with Markdown formatting applied (at minimum: headings, bold/italic, lists, inline code, fenced code blocks, and links) rather than showing raw Markdown syntax characters.
- **FR-027**: Markdown rendering of an answer MUST NOT execute embedded HTML or script content; any such content MUST be displayed as inert text or stripped, never executed.
- **FR-028**: An answer with no special formatting MUST continue to display as plain readable text, unchanged from current behavior.

### Key Entities

- **Corpus**: A named collection of source documents; has an active/inactive state and a document count. Gains a document-preview (first 5 + expandable) representation on the Corpora screen.
- **Source Document**: An uploaded PDF belonging to one or more corpora; has a name (now multi-line-safe), size, upload date, and status.
- **Entire Corpus (selection scope)**: A new selectable scope, alongside "single document," usable wherever a document selector currently exists in the Chunking, Embeddings, and Vector View screens; represents "all documents in the active corpus" for that operation or view.
- **Chunk Save Operation**: The in-progress/complete/failed state of persisting fixed-size chunks, now with trackable progress for user feedback.
- **Generated Answer**: The LLM-produced response to a Playground question; now interpreted and displayed as formatted Markdown rather than raw text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can chunk every document in a 10-document corpus in a single action, down from 10 separate manual runs today.
- **SC-002**: A user can generate and save embeddings for every document in a 10-document corpus in a single action, down from 10 separate manual runs today.
- **SC-003**: Document names of any length are fully readable on the Sources screen without the user ever needing to scroll horizontally.
- **SC-004**: 100% of clicks on a corpus row that are not on its "Make Active" button result in no change to the active corpus.
- **SC-005**: Users can see progress feedback for chunk-saving within 1 second of clicking "Save Chunks", matching the feedback already present for embedding saves.
- **SC-006**: A user can see a preview of a corpus's documents (up to 5) directly from the Corpora list without any extra navigation or activation step.
- **SC-007**: Generated answers containing formatting (lists, bold text, headings, code) display with that formatting visibly applied, as judged by a side-by-side comparison with the raw text, for 100% of such answers.
- **SC-008**: A user can view saved chunks from every document in a corpus in one combined list in Vector View, without switching the document selector once per document.

## Assumptions

- "Entire Corpus" chunking applies one shared chunk size/overlap/separator configuration to every document in the corpus in a single run; it is functionally equivalent to running the existing single-document flow once per document, not a merged cross-document chunk set.
- "Entire Corpus" embedding generation applies one selected model to every document in the corpus that already has saved chunks; documents without saved chunks are skipped and reported rather than blocking the batch.
- Batch ("Entire Corpus") chunking and embedding runs are orchestrated entirely by looping over today's existing per-document streaming endpoints, one document at a time; no new backend batch/job endpoints are introduced by this feature, and per-document persistence behavior is reused unchanged.
- "Entire Corpus" in Vector View is view-only: it combines each document's already-saved chunks into one browsable list; it does not change how chunks were generated or saved, and selecting a chunk still shows that one chunk's own saved embedding(s), not an aggregate across documents.
- The Corpora screen's existing per-active-corpus documents panel (used for adding/removing documents from that corpus) is unaffected by this change and continues to exist alongside the new inline document preview on each row.
- "Progress like other buttons" for Save Chunks means the same progress-bar-plus-percentage pattern already used for saving embeddings on the Embeddings screen.
- Markdown rendering covers standard formatting (headings, emphasis, lists, inline/block code, links); no new authoring tools or Markdown editing capability is introduced — this is display-only.
- No backend/API contract changes are assumed beyond what's needed to support batch (entire-corpus) chunking, embedding, and chunk-listing requests; existing per-document persistence behavior is reused for each document in a batch.
- Per-row document previews on the Corpora screen (Story 7) are populated from data already available today (e.g., the existing all-documents-with-corpus-membership listing), grouped client-side by corpus; no new endpoint is assumed necessary solely to support the preview.
