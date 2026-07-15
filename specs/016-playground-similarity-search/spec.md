# Feature Specification: Playground Similarity Search

**Feature Branch**: `[016-playground-similarity-search]`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Lets work on Playground. I want a textfield taking user input with a send button to the right of it. I should see preselected information in this screen. Selected document, Selected chunking strategy, Selected Embedding model above the search textfield. The moment, user enters the query and clicks on send button, the same embedding model should be used to create embedding of the input query, show it in the UI. It should look for cosine similarity with the stored embeddings against chunks. It should return top 5 similar results in the UI as list."

## Clarifications

### Session 2026-07-15

- Q: The spec doesn't yet say what the user sees while a search is running, or if query-embedding generation / similarity search fails. How should this be handled? → A: Mirror the existing Generate Embeddings pattern — show a loading indicator while searching; on failure, show a clear error message and leave the results area empty (no stale/partial results shown).
- Q: Embedding models typically have a maximum input length. What should happen if a user's query text exceeds it? → A: Reject the search with a clear "query too long" message; perform no search.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ask a question and see the most similar saved chunks (Priority: P1)

A user who has already saved chunks and embeddings for a document opens the Playground, types a
natural-language question into the query field, and clicks the send button. The system finds the
5 saved chunks whose stored embeddings are most similar to the question and lists them, so the
user can judge whether their chosen chunking strategy and embedding model would surface the right
content for a real question.

**Why this priority**: This is the entire point of the Playground — without it, the screen has no
value. Every other capability on this screen exists to support this search.

**Independent Test**: Can be fully tested by saving chunks and embeddings for a document (via
Chunking and Embeddings), opening the Playground, entering a query, clicking send, and confirming
a ranked list of up to 5 matching chunks appears.

**Acceptance Scenarios**:

1. **Given** a document with 5 or more saved chunk embeddings, **When** the user enters a query and
   clicks send, **Then** exactly 5 results appear, ordered from most to least similar.
2. **Given** a document with fewer than 5 saved chunk embeddings, **When** the user searches,
   **Then** all of that document's saved chunks appear as results, ordered by similarity, with no
   error or missing-result confusion.
3. **Given** a chunk that has more than one saved embedding (e.g. embeddings were generated and
   saved more than once), **When** results are returned, **Then** that chunk appears at most once,
   using its best-matching saved embedding.
4. **Given** the query field is empty, **When** the user attempts to send, **Then** no search is
   performed and no misleading "no results" state is shown.
5. **Given** a query is submitted, **When** the search is in progress, **Then** a clear loading
   indicator is shown until results (or an error) are ready.
6. **Given** a valid query, **When** query-embedding generation or the similarity search fails,
   **Then** the user sees a clear error message and no stale or partial results remain visible.
7. **Given** a query that exceeds the embedding model's maximum supported input length, **When**
   the user attempts to send it, **Then** the system rejects the search with a clear "query too
   long" message and performs no search.

---

### User Story 2 - See the active search context before searching (Priority: P2)

Before typing anything, the user sees which document, which chunking strategy, and which
embedding model the search is about to use, displayed above the query field. This lets the user
confirm they're testing the setup they intend to test before spending effort on a query.

**Why this priority**: Without visible context, a user can't trust or interpret their search
results — they wouldn't know which document or model produced a given ranking. This is essential
for the experimentation goal of the tool but is secondary to the search itself working.

**Independent Test**: Can be fully tested by opening the Playground with a document already
containing saved chunks and embeddings, and confirming the document name, chunking strategy, and
embedding model are visible above the query field without any interaction.

**Acceptance Scenarios**:

1. **Given** a document with saved chunks and embeddings, **When** the user opens the Playground,
   **Then** the selected document's name, its chunking strategy, and the embedding model used for
   its saved embeddings are all displayed above the query field, with no action required.
2. **Given** the user switches to a different document, **When** that document has its own saved
   chunks and embeddings, **Then** the displayed document, chunking strategy, and embedding model
   update to match the newly-selected document, and any previous query, query embedding, and
   results are cleared.
3. **Given** the selected document has no saved embeddings yet, **When** the user views the
   screen, **Then** this is communicated clearly and the send action does not silently fail.

---

### User Story 3 - See the generated query embedding for transparency (Priority: P3)

After the user submits a query, the embedding generated for that query is displayed in the UI
alongside the search results, so the user can see exactly what was computed and compared against
their stored data — not just trust a black box.

**Why this priority**: Valuable for building confidence in the tool and matches its
experimentation purpose, but the search results themselves (User Story 1) deliver the core value
even without this visibility.

**Independent Test**: Can be fully tested by submitting a query and confirming the generated
embedding values are visible on screen, independent of whether results are also being verified.

**Acceptance Scenarios**:

1. **Given** a valid query is submitted, **When** the embedding is generated, **Then** its values
   are displayed in the UI.
2. **Given** a new query is submitted after a previous one, **When** the new embedding is
   generated, **Then** the displayed embedding updates to the new query's values, replacing the
   old one.

---

### Edge Cases

- What happens when the query field is empty or only whitespace? The send action does not perform
  a search (see US1 Acceptance Scenario 4).
- What happens when the selected document has no saved chunks or no saved embeddings at all? The
  screen clearly states search isn't available yet for this document, rather than erroring or
  appearing broken (see US2 Acceptance Scenario 3).
- What happens when a chunk has multiple saved embeddings from repeated save actions? Only its
  single best-matching embedding counts toward the ranking; the chunk is never duplicated in the
  results list (see US1 Acceptance Scenario 3).
- What happens when the user switches documents mid-session? Search context, any in-progress
  query, the displayed query embedding, and prior results all reset to match the newly-selected
  document (see US2 Acceptance Scenario 2).
- What happens when two or more chunks are equally similar to the query? All tied results are
  included fairly; the specific tie-breaking order is not user-visible or significant.
- What does the user see while a search is running? A clear loading indicator, mirroring the
  Generate Embeddings screen's existing in-progress pattern (see US1 Acceptance Scenario 5).
- What happens if query-embedding generation or the similarity search itself fails? A clear error
  message is shown, and no stale or partial results remain visible (see US1 Acceptance Scenario 6).
- What happens when the submitted query exceeds the embedding model's maximum supported input
  length? The search is rejected with a clear "query too long" message and is not performed (see
  US1 Acceptance Scenario 7).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Playground screen MUST provide a text input for the user's query and a send
  action positioned to its right.
- **FR-002**: The screen MUST display the currently selected document, its chunking strategy, and
  the embedding model used for its saved embeddings, above the query field, before any query is
  submitted.
- **FR-003**: When the user submits a non-empty query, the system MUST generate an embedding for
  that query using the same embedding model used for the selected document's stored chunk
  embeddings.
- **FR-004**: The system MUST display the generated query embedding in the UI after each
  submission.
- **FR-005**: The system MUST compare the query embedding against the selected document's saved
  chunk embeddings using cosine similarity.
- **FR-006**: The system MUST return the 5 most similar chunks (or all of them, if the document
  has fewer than 5 saved chunks), ordered from most to least similar.
- **FR-007**: Each result MUST show enough information — the chunk's content and its similarity
  ranking/score — for the user to judge match quality without extra clicks.
- **FR-008**: When a chunk has more than one saved embedding, the system MUST count it only once
  in the results, using its best-matching saved embedding.
- **FR-009**: The send action MUST NOT perform a search when the query is empty or whitespace-only.
- **FR-010**: When the selected document has no saved embeddings, the system MUST clearly
  communicate that search is unavailable for it rather than performing a silent no-op or showing
  an empty/broken-looking result area.
- **FR-011**: Switching the selected document MUST clear any previous query text, displayed query
  embedding, and search results, so results are never shown against the wrong document's context.
- **FR-012**: The system MUST show a clear loading/in-progress indication while a search (query
  embedding generation plus similarity comparison) is running, mirroring the loading pattern
  already used for embedding generation elsewhere in the app.
- **FR-013**: If query-embedding generation or the similarity search fails, the system MUST show a
  clear error message and MUST NOT display stale or partial results.
- **FR-014**: If the submitted query exceeds the embedding model's maximum supported input length,
  the system MUST reject the search with a clear "query too long" message and MUST NOT perform the
  search.

### Key Entities

- **Search Query**: The natural-language text a user submits, and the embedding generated from it
  for a single search — not persisted beyond the current screen session.
- **Similarity Result**: A saved chunk matched against a query, carrying the chunk's content, its
  position within its document, and its similarity ranking relative to the other returned results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from typing a question to seeing ranked results within a few seconds,
  without leaving the Playground screen.
- **SC-002**: 100% of returned results belong to the currently selected document — no
  cross-document results ever appear.
- **SC-003**: Returned results are always ordered strictly from most to least similar, verifiable
  for any given query and document.
- **SC-004**: When a document has fewer than 5 saved chunks, the number of results returned
  exactly matches the number of saved chunks available — never padded, never an error.
- **SC-005**: A user can identify, without guessing, which document/chunking-strategy/embedding-
  model combination produced a given set of results, 100% of the time.

## Assumptions

- The document whose saved data is searched follows the same "shown as selected" pattern already
  used consistently across Chunking, Embeddings, and Vector View (auto-selects an available
  document; updates when the user picks a different one or switches corpus).
- Chunking strategy and embedding model are shown as read-only context reflecting what was
  actually used to produce the selected document's saved chunks/embeddings — they are not
  independently choosable on this screen. Today the system has exactly one of each (a single
  chunking strategy, a single embedding model), so this has no practical effect yet; if multiple
  strategies or models become available in the future, making them selectable here is a separate,
  future enhancement.
- Search scope is the single selected document, not the entire active corpus — consistent with
  every other screen's document-scoped behavior and with the feature description's framing
  ("Selected document ... above the search textfield").
- Similarity search always runs fresh on each submission; no caching or reuse of a previous
  query's embedding is required.
- The exact visual presentation of the similarity score (e.g., raw cosine value vs. a formatted
  percentage) is a presentation detail left to implementation, not a scope decision.
