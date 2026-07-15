# Feature Specification: Generate and Save Chunk Embeddings

**Feature Branch**: `[013-bert-pgvector-embeddings]`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Lets do embeddings. I want to use BERT for embeddings for now. It should be a dropdown in the app where I can use any other type of embedding model. Additionally, lets use pgvector for now as we have already integrated PostgreSQL for now and it should be relatively simpler if we avoided qdrant for now. Will use qdrant in future scope. When it comes to UI, Lets show the saved chunks for a pdf which also can be changed using a dropdown. Bottom bar just like it was in chunking should have Generate Embeddings and Save buttons. Generate will generate the embeddings and save will save them in pgvector. Lets create a new Table called Embeddings which is one chunk to many embeddings. I wish to experiment embeddings with chunks in future. Clicking on Save should show the progress on saving both in chunking section and embeddings section. Generate embeddings should also show progress."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a document's saved chunks and choose an embedding model (Priority: P1)

A user who has already saved chunks for a document (from the chunking step) opens the Embeddings screen, picks that document from a dropdown, and sees its saved chunks listed. They also see a dropdown to choose which embedding model to use, defaulting to a general-purpose text embedding model, with room to add other models later.

**Why this priority**: This is the foundation everything else depends on — without seeing the right chunks and choosing a model, nothing downstream (generating or saving embeddings) is meaningful.

**Independent Test**: Can be fully tested by opening the Embeddings screen, switching the document dropdown between two documents that both have saved chunks, and confirming the displayed chunk list and model dropdown are present and correct for the currently selected document — no generation or saving required.

**Acceptance Scenarios**:

1. **Given** a document with saved chunks, **When** the user selects it from the document dropdown, **Then** its saved chunks are displayed with their content and position.
2. **Given** the Embeddings screen is open, **When** the user looks at the model picker, **Then** a default embedding model is pre-selected and other options can be chosen (even if only one is available today).
3. **Given** a document with no saved chunks, **When** the user selects it, **Then** the screen clearly indicates there are no saved chunks to work with instead of showing an empty or broken chunk list.

---

### User Story 2 - Generate an embeddings preview with visible progress (Priority: P1)

Having selected a document's saved chunks and a model, the user clicks "Generate Embeddings" to compute embeddings for those chunks. They see progress while it runs, and once done, they can review the generated embeddings before deciding whether to save them.

**Why this priority**: This is the core computation the feature exists to provide, and — mirroring the chunking screen's pattern — must be a safe, repeatable preview step that never silently persists data.

**Independent Test**: Can be fully tested by clicking "Generate Embeddings" for a document's saved chunks and confirming a progress indicator appears while it runs, that a completed result is shown afterward, and that nothing is persisted to storage as a result of generating alone.

**Acceptance Scenarios**:

1. **Given** a document's saved chunks are displayed and a model is selected, **When** the user clicks "Generate Embeddings", **Then** a progress indicator appears while embeddings are computed for all displayed chunks.
2. **Given** generation has completed successfully, **When** the user looks at the screen, **Then** it's clear generation succeeded and nothing has been saved yet.
3. **Given** the user changes the selected document or model after a successful generation, **When** they generate again, **Then** the previous unsaved preview is replaced by the new one.
4. **Given** no saved chunks exist for the selected document, **When** the user looks at "Generate Embeddings", **Then** it is unavailable, since there's nothing to embed.

---

### User Story 3 - Save generated embeddings, keeping history per chunk (Priority: P2)

After reviewing a generated embeddings preview, the user clicks "Save" to persist those embeddings. Saving shows its own progress. Because the user wants to compare embedding models and re-generation runs over time, saving again for a chunk does not erase what was saved before — a chunk can end up with several saved embeddings (e.g., one per model, or repeated runs), all still tied back to that chunk.

**Why this priority**: This delivers the lasting value of the feature (durable, comparable embeddings) and depends on User Story 2 already existing; it's ranked below US1/US2 because a user can still get value from previewing embeddings even before persistence is fully built out.

**Independent Test**: Can be fully tested by generating and saving embeddings for a chunk with one model, then generating and saving again with a different model (or the same model again), and confirming both saved embeddings are still retrievable for that chunk afterward — not just the most recent one.

**Acceptance Scenarios**:

1. **Given** a successful embeddings preview is displayed, **When** the user clicks "Save", **Then** a progress indicator appears while the embeddings are persisted, and the screen confirms once saving completes.
2. **Given** a chunk already has a saved embedding, **When** the user generates and saves a new embedding for the same chunk (same or different model), **Then** the earlier saved embedding for that chunk is still retrievable afterward — it is not overwritten or deleted.
3. **Given** no successful generation has happened yet, **When** the user looks at "Save", **Then** it is unavailable, since there is nothing to save.
4. **Given** a save is in progress, **When** the user looks at the Embeddings screen, **Then** its own progress indicator reflects that save — independently of anything shown on the Chunking screen, which has its own separate save action and progress indicator for saving chunks.
5. **Given** a save fails, **When** the failure occurs, **Then** the user sees a clear error message and any previously saved embeddings remain unchanged.

---

### Edge Cases

- What happens if the user navigates away from the Embeddings screen (or switches documents/models) while an unsaved embeddings preview is displayed? The unsaved preview is discarded; any already-saved embeddings are unaffected.
- What happens if the user clicks "Save" more than once in quick succession? No duplicate or corrupted saved embeddings result; the save action is unavailable again once a save is in flight.
- What happens if generation fails partway (e.g., a chunk's text cannot be embedded)? The user sees a clear error and no partial/broken preview is shown as if it succeeded.
- What happens when a document's saved chunks change (re-saved with new chunking settings) after embeddings were previously saved for its old chunks? Previously saved embeddings remain tied to the specific chunk records that produced them; the feature does not need to retroactively reconcile them against newly saved chunks in this iteration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the user pick, from a dropdown, which document's previously-saved chunks to work with, scoped to documents that have saved chunks.
- **FR-002**: The system MUST display the selected document's saved chunks (content and position), or a clear message when the selected document has no saved chunks.
- **FR-003**: The system MUST let the user pick an embedding model from a dropdown, pre-selecting a default general-purpose text embedding model, and MUST be structured so additional models can be added later without redesigning the picker.
- **FR-004**: The system MUST provide a "Generate Embeddings" action that computes embeddings for all currently-displayed saved chunks using the selected model, without persisting anything.
- **FR-005**: The system MUST show a visible progress indicator while embeddings are being generated.
- **FR-006**: The system MUST provide a separate, explicit "Save" action that persists the most recently generated embeddings preview.
- **FR-007**: "Save" MUST be unavailable whenever there is no successfully generated embeddings preview to save.
- **FR-008**: The system MUST show a visible progress indicator, on the Embeddings screen, while embeddings are being saved — independent of and unaffected by the Chunking screen's own save progress indicator, and vice versa.
- **FR-009**: Saving embeddings for a chunk that already has saved embeddings MUST add to, not replace, that chunk's saved embeddings — a chunk may end up with multiple saved embeddings over time.
- **FR-010**: Each saved embedding MUST record which chunk it belongs to and which model produced it, so saved embeddings remain traceable back to their originating chunk and model.
- **FR-011**: The system MUST communicate whether a save succeeded or failed, and on failure MUST leave previously saved embeddings unchanged.
- **FR-012**: "Generate Embeddings" MUST be unavailable when the selected document has no saved chunks.
- **FR-013**: The system MUST NOT allow overlapping/concurrent save requests for the same generation to result in duplicate or corrupted saved embeddings.

### Key Entities

- **Embedding**: A saved numeric representation of one chunk's content, produced by a specific embedding model. Belongs to exactly one chunk; a chunk may have many saved embeddings (e.g., from different models, or repeated generation runs), each retained rather than replaced, to support comparing results later.
- **Embedding Model Selection**: The model chosen to produce a batch of embeddings. Only one option is available today (a general-purpose text embedding model), with the selection mechanism designed to support more models being added later.
- **Embedding Preview**: The transient, unsaved result of generating embeddings for the currently displayed chunks with the selected model. Exists only in the current screen session until saved, replaced by a new generation, or discarded by navigating away.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between documents with saved chunks and see the correct chunk list for each within a couple of seconds, with no manual refresh needed.
- **SC-002**: Users can preview generated embeddings for a document's chunks any number of times without any data being persisted until they explicitly save.
- **SC-003**: 100% of saved embeddings remain individually retrievable afterward, each traceable to the chunk and model that produced it.
- **SC-004**: A chunk that has been embedded and saved with two different models (or twice with the same model) ends up with two distinct saved embeddings, not one overwriting the other.
- **SC-005**: Users always know, at a glance, whether the currently displayed embeddings preview has been saved yet.

## Assumptions

- The embedding model available at launch is a general-purpose text embedding model (referred to by the requester as "BERT"); the model picker is designed so more models can be added later without a redesign, consistent with this project's pluggable-architecture approach to every RAG pipeline stage.
- Persisted embeddings are stored in this project's existing relational database (extended to store vector data), rather than in a separate dedicated vector database, for this iteration. A dedicated vector database remains explicitly out of scope for now and is expected to be addressed in a future iteration — this differs from prior guidance that named a separate vector store as part of the standing technical approach, so it is called out here for explicit reconciliation before implementation planning proceeds.
- "Generate Embeddings" always operates on the full set of currently displayed saved chunks for the selected document; there is no per-chunk selection in this iteration.
- Only documents that already have saved chunks can have embeddings generated for them; the document dropdown and screen messaging make this distinction clear.
- Switching to a different document or model while an unsaved embeddings preview is displayed discards that preview, consistent with the equivalent discard behavior already established for chunk previews; it never affects already-saved embeddings.
- Save progress is shown independently on each screen that has its own save action (Chunking's chunk-save progress, Embeddings' embedding-save progress) — there is no shared or global cross-screen progress indicator in this iteration.
