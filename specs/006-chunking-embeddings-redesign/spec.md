# Feature Specification: Chunking Section Redesign & Embeddings Entry Point

**Feature Branch**: `006-chunking-embeddings-redesign`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Rename Experiments to Chunking, Recursive Character and Semantic Chunking need to be part of different type of chunking so remove that. Fixed size is the last option so no need as we are knowingly selecting Fixed Size Chunking. Document Dropdown selection stays as is. Chunk size input and overlap input stays as is, separators stay as is. Let there be a bottom bar that has 2 buttons, Re-calculate chunks and Move to Embeddings. Add another option under Chunking as Embeddings. Let there be a horizontal bar below the "Configure how documents are partitioned" sub header, Add "Select Document" dropdown Chunk size, overlap and separators input in horizontal fashion in this top bar. Lets show a progress bar that goes from 0% to 100% while chunking the doc. Chunks show as is below the top bar and above the bottom bar. Let it all be fit in the screen. Chunks can be internally scrollable list."

## Clarifications

### Session 2026-07-13

- Q: Should the 0%→100% progress bar be driven by real backend-reported progress, or a simulated/time-based client animation? → A: Real backend-reported progress — the backend must report actual progress increments as it processes the document.
- Q: What should the new "Embeddings" screen show when a user navigates to it? → A: A simple "coming soon" placeholder — AppShell/nav intact, a short message, no functional controls or carried-over state; the real Embeddings workflow is a separate future feature.
- Q: Should "Move to Embeddings" be always enabled, or only enabled after a successful chunk calculation in the current session? → A: Enabled only after a successful chunk calculation — the button stays disabled until "Re-calculate Chunks" has completed successfully at least once.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure and recalculate chunks from a single control bar (Priority: P1)

A user working on document preparation navigates to the newly-labeled "Chunking" section, selects a document, adjusts chunk size, overlap, and separators from one horizontal bar, and recalculates chunks to see the resulting output immediately below — all without any of the algorithm-selection clutter that existed before.

**Why this priority**: This is the core, everyday workflow of the screen. Every other change (renaming, progress bar, bottom bar) exists to support this loop of "configure → recalculate → review chunks."

**Independent Test**: Can be fully tested by opening the Chunking screen, changing the chunk size/overlap/document/separator values in the horizontal control bar, clicking "Re-calculate Chunks," and confirming the chunk list updates below the bar.

**Acceptance Scenarios**:

1. **Given** the user is on the Chunking screen, **When** the screen loads, **Then** a horizontal bar appears directly below the "Configure how documents are partitioned" sub-header containing, in order, the Select Document dropdown, Chunk Size input, Overlap input, and Separators control.
2. **Given** the user is on the Chunking screen, **When** the user selects a different document, chunk size, overlap, or separator, **Then** the corresponding control updates its value exactly as it did before this redesign (no behavior change to these controls).
3. **Given** the user has adjusted configuration values, **When** the user clicks "Re-calculate Chunks" in the bottom bar, **Then** the system runs Fixed Size chunking with the current settings and refreshes the chunk list.
4. **Given** the user opens the navigation menu, **When** the user looks for the chunking feature, **Then** they find it under a section labeled "Chunking" (not "Experiments"), and no "Recursive Character," "Semantic Chunking," or algorithm-selection control is present anywhere on the screen.

---

### User Story 2 - See chunking progress and review results without losing screen context (Priority: P2)

While a chunking operation runs, the user sees a progress bar advance from 0% to 100% so they know the system is working. Once finished, the resulting chunks appear in a scrollable list that never forces the whole page to scroll, so the control bar and bottom action bar stay visible and reachable at all times.

**Why this priority**: Feedback during processing and a stable, fully-visible layout are important usability improvements but depend on User Story 1's control bar and recalculation flow already being in place.

**Independent Test**: Can be fully tested by triggering a chunking run on a document with many chunks and confirming (a) a progress bar animates from 0% to 100% during the run, and (b) after completion, the chunk list scrolls internally while the horizontal control bar and bottom bar remain fixed and visible.

**Acceptance Scenarios**:

1. **Given** the user clicks "Re-calculate Chunks," **When** the chunking operation is in progress, **Then** a progress bar is visible and advances from 0% to 100% over the course of the operation.
2. **Given** a document produces more chunks than fit in the visible area, **When** the chunk list renders, **Then** the user can scroll the chunk list independently while the horizontal control bar, sub-header, and bottom bar remain in place and the overall page does not scroll.
3. **Given** the chunking operation completes, **When** the progress bar reaches 100%, **Then** the progress bar is dismissed or reset and the chunk list is shown in its place.

---

### User Story 3 - Move from Chunking to Embeddings (Priority: P3)

Once satisfied with the chunk configuration, the user proceeds to the next step of the pipeline by clicking "Move to Embeddings" from the bottom bar, or by navigating directly to the new "Embeddings" item now listed under the Chunking navigation section.

**Why this priority**: This establishes the entry point into the next pipeline stage. It's valuable but is the natural last step after configuring and reviewing chunks, so it depends on User Stories 1 and 2.

**Independent Test**: Can be fully tested by clicking "Move to Embeddings" from the bottom bar and separately by clicking the new "Embeddings" navigation item, confirming both land the user on the Embeddings screen.

**Acceptance Scenarios**:

1. **Given** the user is on the Chunking screen and has not yet completed a successful chunk calculation in this session, **When** the screen renders, **Then** the "Move to Embeddings" button is disabled.
2. **Given** the user has just completed a successful chunk calculation, **When** the chunk list finishes rendering, **Then** the "Move to Embeddings" button becomes enabled.
3. **Given** the "Move to Embeddings" button is enabled, **When** the user clicks it, **Then** the system navigates the user to the Embeddings screen.
4. **Given** the user opens the navigation menu, **When** the user expands the "Chunking" section, **Then** an "Embeddings" item is listed alongside the chunking screen and selecting it navigates to the Embeddings screen regardless of chunk-calculation state.
5. **Given** the user has navigated to the Embeddings screen, **When** the screen renders, **Then** it shows the standard app navigation shell plus a short "coming soon" style message, with no functional embeddings controls yet.

---

### Edge Cases

- What happens when no documents exist yet? The horizontal control bar and chunk list area MUST show the existing empty-state guidance (as today) instead of rendering the bar with no document to select.
- What happens if chunking fails partway through? The progress bar MUST stop and an error message MUST be shown in place of the chunk list, matching existing error-handling behavior.
- What happens if the user has not yet run a successful chunking calculation? The "Move to Embeddings" button MUST remain disabled until "Re-calculate Chunks" has completed successfully at least once in the current session.
- What happens when the chunk list is empty (e.g., zero chunks returned)? The scrollable chunk list area shows the existing empty/no-content messaging rather than a blank space.
- What happens on very small window heights? The horizontal control bar and bottom bar remain visible and only the chunk list area shrinks/scrolls, rather than any control being pushed off-screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST rename the navigation section currently labeled "Experiments" to "Chunking."
- **FR-002**: System MUST remove the "Recursive Character" and "Semantic Chunking" algorithm options and the algorithm-selection control entirely from the Chunking screen, since Fixed Size Chunking is the only chunking approach presented.
- **FR-003**: System MUST add a new "Embeddings" item under the "Chunking" navigation section.
- **FR-004**: The Chunking screen MUST retain the "Configure how documents are partitioned" sub-header.
- **FR-005**: System MUST display a horizontal control bar immediately below the sub-header containing, in this order: Select Document dropdown, Chunk Size input, Overlap input, and Separators control.
- **FR-006**: The Select Document dropdown MUST retain its existing selection behavior unchanged.
- **FR-007**: The Chunk Size input MUST retain its existing behavior and validation unchanged.
- **FR-008**: The Overlap input MUST retain its existing behavior unchanged.
- **FR-009**: The Separators control MUST retain its existing appearance and behavior unchanged.
- **FR-010**: System MUST display a progress bar that visibly advances from 0% to 100% while a chunking operation is running, driven by real progress increments reported by the backend as it processes the document (not a simulated/time-based animation).
- **FR-011**: System MUST render the chunk list below the horizontal control bar and above the bottom action bar.
- **FR-012**: The chunk list MUST scroll independently ("internally") of the rest of the screen, so that the control bar and bottom bar remain visible without the overall page scrolling.
- **FR-013**: System MUST display a bottom action bar containing exactly two buttons: "Re-calculate Chunks" and "Move to Embeddings."
- **FR-014**: The "Re-calculate Chunks" button MUST re-run Fixed Size chunking using the current values from the horizontal control bar, replacing the previous chunk list.
- **FR-015**: The "Move to Embeddings" button MUST navigate the user to the Embeddings screen, and MUST remain disabled until a chunking calculation has completed successfully at least once in the current session, becoming enabled immediately after such a success.
- **FR-015a**: The Embeddings screen MUST render within the standard app navigation shell and display a short "coming soon" style placeholder message, with no functional embeddings configuration controls and no carried-over document/chunk state.
- **FR-016**: The entire Chunking screen (sub-header, horizontal control bar, chunk list, bottom bar) MUST fit within the visible viewport without requiring the user to scroll the page itself.

### Key Entities

- **Chunking Configuration**: The set of values driving a chunking run — selected document, chunk size, overlap, and separators. Same configuration data as today, just re-arranged into one horizontal bar.
- **Chunk**: A single segment of a document's text produced by a chunking run, shown as an item in the scrollable chunk list.
- **Chunking Run / Progress**: The in-progress state of a chunking operation, represented to the user as a 0–100% progress indicator sourced from real backend-reported progress increments, until the run completes or fails.
- **Embeddings Entry Point**: A new navigation destination and screen under the "Chunking" section that the user reaches either via the sidebar or via "Move to Embeddings"; its internal configuration/workflow is out of scope for this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users locate the chunking feature under the "Chunking" navigation label with no confusion, and no user encounters references to "Experiments," "Recursive Character," or "Semantic Chunking" anywhere in the interface.
- **SC-002**: Users can change document, chunk size, overlap, and separators and trigger a recalculation without any part of the screen requiring a full-page scroll to reach the control bar or bottom bar.
- **SC-003**: 100% of chunking operations display visible progress feedback (a bar moving from 0% to 100%) rather than an indeterminate or absent state.
- **SC-004**: Users can reach the Embeddings screen in a single click from the Chunking screen — always via the navigation menu, and via the bottom bar once a chunk calculation has succeeded.
- **SC-005**: Chunk lists containing any number of chunks (from zero up to hundreds) remain fully browsable via internal scrolling, with the control bar and bottom bar remaining visible and stationary at all times.

## Assumptions

- The "Embeddings" navigation item and screen introduced here are a navigation destination and placeholder "coming soon" landing screen only; the detailed embeddings configuration workflow is a separate future feature and out of scope for this spec.
- Removing the algorithm-selection control means Fixed Size Chunking is the only, implicit chunking method on this screen going forward — no replacement selector is introduced.
- The Separators control keeps its current presentation and interaction model (no new validation or functional wiring is introduced as part of this redesign).
