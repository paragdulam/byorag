# Feature Specification: Playground Split-Screen Chat Interface

**Feature Branch**: `[017-playground-chat-interface]`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Lets split Playground screen in 2 halves. Left side and Right Side, Left part will have Textfield with send button at the bottom. When user enters query and presses send button, Query embeddings show up with max 2 rows with Show more button on the right side bottom, then List of retrieved chunks is shown as chunk Ids with Show more button each above the query embedding. Above the chunks, Generate button is seen which sends the question, all chunks to an LLM as context while expecting an answer. The LLM generated response should be shown in the left part of the screen above the chat text field but below the question. User can ask as many questions as they like and it should continue creating the chat interface in the left part"

## Clarifications

### Session 2026-07-15

- Q: Should the conversation history (questions and answers) persist beyond the current visit, or is it cleared whenever the user navigates away from or reloads the Playground? → A: Persisted — every turn (the question, the retrieved chunks, the specific saved embedding matched for each chunk, the generated query embedding, the LLM used, the exact prompt sent, and the resulting response) is saved to a database table, not just kept in page memory.
- Q: Can the user submit a new question while a previous retrieval or answer-generation request is still in progress? → A: Blocked — the send and Generate controls are disabled while a request is in flight; the user must wait for the current step to finish (or fail) before starting another.
- Q: Should a user be able to revisit which chunks, embedding, LLM, and prompt produced an earlier answer in the conversation, or is only the newest turn's retrieval ever visible? → A: Yes — every generated answer shown on the left is clickable/tappable; selecting it repopulates the right side with that turn's persisted retrieved chunks, query embedding, the LLM used, and the prompt sent, so the full process behind any past answer can be inspected.
- Q: When the user leaves the Playground (or reloads) and returns, should the left-side conversation automatically reload prior turns for the selected document, or does it always start blank while persisted data exists only for later inspection? → A: Automatically reload — opening the Playground for a document loads that document's full prior conversation (all previous questions and answers, in order) into the left panel before any new question is asked.
- Q: Should the generated answer stream into the left panel incrementally as the LLM produces it, or appear as a single block once generation fully completes? → A: Single block — a loading indicator is shown while generation runs, then the complete answer is revealed at once when it finishes.
- Q: When a Generate request fails, should the user be able to retry generation for that same turn using its already-retrieved chunks, or must they ask the question again as a new turn? → A: Retry the same turn — a retry control appears on the failed turn; retrying resends the same question and its already-retrieved chunks to the LLM, without a new retrieval or a new conversation entry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask a question and get an answer grounded in retrieved context (Priority: P1)

A user working in the Playground types a question into the text field on the left side of the
screen and sends it. The system retrieves the saved chunks most relevant to the question and
displays them on the right side. The user then clicks Generate to send the question and the
retrieved chunks to a language model, which produces an answer. The answer appears on the left
side directly below the question, becoming part of an ongoing conversation.

**Why this priority**: This is the reason the Playground redesign exists — turning raw retrieval
results into a usable question-and-answer experience is the core value this feature delivers.

**Independent Test**: Can be fully tested by opening the Playground, typing a question, sending
it, waiting for chunks to be retrieved, clicking Generate, and confirming an answer appears in the
left panel attached to that specific question.

**Acceptance Scenarios**:

1. **Given** a document with saved chunks and embeddings, **When** the user types a question and
   presses Send, **Then** chunks relevant to the question appear on the right side of the screen
   and a Generate control becomes available.
2. **Given** retrieved chunks are shown on the right side, **When** the user clicks Generate,
   **Then** the question and all of the currently retrieved chunks are sent as context to a
   language model, and the resulting answer is displayed on the left side directly below that
   question.
3. **Given** the user has clicked Generate, **When** the answer is being produced, **Then** a
   clear loading indication is shown until the answer (or an error) is ready.
4. **Given** a Generate request fails, **When** the failure occurs, **Then** a clear error message
   is shown in place of an answer, no fabricated or partial answer is displayed, and a retry
   control is offered on that turn.
5. **Given** the query field is empty or contains only whitespace, **When** the user attempts to
   send, **Then** no retrieval or generation occurs.

---

### User Story 2 - Inspect retrieved chunks and the query embedding before generating an answer (Priority: P2)

After sending a question, the user reviews what the system actually retrieved before deciding to
generate an answer. Chunks are shown compactly as a list of chunk IDs, each with its own "Show
more" control that reveals the chunk's full content. Below the chunk list, the embedding generated
for the query is shown, initially limited to 2 rows of values, with a "Show more" control at the
bottom right to reveal the rest.

**Why this priority**: This transparency lets the user judge retrieval quality and trust the
pipeline before committing to a generation call — important for the tool's experimentation
purpose, but secondary to the answer itself (User Story 1) being deliverable.

**Independent Test**: Can be fully tested by sending a question and confirming the right side
shows chunk IDs with individual "Show more" controls and a query-embedding preview limited to 2
rows with its own "Show more" control, all without needing to click Generate.

**Acceptance Scenarios**:

1. **Given** a question has been sent and chunks retrieved, **When** the right side renders,
   **Then** each retrieved chunk is identified by its chunk ID and has its own "Show more" control
   to reveal that chunk's full content.
2. **Given** a retrieved chunk's "Show more" control has not been used, **When** the user views
   the chunk list, **Then** only the chunk ID is shown for that chunk, not its full content.
3. **Given** a question has been sent, **When** the query embedding is displayed, **Then** at most
   2 rows of values are shown initially, with a "Show more" control positioned at the bottom right
   to reveal the remaining rows.
4. **Given** the right side is populated after a search, **When** the user views its layout,
   **Then** the Generate control appears above the list of retrieved chunks, and the list of
   retrieved chunks appears above the query embedding.
5. **Given** a generated answer is visible in the left panel, **When** the user clicks/taps that
   answer, **Then** the right side updates to show the retrieved chunks, query embedding, the LLM
   used, and the prompt sent for that specific turn — the full process behind that answer.

---

### User Story 3 - Continue an ongoing, persisted conversation (Priority: P3)

After receiving an answer, the user types another question into the same left-side text field and
sends it again. The new question and its eventual answer are added to the conversation below the
earlier exchange. Every turn is saved as it happens, so if the user leaves the Playground and comes
back to the same document later, their full prior conversation is there waiting for them rather
than starting over.

**Why this priority**: Enables realistic, iterative experimentation once the core single-question
flow (User Story 1) and the inspection view (User Story 2) work — valuable, but not required for
the feature to deliver its primary value on a single question.

**Independent Test**: Can be fully tested by completing one full question/answer cycle, sending a
second, different question, confirming both questions and both answers remain visible in the left
panel in order, then reloading the Playground and confirming the same conversation reappears
automatically for that document.

**Acceptance Scenarios**:

1. **Given** a prior question and its answer are visible in the left panel, **When** the user
   sends a new question, **Then** the new question is added below the previous exchange without
   removing or altering the earlier question or answer.
2. **Given** a new question is sent, **When** chunks are retrieved for it, **Then** the right side
   updates to show the new question's chunks and query embedding, replacing what was shown for the
   previous question (unless the user has clicked an earlier answer to inspect its process).
3. **Given** multiple questions have been asked, **When** the user scrolls the left panel,
   **Then** all prior questions and their answers remain readable in the order they were asked.
4. **Given** a document already has a conversation saved from an earlier visit, **When** the user
   opens the Playground for that document, **Then** the left panel automatically shows that entire
   prior conversation, in order, before any new question is submitted.
5. **Given** the user switches to a different document that has its own saved conversation,
   **When** the switch completes, **Then** the left panel shows that document's conversation
   instead, and the right side clears until a question is sent or a turn is selected.

---

### Edge Cases

- What happens when the query field is empty or only whitespace? No retrieval or generation is
  performed (see User Story 1, Acceptance Scenario 5).
- What happens when a question retrieves no chunks (e.g., document has no saved chunks/embeddings
  yet)? The right side clearly communicates that no chunks are available, and the Generate control
  is unavailable for that question rather than allowing generation with empty context.
- What happens if the user tries to send another question while a retrieval or generation request
  for a prior question is still in progress? The send and Generate controls are disabled until the
  in-flight request finishes or fails (see Clarifications).
- What happens if a user sends a question but never clicks Generate before sending the next one? A
  question with no generated answer is persisted and remains visible in the conversation as an
  unanswered turn; the right side simply moves on to reflect the newest question.
- What happens to the on-screen conversation and the right-side content when the user switches the
  selected document mid-session? The left panel switches to that document's own saved conversation
  (loading it if one exists, or starting empty if it doesn't), and the right side clears until a
  question is sent or a past turn is selected — nothing from the previous document's context is
  ever mixed in.
- What happens when the user navigates away from the Playground or reloads the page? Nothing is
  lost: every turn was already saved as it happened, and reopening the Playground for the same
  document automatically reloads its full conversation (see Clarifications).
- What happens if a retrieved chunk's full content is very long? The expanded "Show more" view
  remains readable (e.g., scrollable within its own area) rather than forcing the whole right side
  to grow unboundedly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Playground screen MUST present two side-by-side areas: a left area for the
  conversation and query input, and a right area for retrieval details.
- **FR-002**: The left area MUST contain a text field for entering a question and a send control
  positioned at the bottom of the left area.
- **FR-003**: When the user submits a non-empty question, the system MUST retrieve the saved
  chunks most relevant to that question and generate an embedding for the question, then display
  both in the right area.
- **FR-004**: The right area MUST present, from top to bottom: a Generate control, then the list
  of retrieved chunks, then the query embedding preview.
- **FR-005**: Each retrieved chunk MUST be shown identified by its chunk ID by default, with its
  own "Show more" control that reveals that chunk's full content.
- **FR-006**: The query embedding preview MUST show at most 2 rows of values by default, with a
  "Show more" control positioned at the bottom right of the preview to reveal the remaining
  values.
- **FR-007**: The Generate control, when activated, MUST send the question together with all of
  the currently retrieved chunks (not only the ones a user has expanded via "Show more") as
  context to a language model and request an answer.
- **FR-008**: The system MUST display the generated answer in the left area, positioned below the
  question that produced it and above the query text field.
- **FR-009**: The system MUST allow the user to submit additional questions after receiving an
  answer, and each new question/answer pair MUST be added to the conversation without removing or
  altering earlier questions or answers.
- **FR-010**: The right area MUST reflect the retrieved chunks and query embedding for the
  currently selected turn — defaulting to the most recently submitted question — and MUST update
  when the user selects a different turn (see FR-018).
- **FR-011**: The system MUST NOT perform retrieval or generation when the submitted question is
  empty or whitespace-only.
- **FR-012**: The system MUST show a clear loading indication while a retrieval request or a
  generation request is in progress, and MUST reveal the generated answer as a single complete
  block once generation finishes (not streamed incrementally).
- **FR-013**: While a retrieval or generation request is in progress, the system MUST disable the
  send control and the Generate control so the user cannot start an overlapping request.
- **FR-014**: If retrieval or generation fails, the system MUST show a clear error message in
  place of the missing result and MUST NOT display a fabricated or partial answer. If generation
  fails, the system MUST offer a retry control on that turn that resends the same question and its
  already-retrieved chunks, without performing a new retrieval or creating a new conversation
  entry.
- **FR-015**: The Generate control MUST be unavailable (or clearly non-functional) when no chunks
  have been retrieved for the current question, such as when the selected document has no saved
  chunks or embeddings.
- **FR-016**: The system MUST persist every conversation turn (the question, the retrieved chunks,
  the specific saved embedding matched for each chunk, the generated query embedding, the LLM
  used, the exact prompt sent, and the resulting response) so it survives navigation away from the
  Playground and page reloads.
- **FR-017**: When the user opens the Playground for a document, the system MUST automatically
  load and display that document's full prior conversation (all previously persisted turns, in
  order) in the left area before any new question is submitted. Switching to a different document
  MUST load that document's own persisted conversation (or an empty conversation if it has none)
  and MUST clear the right area, so nothing shown ever mixes context from two different documents.
- **FR-018**: Each generated answer displayed in the left area MUST be clickable/tappable;
  selecting it MUST populate the right area with that turn's persisted retrieved chunks, query
  embedding, the LLM used, and the prompt sent — allowing any past turn's process to be inspected
  on demand.

### Key Entities

- **Conversation Turn**: A persisted record of one question submitted by the user against a
  specific document, including the retrieved chunks and the specific saved embedding matched for
  each, the generated query embedding, the LLM used, the exact prompt sent, the resulting answer
  (if generation was requested and succeeded), and its position within that document's
  conversation. Turns survive navigation and reloads and are reloaded, in order, whenever the
  Playground is opened for their document.
- **Retrieved Chunk**: A saved chunk matched against a turn's query embedding, identified by its
  chunk ID, shown collapsed by default with an option to reveal its full content.
- **Query Embedding Preview**: The embedding generated for the currently selected turn's question,
  displayed as rows of values with an initial 2-row limit and an option to reveal the rest.
- **Generated Answer**: The language model's response to a specific turn's question, produced
  using that turn's retrieved chunks as context, displayed attached to that question in the
  conversation, and clickable to reveal the turn's full retrieval-and-generation process.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from typing a question to seeing a generated answer without leaving
  the Playground screen or losing sight of the question that produced it.
- **SC-002**: 100% of generated answers remain visibly attached to the specific question that
  produced them, even after 5 or more questions have been asked across one or more visits.
- **SC-003**: A user can review the full content of any retrieved chunk, and the full set of
  values in the query embedding, without triggering answer generation.
- **SC-004**: No conversation turn is ever lost, reordered, or overwritten, including across
  navigating away from and returning to the Playground.
- **SC-005**: A user attempting to send a new question or trigger generation while a request is
  already in progress is prevented from doing so 100% of the time, with no duplicate or
  overlapping requests produced.
- **SC-006**: A user returning to the Playground for a document they've previously questioned sees
  their exact prior conversation restored, with zero setup or manual reload steps.
- **SC-007**: For any past answer, a user can view the exact chunks, query embedding, model, and
  prompt that produced it, matching what was actually used at generation time 100% of the time.

## Assumptions

- This feature builds on the existing single-question retrieval capability (query embedding
  generation plus cosine-similarity chunk search) and restructures its presentation into a
  two-panel, multi-turn chat layout; it does not change how chunks are ranked or selected.
  Document, chunking-strategy, and embedding-model context continue to be shown as read-only
  information reflecting what produced the selected document's saved data, consistent with
  existing Playground behavior.
  - **Note**: This assumption depends on the retrieval capability described in
    `specs/016-playground-similarity-search`. If that feature has not shipped, the retrieval
    behavior it defines (query embedding generation, cosine similarity ranking, top-N chunk
    selection, empty-state and error handling for search itself) is an implicit prerequisite for
    this feature rather than something this spec re-defines.
- "All chunks" sent to the language model for Generate means all chunks currently retrieved and
  shown in the right area for the active question (i.e., the same set the user can inspect via
  "Show more"), not a separately configurable subset.
- The exact number of embedding values shown per row, and the exact styling of chat bubbles versus
  plain text for questions and answers, are presentation details left to implementation, not scope
  decisions.
- A conversation turn that never receives a generated answer (because the user asks a new question
  before clicking Generate, or because generation fails) remains visible as a question-only entry
  in the conversation; it is not retried automatically or removed.
- No limit is placed on the number of questions a user may ask beyond what is practical for
  on-screen scrolling; there is no fixed maximum turn count, and no automatic pruning or expiry of
  older persisted turns, in scope for this feature.
- Generation currently uses a single, pre-configured LLM (no per-turn model selection); the
  persisted record of which LLM produced each answer exists specifically to support comparing
  results if multiple models become available. Letting the user choose the LLM from a dropdown is
  an explicit future enhancement, not in scope for this feature — consistent with how chunking
  strategy and embedding model are already treated as fixed, read-only context elsewhere in the
  Playground.
- Conversations are scoped per document: each document has its own persisted, independent
  conversation, and no turn from one document is ever shown while another document is selected.
