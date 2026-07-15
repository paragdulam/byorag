# Feature Specification: Explicit Save Chunks to Database

**Feature Branch**: `[012-save-chunks-button]`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Lets save chunks in the postgres database with chunking technique, if we are saving chunks on Recalculate chunks, lets remove that and add a new button that Saves chunks in db. Please note that Re-calculate chunks should just implement chunking technique and show the output of chunks list"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preview chunks without persisting them (Priority: P1)

A user configures chunk size, overlap, and separators for a document and clicks "Re-Calculate Chunks" to see how the document would be split. The system runs the chunking technique and displays the resulting chunk list, without writing anything to the database. The user can adjust settings and re-run the preview as many times as they like with no database side effects.

**Why this priority**: This is the core behavior change requested — separating "compute and preview" from "persist" is the foundation the rest of the feature depends on.

**Independent Test**: Can be fully tested by running a chunking preview multiple times with different settings and confirming (via the database) that no chunk rows are created or modified, while the on-screen chunk list updates correctly each time.

**Acceptance Scenarios**:

1. **Given** a selected document with no previously saved chunks, **When** the user clicks "Re-Calculate Chunks", **Then** the system displays the computed chunk list and no chunk records are written to the database.
2. **Given** a document that already has saved chunks in the database, **When** the user changes the chunk size and clicks "Re-Calculate Chunks" again, **Then** the on-screen chunk list reflects the new settings while the previously saved chunk records in the database remain unchanged.
3. **Given** the user has run a preview, **When** the user runs another preview with different settings before saving, **Then** only the latest preview is shown on screen (no accumulation of old previews).

---

### User Story 2 - Explicitly save previewed chunks to the database (Priority: P1)

After previewing chunks, a user clicks a new "Save Chunks" button to persist the currently displayed chunks — along with the chunking technique and its parameters (e.g., chunk size, overlap) — to the database, so they can be used in later steps such as generating embeddings.

**Why this priority**: This delivers the actual persistence capability the user asked for and is required for any downstream step (e.g., embeddings) that depends on saved chunks; without it, User Story 1 alone provides no lasting value.

**Independent Test**: Can be fully tested by previewing chunks for a document, clicking "Save Chunks", and then confirming the chunk content, chunking technique, and parameters are retrievable from the database for that document.

**Acceptance Scenarios**:

1. **Given** a successful chunk preview is displayed, **When** the user clicks "Save Chunks", **Then** the system persists the previewed chunks to the database along with the chunking technique name and the parameters used to produce them.
2. **Given** a document that already has saved chunks from a prior save, **When** the user previews new settings and clicks "Save Chunks" again, **Then** the previous saved chunks for that document are replaced by the newly saved set (no duplicate or orphaned chunk records remain).
3. **Given** no chunk preview has been run yet for the current document, **When** the user views the screen, **Then** the "Save Chunks" button is disabled or otherwise unavailable, preventing a save with nothing to save.
4. **Given** a save operation fails (e.g., a database error), **When** the failure occurs, **Then** the system shows the user a clear error message and the previously saved chunks (if any) remain unchanged.

---

### User Story 3 - Understand save status before moving on (Priority: P2)

A user who has previewed chunks wants to know whether those exact chunks have been saved yet, so they don't accidentally move to the next step (embeddings) assuming data is persisted when it isn't.

**Why this priority**: This is a usability safeguard on top of the core save capability — valuable, but the feature is still functional without it.

**Independent Test**: Can be fully tested by previewing chunks, confirming the screen indicates an unsaved state, saving, confirming the screen indicates a saved state, then changing settings and re-previewing to confirm the state reverts to unsaved.

**Acceptance Scenarios**:

1. **Given** a fresh, successful chunk preview that has not been saved, **When** the user looks at the screen, **Then** the screen indicates the current chunks are not yet saved.
2. **Given** the user has just clicked "Save Chunks" successfully, **When** the save completes, **Then** the screen indicates the current chunks are saved.
3. **Given** previously saved chunks are shown as saved, **When** the user re-runs "Re-Calculate Chunks" with different settings, **Then** the screen reverts to indicating the newly previewed chunks are not yet saved.

---

### Edge Cases

- What happens if the user navigates away from the screen (or switches to a different document) after previewing but before saving? The unsaved preview is discarded; any previously saved chunks for that document in the database are unaffected.
- What happens if extraction fails during "Re-Calculate Chunks" (no text could be extracted)? No chunks are shown and "Save Chunks" remains unavailable, consistent with existing extraction-failure handling.
- What happens if the user clicks "Save Chunks" twice in quick succession? The system must not create duplicate chunk records; the second click either saves an equivalent replacement set or is ignored while a save is already in progress.
- What happens if the number of computed chunks exceeds the maximum number the system displays/persists at once? The save operation persists the same bounded set of chunks that was shown in the preview, consistent with existing display limits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to run a chunking preview ("Re-Calculate Chunks") that computes chunks for a selected document using the chosen chunking technique and parameters, and displays the resulting chunk list, without persisting any data to the database.
- **FR-002**: The system MUST provide a distinct "Save Chunks" action, separate from the preview action, that persists the currently previewed chunks to the database.
- **FR-003**: When chunks are saved, the system MUST persist, for each chunk: its content, its position/order within the document, the chunking technique used, and the parameters used to produce it (e.g., chunk size, overlap).
- **FR-004**: The "Save Chunks" action MUST be unavailable (e.g., disabled) whenever there is no successfully computed chunk preview to save.
- **FR-005**: Saving chunks for a document that already has previously saved chunks MUST replace the prior saved set entirely — the database must not accumulate multiple saved sets for the same document.
- **FR-006**: Running "Re-Calculate Chunks" again after a save MUST NOT modify or delete the previously saved chunks in the database until the user explicitly saves the new preview.
- **FR-007**: The system MUST communicate to the user whether a save succeeded or failed, and on failure MUST leave any previously saved chunks unchanged.
- **FR-008**: The system MUST indicate, on screen, whether the currently displayed (previewed) chunks match what is currently saved in the database for that document, so the user can distinguish an unsaved preview from a saved state.
- **FR-009**: The system MUST NOT allow overlapping/concurrent save requests for the same document to result in duplicate or corrupted saved chunk records.

### Key Entities

- **Chunk**: A saved segment of a document's text, with an ordinal position within the document, its text content, the chunking technique that produced it, and the technique's parameters (e.g., chunk size, overlap). Chunks are persisted only through an explicit save action, tied to one document, and each save fully replaces any prior saved chunks for that document.
- **Chunking Preview**: The transient, unsaved result of running a chunking technique against a document — the chunk list and parameters currently shown to the user. Exists only in the current screen session until saved.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can preview chunking results for a document with any number of setting changes without ever creating unwanted or stale database records.
- **SC-002**: 100% of chunk saves result in the database reflecting exactly the chunks, technique, and parameters that were on screen at the moment "Save Chunks" was clicked.
- **SC-003**: Users can tell, within a glance at the screen, whether their current chunk preview has been saved, with no ambiguity between "previewed" and "saved" states.
- **SC-004**: A document's saved chunk set is never left in a duplicated or partially-overwritten state, even under repeated save attempts.

## Assumptions

- The chunking technique for this screen remains "fixed-size" chunking, consistent with current scope; the save mechanism is designed to also record whichever technique produced the chunks, so it is compatible with additional techniques later.
- The existing cap on the number of chunks computed/displayed per run continues to apply, and "Save Chunks" persists that same bounded set rather than an unbounded full document chunk list.
- Saving is scoped per document: saving chunks for one document does not affect saved chunks belonging to any other document.
- "Move to Embeddings" continues to require at least one successful save action for the active document (i.e., the user must save before proceeding), since embeddings are expected to be generated from persisted chunks rather than an in-memory preview.
