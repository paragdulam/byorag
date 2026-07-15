# Feature Specification: Vector View Screen

**Feature Branch**: `[014-vector-view-screen]`

**Created**: 2026-07-15

**Status**: Draft

**Input**: User description: "Lets add Move to Vector View button in the Embeddings next to Save button in bottom bar in Embeddings. Vector View will be split in 2 parts. It will have chunks list on one side and on right side, it will show the vector read from DB directly. It can show itself as a matrix. Above the right side section where vector is showin up, there will be a dropdown which will have multiple options like Umap, PCA etc to show points plotted in 3d system. Dont implement Umap and PCA. Currently, only Dropdown with vector option is good enough. Bottom bar will have the Button 'Move to Playground'"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move from Embeddings to Vector View (Priority: P1)

A user who has saved at least one embedding this session clicks a new "Move to Vector View" button, sitting next to "Save" in the Embeddings screen's bottom bar, to move on to inspecting the raw vectors that were actually persisted.

**Why this priority**: This is the entry point for the whole feature — without it, nothing else in this spec is reachable.

**Independent Test**: Can be fully tested by generating and saving embeddings on the Embeddings screen, confirming "Move to Vector View" becomes enabled, and clicking it to land on the Vector View screen.

**Acceptance Scenarios**:

1. **Given** the Embeddings screen with no successful save yet this session, **When** the user looks at the bottom bar, **Then** "Move to Vector View" is present but disabled, next to "Save".
2. **Given** at least one successful save has happened this session, **When** the user looks at the bottom bar, **Then** "Move to Vector View" is enabled.
3. **Given** "Move to Vector View" is enabled, **When** the user clicks it, **Then** the Vector View screen opens.

---

### User Story 2 - Browse chunks and inspect a saved vector (Priority: P1)

On the Vector View screen, the user sees a two-part layout: a list of chunks on the left, and on the right, the actual vector values read directly from the database for whichever chunk (and, if it has more than one saved embedding, whichever saved embedding) is currently selected — displayed as a grid of numbers rather than one long unreadable list.

**Why this priority**: This is the core value of the screen — seeing real, persisted vector data, not another preview.

**Independent Test**: Can be fully tested by selecting a chunk that has exactly one saved embedding and confirming its real stored vector values appear on the right in a grid layout, matching what's in the database for that chunk.

**Acceptance Scenarios**:

1. **Given** the Vector View screen is open for a document with saved chunks, **When** the user looks at the left side, **Then** the document's saved chunks are listed with their content and position.
2. **Given** the user selects a chunk that has exactly one saved embedding, **When** the selection is made, **Then** the right side shows that embedding's actual stored vector values, laid out as a grid rather than a single unbroken list.
3. **Given** the user selects a chunk that has more than one saved embedding (e.g., saved more than once, or with different models), **When** the selection is made, **Then** the user is offered a way to choose which one of that chunk's saved embeddings to view, and the right side shows only the chosen one at a time.
4. **Given** the user selects a chunk that has no saved embeddings at all, **When** the selection is made, **Then** the right side clearly indicates there's nothing saved for that chunk yet, instead of showing a blank or broken area.

---

### User Story 3 - Choose a projection method for future 3D visualization (Priority: P3)

Above the vector display, the user sees a dropdown intended to eventually let them plot the chunk's vectors in a 3D space using different dimensionality-reduction techniques. For now, the dropdown exists and offers a "Vector" option (showing the raw values, per User Story 2); other technique names may appear as visibly-not-yet-available in the list, but only "Vector" actually does anything.

**Why this priority**: This establishes the picker's shape for future work without committing to building the 3D visualization techniques themselves now — lowest priority since it delivers no new capability beyond User Story 2 today.

**Independent Test**: Can be fully tested by opening the dropdown above the vector display and confirming "Vector" is present, selected by default, and produces the same raw-value display as User Story 2, with no functional dead ends if another listed technique is chosen.

**Acceptance Scenarios**:

1. **Given** the Vector View screen is open, **When** the user looks above the vector display, **Then** a dropdown is visible with "Vector" pre-selected.
2. **Given** the dropdown offers other technique names (e.g., referencing dimensionality-reduction methods), **When** the user selects one of them, **Then** the screen makes clear that technique isn't available yet, without crashing or silently doing nothing confusing.

---

### User Story 4 - Move on to the Playground (Priority: P2)

Having inspected vectors, the user clicks a "Move to Playground" button in Vector View's own bottom bar to continue to the next stage of the workflow.

**Why this priority**: Completes the requested navigation chain (Embeddings → Vector View → Playground); ranked above User Story 3 since it's an explicit, concrete ask, but below User Stories 1 and 2 since it's the exit point rather than the core value of this screen.

**Independent Test**: Can be fully tested by opening Vector View and clicking "Move to Playground", confirming it navigates onward.

**Acceptance Scenarios**:

1. **Given** the Vector View screen is open, **When** the user looks at its bottom bar, **Then** a "Move to Playground" button is present.
2. **Given** the user clicks "Move to Playground", **When** the navigation completes, **Then** the user is taken to the Playground screen.

---

### Edge Cases

- What happens if the user navigates to Vector View, then the underlying document's chunks or embeddings change (e.g., chunks re-saved) in another screen, then they return? The chunk list and vector display reflect whatever is currently in the database at the time the screen is viewed — no stale caching is expected to be preserved across navigation.
- What happens if a selected chunk's saved embedding is very large? The grid display must remain usable (e.g., scrollable) rather than breaking the layout.
- What happens if the user reaches Vector View for a document that ends up having zero saved chunks (e.g., they were removed elsewhere)? The chunk list shows a clear empty state rather than an error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Embeddings screen's bottom bar MUST include a "Move to Vector View" action, positioned next to the existing "Save" action.
- **FR-002**: "Move to Vector View" MUST be unavailable until at least one embedding save has succeeded in the current session, mirroring how the Chunking screen gates its own "Move to Embeddings" action on a successful save.
- **FR-003**: Clicking "Move to Vector View" MUST navigate the user to the Vector View screen.
- **FR-004**: The Vector View screen MUST display, on one side, the list of the selected document's saved chunks (content and position).
- **FR-005**: The Vector View screen MUST display, on the other side, the actual stored vector values for the currently selected chunk's chosen saved embedding, read from persisted data rather than recomputed on the fly.
- **FR-006**: The vector values MUST be displayed as a grid of numbers (a matrix layout), not a single long unbroken list.
- **FR-007**: When the selected chunk has more than one saved embedding, the system MUST let the user choose which one to view, and MUST display only the chosen one at a time.
- **FR-008**: When the selected chunk has no saved embeddings, the system MUST clearly indicate that instead of showing an empty or broken vector area.
- **FR-009**: The Vector View screen MUST show a dropdown, positioned above the vector display, for choosing how the vector data is presented.
- **FR-010**: The dropdown MUST include a "Vector" option, selected by default, that produces the raw-grid display described in FR-006.
- **FR-011**: The dropdown MAY list additional technique names (e.g., referencing dimensionality-reduction methods intended for future 3D plotting), but selecting any option other than "Vector" MUST NOT be implemented as functional in this iteration — the system must clearly communicate that such a selection isn't available yet, without erroring.
- **FR-012**: The Vector View screen's own bottom bar MUST include a "Move to Playground" action.
- **FR-013**: Clicking "Move to Playground" MUST navigate the user to the Playground screen.

### Key Entities

- **Saved Embedding Selection**: The specific saved embedding (one of possibly several for a given chunk) currently chosen for display in Vector View — identified by which chunk it belongs to and which save produced it (e.g., its model and when it was saved).
- **Projection Method Selection**: The technique chosen in the dropdown for presenting a chunk's vector data. Only "Vector" (raw values) is functional in this iteration; other listed technique names are placeholders for future capability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the Embeddings screen, a user who has saved embeddings can reach a view of a specific chunk's actual stored vector values in two clicks or fewer (Move to Vector View, then select a chunk).
- **SC-002**: 100% of vector values shown on the Vector View screen match what is actually persisted for that chunk's chosen saved embedding — nothing shown is recomputed or approximated.
- **SC-003**: Users with a chunk that has multiple saved embeddings can view any specific one of them individually, not just the most recent.
- **SC-004**: Users can move from Embeddings through Vector View to Playground without hitting a dead end or an unexplained disabled control at any step, given they've saved at least one embedding.

## Assumptions

- "Playground" is a new, separate screen reachable from Vector View's "Move to Playground" button. Its own functionality is out of scope for this feature; it is expected to start as a minimal placeholder, consistent with how the Embeddings screen itself began as a placeholder before being built out in an earlier iteration.
- The sidebar's existing "Vector View" and "Playground" entries (already present as inert labels) become real, clickable navigation entries once these screens exist, consistent with how "Embeddings" was wired up when it was built.
- Vector View's document (and, where relevant, chunk) selection is independent of whatever was selected on the Embeddings screen — the user picks again on this screen, consistent with how document selection already works independently across the Sources, Chunking, and Embeddings screens.
- The chunk list on Vector View mirrors the same saved-chunks source and display conventions (content, position, existing display caps) already used on the Embeddings screen.
- "Read from DB directly" means the displayed vector values are exactly what's stored for that saved embedding, with no recomputation, rounding beyond normal numeric display, or approximation.
