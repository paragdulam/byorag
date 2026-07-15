# Feature Specification: Fix Saved Chunks Not Showing on Auto-Selected Document

**Feature Branch**: `[015-fix-saved-chunks-not-showing]`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "There is a bug, Chunks are being saved for a document but the saved documents are not seen in Embeddings when i select the document, Currently, its only one corpora, one document in it, 102 chunks. Check why the saved chunks are not shown in the embeddings screen"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See saved chunks for the document that's already selected (Priority: P1)

A user with a corpus containing a document that already has saved chunks opens the Embeddings screen. The document is shown as selected in the document picker (it's the only one, or simply the default choice), but the saved chunks the user knows exist for it are nowhere to be seen — as if nothing had ever been saved.

**Why this priority**: This is the exact bug reported — it makes the Embeddings screen unusable for the most common case (open the screen, see your work). With only one document in a corpus, there is no workaround available to the user at all.

**Independent Test**: Can be fully tested by saving chunks for a document (via the Chunking screen), then opening the Embeddings screen fresh (without touching the document dropdown) and confirming the saved chunks appear immediately.

**Acceptance Scenarios**:

1. **Given** a corpus with exactly one document that has saved chunks, **When** the user opens the Embeddings screen, **Then** the document is shown selected and its saved chunks are displayed without any further action from the user.
2. **Given** a corpus with more than one document, each with saved chunks, **When** the user opens the Embeddings screen, **Then** the saved chunks for whichever document is shown as selected by default are displayed immediately, and switching the dropdown to a different document correctly displays that document's saved chunks.
3. **Given** a document that is shown as selected but has no saved chunks at all, **When** the user opens the Embeddings screen, **Then** the screen clearly shows "no saved chunks yet" rather than looking broken or empty by accident.

---

### User Story 2 - See saved chunks and saved embeddings on Vector View for the already-selected document/chunk (Priority: P1)

The same underlying problem exists on the Vector View screen: when it opens, the document shown as selected doesn't display its saved chunks, and — even once chunks do show — the chunk shown as selected doesn't display its saved embeddings, until the user manually re-touches a dropdown or list item that already looked selected.

**Why this priority**: Same root defect as User Story 1, same severity — Vector View is equally unusable on first load, and equally has no workaround when there's only one document or one chunk.

**Independent Test**: Can be fully tested by opening Vector View for a document with saved chunks (and at least one saved embedding) without touching any dropdown or list item, and confirming both the chunk list and the vector display populate immediately.

**Acceptance Scenarios**:

1. **Given** a corpus with exactly one document that has saved chunks, **When** the user opens the Vector View screen, **Then** the document is shown selected and its saved chunks are displayed without any further action from the user.
2. **Given** the displayed chunk list includes a chunk that is shown as selected by default and has a saved embedding, **When** the user opens the Vector View screen, **Then** that chunk's saved embedding is displayed as a vector grid without the user needing to click it first.
3. **Given** the user then manually selects a different document or a different chunk, **When** that selection is made, **Then** the correct corresponding saved chunks or saved embeddings are displayed, exactly as before this fix.

---

### Edge Cases

- What happens when a corpus has no documents at all? The screen's existing "no documents available" messaging still applies — this fix doesn't change that case.
- What happens when the auto-selected document has zero saved chunks? A clear "no saved chunks yet" message is shown immediately, not a permanently blank area (already covered by existing behavior once loading is actually triggered).
- What happens when a user switches corpora (changing which document would be auto-selected) while already on the Embeddings or Vector View screen? The newly auto-selected document's saved chunks must load immediately, the same as on first open — this isn't limited to the very first page load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Embeddings screen MUST display the saved chunks for whichever document is currently shown as selected in the document picker, without requiring the user to manually interact with the picker first.
- **FR-002**: This MUST hold even when there is only one document available (and therefore no alternative selection the user could make to "unstick" the display).
- **FR-003**: The Vector View screen MUST display the saved chunks for whichever document is currently shown as selected, without requiring manual interaction, under the same conditions as FR-001/FR-002.
- **FR-004**: The Vector View screen MUST display the saved embedding(s) for whichever chunk is currently shown as selected (including a default selection with only one chunk available), without requiring the user to manually click that chunk first.
- **FR-005**: Manually changing the document (or, on Vector View, the chunk) selection MUST continue to correctly update the displayed saved chunks or saved embeddings, exactly as it did before this fix.
- **FR-006**: Switching to a different document (e.g., via changing the active corpus) MUST re-trigger loading of that newly-selected document's saved chunks automatically, not just on the very first screen load.

### Key Entities

- No new data entities — this fix only changes when already-existing saved chunk and saved embedding data becomes visible on screen, not what data exists or how it's stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a single document containing saved chunks sees those chunks on the Embeddings screen within moments of opening it, with zero additional clicks.
- **SC-002**: A user with a single document containing saved chunks and at least one saved embedding sees both the chunk list and that embedding's vector values on the Vector View screen within moments of opening it, with zero additional clicks.
- **SC-003**: 100% of previously-working manual-selection behavior (switching documents or chunks via their pickers) continues to work exactly as before.

## Assumptions

- This is a display/data-loading defect only — the underlying saved chunks and saved embeddings in storage are correct and complete (confirmed for the reporter's case: the document's 102 saved chunks are present and correctly linked). No data repair or migration is needed, only fixing when the screens fetch and show that data.
- The same underlying defect affects both the Embeddings screen (as reported) and the Vector View screen (found via investigation of the same root cause) — this spec's scope covers both, per explicit confirmation.
- No other screens in the application (Chunking, Sources, Corpora) exhibit this defect; they either don't have an equivalent "auto-selected but not yet manually touched" data-loading step, or already load correctly on first render.
