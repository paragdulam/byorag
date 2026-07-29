# Feature Specification: PDF Fullscreen Reading & In-Context Chunk Preview

**Feature Branch**: `023-pdf-fullscreen-chunk-view`

**Created**: 2026-07-29

**Status**: Draft

**Input**: User description: "There are 2 changes. In Sources screen, I want the chunked preview button removed and I want PDF controls in the PDF Preview. User can click on full screen button which will occupy the left part of the screen as well where the user can read the PDFs with scrolling feature. Basically I want this pdf preview for user to read. There should be a button that restores the position of the PDF viewer as well as before. Full screen 100% of the sources detail and normally, 50% on the right side. The second change is in the Fixed Sized chunking detail screen, The chunked preview must be shown here on the right side of the screen with original chunk list on the left side. The chunked preview should show the PDF page that the chunk belongs to. This should only show the area where the chunk belongs to and the neighbouring chunk should show. Do not show scrollble entire PDF. The structure should be replicated to its max capability. Headers, footers, paragraphs should be preserved. The background color should how as chunk annotation with overlap with overlap which is already implemented."

## Clarifications

### Session 2026-07-29

- Q: How much neighboring context should the in-context chunk preview show around the selected chunk? → A: Exactly one preceding chunk and one following chunk (up to 3 chunks total, when both exist).
- Q: When the selected chunk (or a shown neighbor) spans more than one PDF page, what should the in-context preview show? → A: Every page touched by the selected chunk and its shown neighbor(s), stacked in page order.
- Q: Does the Sources PDF Preview's fullscreen state persist when switching documents or navigating away and back to Sources? → A: No — fullscreen always resets to the normal 50% split on document change or screen re-entry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a source PDF comfortably in Sources (Priority: P1)

A user browsing the Sources screen wants to actually read an uploaded PDF — not just glance at a small preview pane — without leaving the screen or losing their place in the document list. Today's PDF preview pane is fixed at half the screen width with no reading controls, and a "Chunked Preview" toggle sits alongside it that no longer belongs on this screen (chunk-annotated preview is moving to the Fixed Size Chunking screen, per User Story 2).

**Why this priority**: This is the simpler, self-contained change and directly improves the most basic use of the Sources screen — actually reading a document — for every user, every session.

**Independent Test**: Can be fully tested by opening any processed document's PDF preview on the Sources screen, expanding it to fullscreen, scrolling through it to read content, and restoring it back to the normal split layout — without touching chunking or embeddings at all.

**Acceptance Scenarios**:

1. **Given** a user has selected a document and its PDF preview is showing in the normal (50% width) layout, **When** the user clicks the fullscreen control, **Then** the PDF preview expands to occupy 100% of the Sources screen's content area (in place of the document list) and remains scrollable so the user can read the full document.
2. **Given** the PDF preview is in fullscreen, **When** the user clicks the restore control, **Then** the layout returns to the normal split (document list on the left, PDF preview at 50% width on the right).
3. **Given** a user is viewing the Sources screen, **When** they look at the PDF preview pane, **Then** there is no "Chunked Preview" button present anywhere on this screen.
4. **Given** the PDF preview is in fullscreen for one document, **When** the user selects a different document from the list, **Then** the preview shows the newly selected document's PDF and the layout resets to the normal (50%) split rather than staying in fullscreen.

---

### User Story 2 - See each chunk in its original page context during Fixed Size Chunking (Priority: P2)

A user configuring Fixed Size Chunking wants to understand exactly where a given chunk sits within the source document's real page layout — not just as extracted plain text — so they can judge whether their chunk size and overlap settings are cutting text in sensible places (e.g., not splitting mid-table, not losing a heading from its section). Selecting a chunk from the existing chunk list should show that chunk (plus its immediate neighbors — one before, one after) highlighted directly on the original page(s) it came from, with headers, footers, and paragraph structure preserved, and with the existing chunk/overlap background-color annotation applied.

**Why this priority**: This is the more substantial change (spans backend page-mapping plus frontend layout and rendering) and builds on the structural-preview and chunk/overlap coloring work already in place. It delivers the deepest insight into chunking behavior but is not required for basic PDF reading (User Story 1).

**Independent Test**: Can be fully tested by opening Fixed Size Chunking for a document with saved chunks, selecting different chunks from the list, and confirming the right-hand preview updates each time to show that chunk's page(s) with correct structure and color annotation — independent of any Sources-screen changes.

**Acceptance Scenarios**:

1. **Given** a document with saved chunks is open in Fixed Size Chunking, **When** the screen loads, **Then** the chunk list is shown on the left and an in-context preview pane is shown on the right, with one chunk pre-selected (defaulting to the first chunk) and its page context already displayed.
2. **Given** the chunk list and in-context preview are both visible, **When** the user selects a different chunk from the list, **Then** the right-hand preview updates to show that chunk's page context, replacing the previous chunk's view.
3. **Given** a chunk is selected, **When** the in-context preview renders, **Then** it shows only the page(s) touched by the selected chunk and its one preceding and one following neighbor — not the entire document scrolled to that point — with no scrolling through unrelated pages required.
4. **Given** the in-context preview is showing a chunk's page(s), **When** the user inspects the rendered content, **Then** headers, footers, and paragraph/list structure from the original page are preserved (not collapsed into a single run-on block of text).
5. **Given** the in-context preview is showing a chunk and its neighbors, **When** the user inspects the background coloring, **Then** the selected chunk, its neighbors, and any overlapping span between them are each colored per the existing chunk/overlap annotation scheme (distinct chunk colors, distinct overlap color).
6. **Given** the selected chunk is the very first or very last chunk of the document, **When** the in-context preview renders, **Then** it shows only the neighbor(s) that actually exist (no error, no placeholder for a missing neighbor).
7. **Given** a selected chunk (or one of its shown neighbors) spans more than one PDF page, **When** the in-context preview renders, **Then** it shows every page touched by the selected chunk and its shown neighbors, stacked in page order.

### Edge Cases

- A document has zero saved chunks: Fixed Size Chunking's in-context preview area shows the existing "no chunks yet" state instead of an empty or broken preview.
- A document's underlying PDF file is missing or unreadable on disk: the in-context preview surfaces the same not-available handling used by today's structural preview, rather than a blank pane.
- A chunk's neighbor belongs to a page far away from the selected chunk's page (e.g., due to unusual chunk sizing): the preview still only shows the selected chunk's and its neighbor(s)' pages — never the entire document.
- The user resizes their browser window while the Sources PDF preview is in fullscreen: the fullscreen pane continues to occupy the full content-area width at the new size.
- The user is on the Sources screen with the PDF preview in fullscreen and navigates away to another screen, then back to Sources: the preview returns to the normal (50%) split rather than reopening in fullscreen.

## Requirements *(mandatory)*

### Functional Requirements

**Sources screen — PDF fullscreen reading (User Story 1)**

- **FR-001**: The Sources screen MUST NOT display a "Chunked Preview" button or any chunk-annotated document view; the PDF preview pane MUST be the only content shown for a selected document.
- **FR-002**: The PDF preview pane MUST provide a fullscreen control that, when activated, expands the pane to occupy 100% of the Sources screen's content area (replacing the document list from view) while remaining fully scrollable for reading.
- **FR-003**: While the PDF preview is in fullscreen, the pane MUST provide a restore control that returns the layout to the normal split (document list visible on the left, PDF preview at its original ~50% width on the right).
- **FR-004**: The PDF preview's fullscreen state MUST reset to normal whenever the selected document changes, or when the user navigates away from the Sources screen and returns.
- **FR-005**: Standard PDF reading controls (at minimum: page-by-page or continuous scrolling through every page of the document) MUST be available in both the normal and fullscreen states of the PDF preview.

**Fixed Size Chunking screen — in-context chunk preview (User Story 2)**

- **FR-006**: The Fixed Size Chunking screen MUST display the existing chunk list on the left side and an in-context chunk preview pane on the right side, for documents that have saved chunks.
- **FR-007**: Selecting a chunk from the chunk list MUST update the in-context preview pane to show that chunk within its original page layout; one chunk MUST be selected by default when the screen loads (the first chunk).
- **FR-008**: The in-context preview MUST show the selected chunk together with exactly one preceding and one following neighboring chunk (when they exist), and MUST NOT require scrolling through the entire document to see them.
- **FR-009**: The in-context preview MUST determine and display every PDF page touched by the selected chunk and its shown neighbors, stacked in page order, rather than only a single fixed page.
- **FR-010**: The in-context preview MUST preserve the original document's structure to the fullest extent already supported — headers, footers, paragraphs, and list items rendered as such — rather than as an unstructured run of text.
- **FR-011**: The in-context preview MUST apply the existing chunk/overlap background-color annotation scheme to the selected chunk, its shown neighbor(s), and any overlapping span between them, consistent with how chunk/overlap colors are already assigned elsewhere in the product.
- **FR-012**: When the selected chunk is the first or last chunk of the document, the in-context preview MUST omit the missing neighbor without showing an error or placeholder.
- **FR-013**: When a document has zero saved chunks, the in-context preview area MUST show the same "no chunks yet" state used elsewhere today rather than an empty or broken pane.
- **FR-014**: When the selected document's underlying PDF file is unavailable, the in-context preview MUST surface the same not-available handling already used for structural preview failures.

### Key Entities

- **PDF Page**: A single page of a source document's underlying PDF, identified by its page number, containing the portion of extracted text and structure that falls within it.
- **Chunk-to-Page Mapping**: The association between a saved chunk and the PDF page(s) whose content the chunk's text falls within; a chunk may map to one or more pages.
- **PDF Preview Layout State**: The Sources screen's PDF preview display mode — normal (~50% width, document list also visible) or fullscreen (100% width, document list hidden).
- **In-Context Chunk Selection**: The currently selected chunk on the Fixed Size Chunking screen, along with its neighboring chunk(s), driving what the in-context preview pane renders.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from the normal Sources layout to a fullscreen, readable view of any document's PDF in a single action, and back again in a single action.
- **SC-002**: 100% of chunks in a chunked document can be inspected in their original page context directly from the chunk list, with no more than one action (selecting the chunk) required.
- **SC-003**: Users can visually distinguish a selected chunk, its neighboring chunk(s), and any overlap between them on the original page layout without opening or scrolling the full document.
- **SC-004**: Switching the selected chunk updates the in-context preview to the correct page(s) and coloring every time, with no stale or mismatched page shown.

## Assumptions

- "The chunked preview button" the user wants removed from Sources refers to the existing "Chunked Preview" toggle and its full-document colored rendering introduced for that screen previously; the underlying page text, structure classification, and chunk/overlap color-assignment logic are being reused (not rebuilt from scratch) for the new in-context preview on Fixed Size Chunking.
- "PDF controls" for reading in the preview pane means standard reading affordances (scrolling through all pages, page-by-page navigation) — no annotation, search, download, or print controls are in scope unless already present.
- The Sources screen's normal (non-fullscreen) PDF preview width remains the same ~50% split introduced previously; this feature does not change that baseline, only adds the fullscreen/restore behavior on top of it.
- "The area where the chunk belongs to" in the in-context preview means the PDF page(s) containing that chunk's text, not a cropped sub-region of a page (e.g., not just the paragraph bounding box) — the whole page(s) render, scoped down to only the pages the selected chunk and its neighbor(s) touch.
- Determining which PDF page(s) a chunk's text falls within is a new capability this feature introduces; today's structural preview only tracks character offsets within the full extracted text, not page boundaries.
