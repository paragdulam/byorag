# Feature Specification: Fixed Size Chunking Experiment

**Feature Branch**: `005-fixed-size-chunking`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "I want Experiments to have sub options from the left bar. Experiments' first option should be called \"Fixed Size Chunking\". Chunking is a part of RAG. What it does is breaks down the PDF data in pieces. Obviously, the text from PDF has to be extracted, can use docling for that. Let user input chunk size. Once the chunking is done, a list of chunks show up. Refer chunking.png in the assets folder for user interface. Ignore the Comparison section that the image has for now. Keep the other options but keep them non functional for now. We are only interested in creating chunks of the PDFs and show them in this UI."

## Clarifications

### Session 2026-07-13

- Q: Which document(s) should the Fixed Size Chunking screen operate on? → A: One selected document at a time — the user picks a single PDF from their uploaded Sources corpus, and chunking runs against just that document's extracted text.
- Q: Should the chunk list have a maximum number of chunks it displays, for documents that produce a very large number of chunks? → A: Cap the display at a fixed maximum (200 chunks) — chunks beyond the cap are not rendered, and the user sees a clear note that more chunks exist beyond the displayed limit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach Fixed Size Chunking from the sidebar (Priority: P1)

As the user of the RAG experimentation tool, I want the "Experiments" item in the left sidebar to
reveal sub-options, with "Fixed Size Chunking" as the first one, so that I can get to the chunking
experiment screen the same way I navigate the rest of the app.

**Why this priority**: Without a way to reach the screen, none of the chunking functionality is
reachable at all. This is the entry point for the entire feature.

**Independent Test**: Can be fully tested by opening the app, selecting "Experiments" in the
sidebar, confirming its sub-options appear with "Fixed Size Chunking" listed first, and selecting
it to land on the Fixed Size Chunking screen.

**Acceptance Scenarios**:

1. **Given** the app is open on any screen, **When** the user selects "Experiments" in the left
   sidebar, **Then** a set of sub-options appears under it, with "Fixed Size Chunking" as the
   first one listed.
2. **Given** the Experiments sub-options are visible, **When** the user selects "Fixed Size
   Chunking", **Then** the Fixed Size Chunking screen opens.

---

### User Story 2 - Chunk a selected document and view the results (Priority: P1)

As the user, I want to pick one of my uploaded PDFs, enter a chunk size, and run chunking, so that
I can see the document's extracted text broken into a list of fixed-size pieces.

**Why this priority**: This is the actual value of the feature — everything else exists to support
getting to this outcome. The feature delivers nothing if a user can reach the screen but can't
produce and see chunks.

**Independent Test**: Can be fully tested by opening the Fixed Size Chunking screen, selecting an
already-uploaded document, entering a chunk size, triggering the chunking action, and confirming a
list of chunks appears reflecting that document's content.

**Acceptance Scenarios**:

1. **Given** the Fixed Size Chunking screen is open and at least one document has been uploaded via
   Sources, **When** the user selects that document, **Then** it becomes the active document for
   this chunking run.
2. **Given** a document is selected, **When** the user enters a chunk size and triggers chunking,
   **Then** the document's text is extracted and split into pieces no larger than that chunk size,
   and the resulting chunks are displayed as a list.
3. **Given** a chunk list is already displayed, **When** the user changes the chunk size and
   triggers chunking again on the same document, **Then** the displayed list is replaced with the
   newly computed chunks (smaller chunk size → visibly more, smaller chunks; larger chunk size →
   visibly fewer, larger chunks).
4. **Given** the selected document has no extractable text (e.g., a scanned image with no text
   layer), **When** the user triggers chunking, **Then** a clear message explains that no text
   could be extracted, and no chunk list is shown.
5. **Given** the user enters an invalid chunk size (empty, zero, or negative), **When** they
   attempt to trigger chunking, **Then** a clear validation message is shown and chunking does not
   run.

---

### User Story 3 - See the rest of the reference design without it doing anything yet (Priority: P3)

As the user, I want the other chunking controls shown in the reference design (alternate
algorithms, overlap, separators) to be visible on the screen even though they don't work yet, so
that the screen matches the intended full design and I know more is coming later.

**Why this priority**: Purely about visual/scope completeness against the reference design; the
feature is fully usable for its stated purpose (producing and viewing fixed-size chunks) without
this, but leaving these controls out entirely would understate the intended final screen.

**Independent Test**: Can be fully tested by opening the Fixed Size Chunking screen, confirming the
extra controls (other algorithm choices, overlap, separators) are visible, interacting with them,
and confirming they have no effect on the chunk size input, the extraction, or the displayed chunk
results.

**Acceptance Scenarios**:

1. **Given** the Fixed Size Chunking screen is open, **When** the user looks at the configuration
   panel, **Then** the alternate algorithm options, overlap control, and separator options from the
   reference design are visible alongside the chunk size input.
2. **Given** those extra controls are visible, **When** the user interacts with them (e.g., selects
   a different algorithm option, adjusts overlap), **Then** nothing about the actual chunking
   behavior or displayed results changes — only the chunk size input and the trigger action affect
   the output.
3. **Given** the reference design's "Comparison" section, **When** the user views the Fixed Size
   Chunking screen, **Then** no Comparison section is present at all (out of scope for this
   feature, not merely non-functional).

---

### Edge Cases

- What happens if the user opens "Fixed Size Chunking" before uploading any documents in Sources?
  The screen shows a clear empty/prompt state directing the user to add a source document first,
  with no document selectable and chunking unavailable.
- What happens if the user navigates away from the Fixed Size Chunking screen and back? The
  screen resets to its empty/default state — there is no expectation that a previous chunking
  result is remembered or restored.
- What happens if the selected document is deleted (via `004-delete-source-documents`) while its
  chunk results are still displayed? The currently displayed chunk list is not automatically
  invalidated by an external deletion; the next attempt to select or re-chunk that document simply
  finds it no longer available in the document picker.
- What happens with an extremely large chunk size (larger than the entire document's extracted
  text)? The document produces a single chunk containing all of its extracted text.
- What happens when a document and chunk size combination produces more than 200 chunks (e.g., a
  large document split at a very small chunk size)? Only the first 200 chunks are displayed, and a
  clear note tells the user that more chunks exist beyond what is shown, rather than silently
  dropping the rest or freezing the screen trying to render all of them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The left sidebar's "Experiments" item MUST reveal a set of sub-options when selected,
  with "Fixed Size Chunking" as the first sub-option listed.
- **FR-002**: Selecting the "Fixed Size Chunking" sub-option MUST open a dedicated screen for this
  experiment.
- **FR-003**: The Fixed Size Chunking screen MUST let the user choose one document from their
  already-uploaded Sources corpus to chunk.
- **FR-004**: The screen MUST let the user specify a chunk size before running chunking.
- **FR-005**: Triggering chunking MUST extract the text content of the selected document.
- **FR-006**: Triggering chunking MUST split the extracted text into fixed-size pieces according to
  the specified chunk size.
- **FR-007**: After chunking completes, the screen MUST display the resulting chunks as a list,
  each showing its content and its position/order among the results.
- **FR-007a**: If a chunking run produces more than 200 chunks, the screen MUST display only the
  first 200 and MUST show a clear note that additional chunks exist beyond the displayed limit.
- **FR-008**: The screen MUST also present the other chunking configuration controls shown in the
  reference design (alternate algorithm choices, overlap, separators), but interacting with them
  MUST NOT change the chunking behavior or the displayed results in this feature.
- **FR-009**: The screen MUST NOT include the reference design's "Comparison" section.
- **FR-010**: The screen MUST show a clear validation message and MUST NOT run chunking when the
  entered chunk size is empty, zero, or negative.
- **FR-011**: The screen MUST show a clear empty/prompt state when no documents are available to
  select for chunking.
- **FR-012**: The screen MUST show a clear error message when text cannot be extracted from the
  selected document, rather than showing a blank or broken chunk list.

### Key Entities

- **Chunk**: A single fixed-size piece of a document's extracted text produced by one chunking
  run — has its text content and its position/order relative to the other chunks from the same
  run.
- **Chunking Result**: The full ordered set of chunks produced by triggering chunking once, for one
  selected document at one chunk size — exists only for display in the current screen session (see
  Assumptions) and is replaced whenever chunking is re-triggered. The screen displays at most the
  first 200 chunks of this set (FR-007a); the result's total chunk count is still communicated to
  the user even when the displayed list itself is capped.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reach the Fixed Size Chunking screen from anywhere else in the app in 2
  clicks (select "Experiments", then select "Fixed Size Chunking").
- **SC-002**: Users can go from selecting a document to seeing its chunk list on screen without
  navigating away from the Fixed Size Chunking screen.
- **SC-003**: For the same document, users can observe the chunk list visibly change (more/smaller
  chunks vs. fewer/larger chunks) when they change the chunk size and re-run chunking, confirming
  the chunk size input genuinely drives the result.
- **SC-004**: 100% of the time no document is available, or the selected document's text cannot be
  extracted, or the chunk size entered is invalid, the user sees a specific, explanatory message
  rather than a blank screen, a crash, or a silently-ignored action.
- **SC-005**: 100% of the time a chunking run produces more than 200 chunks, the user sees an
  explicit note that more chunks exist beyond the displayed 200, rather than assuming the visible
  list is the complete result.

## Assumptions

- Chunking results are ephemeral: nothing about a chunking run (selected document, chunk size, or
  the resulting chunk list) is saved or persisted beyond the current viewing of the screen — this
  matches the project's current no-database, filesystem-only backing for source documents and the
  constitution's Single-User Simplicity (YAGNI) principle. Later features may add saving/comparing
  runs; that is out of scope here.
- Chunk size is expressed in the same unit shown in the reference design (an approximate token
  count), not raw character count — an exact match to any specific LLM's tokenizer is not required
  for this feature; a consistent, reasonable approximation is sufficient for the user to see the
  chunk size input meaningfully affect the output (SC-003).
- Only the chunk size input and the action that triggers chunking affect the actual output in this
  feature. The alternate algorithm options, overlap, and separator controls from the reference
  design are shown for visual/scope completeness (User Story 3) but are inert — this feature does
  not implement Recursive Character or Semantic Chunking, nor overlap or custom separators.
- "Extracting text" from a PDF means recovering its plain text content well enough to split into
  chunks; this feature does not need to preserve PDF layout, images, or formatting in the extracted
  text or in the displayed chunks.
- The Fixed Size Chunking screen operates independently per visit — it does not need to remember
  the last-selected document or chunk size across navigations away and back (see Edge Cases).
