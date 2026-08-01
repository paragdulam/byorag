# Feature Specification: PDF Preview Zoom & Pan

**Feature Branch**: `026-pdf-preview-zoom-pan`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "I want to add zoom in/zoom out feature in the PDF preview, pan while zoomed in. This will be used by somebody who will create the golden data set. So the user needs to read this carefully."

## Clarifications

### Session 2026-08-01

- Q: While the curator is zoomed in, how should scrolling/dragging behave relative to moving between pages (the preview currently shows all pages in one continuous scroll)? → A: Pan within the current page first; scrolling/dragging only advances to the next page once the curator reaches the top/bottom edge of the current page's zoomed view.
- Q: The PDF preview's text is normally selectable (e.g., to copy a phrase). Click-and-drag panning would compete with click-and-drag text selection. How should this be resolved? → A: While zoomed in, click-and-drag always pans the page; text selection/copy is not available while zoomed in.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Zoom in to read fine details clearly (Priority: P1)

A dataset curator is reviewing a source PDF in the preview pane to verify its exact content before using it to build the golden dataset. Small text, tables, footnotes, or fine print are hard to read at the default view, so the curator zooms in until the content is clearly legible.

**Why this priority**: This is the core problem statement — the curator must be able to read the document carefully and accurately. Without reliable zoom, the golden dataset risks being built from misread source content.

**Independent Test**: Can be fully tested by opening any source document in the preview, using the zoom-in control, and confirming previously illegible text becomes readable, independent of any pan capability.

**Acceptance Scenarios**:

1. **Given** a PDF is open in the preview at the default zoom level, **When** the curator activates zoom in, **Then** the page content enlarges and remains sharp/readable.
2. **Given** the curator repeatedly zooms in, **When** the maximum zoom level is reached, **Then** further zoom-in attempts have no additional effect and the interface makes clear the maximum has been reached.
3. **Given** the curator is zoomed in, **When** they check the preview, **Then** the current zoom level is visibly indicated (e.g., a percentage).

---

### User Story 2 - Pan around a zoomed page (Priority: P2)

While zoomed in, the curator needs to move around the page to review content that no longer fits in the visible preview area, without losing their current zoom level.

**Why this priority**: Zoom alone is not useful for careful review if the curator cannot reach every part of an enlarged page. Pan makes the zoomed view fully usable.

**Independent Test**: Can be fully tested by zooming a page in beyond the visible preview area, then dragging to reveal previously hidden edges/corners of the page, confirming the zoom level is unchanged throughout.

**Acceptance Scenarios**:

1. **Given** a page is zoomed in beyond the visible preview area, **When** the curator clicks/touches and drags within the preview, **Then** the visible portion of the page shifts in the direction of the drag while the zoom level stays the same.
2. **Given** the curator pans toward the edge of the page content, **When** they continue dragging past the content boundary, **Then** panning stops at the edge and no empty space beyond the page is shown.
3. **Given** the curator has panned to a specific region while zoomed in, **When** they release the drag, **Then** that region remains in view until the curator pans, zooms, or navigates again.

---

### User Story 3 - Return to the default view (Priority: P3)

After inspecting details at a high zoom level, the curator wants to quickly return to the default view to continue reviewing other pages or documents efficiently.

**Why this priority**: Supports an efficient review workflow across many pages/documents, but the curator can still complete their core task (careful reading) even if this is momentarily less convenient.

**Independent Test**: Can be fully tested by zooming in on a page and then using zoom-out or reset controls to confirm the view returns to the default fit level.

**Acceptance Scenarios**:

1. **Given** the page is zoomed in, **When** the curator activates zoom out repeatedly, **Then** the page shrinks back toward the default view and stops at a defined minimum zoom level.
2. **Given** the preview is at any zoom level, **When** the curator activates the reset control, **Then** the view returns to the default fit-to-width zoom level in one action.

---

### Edge Cases

- When the curator scrolls to a different page of the same document while zoomed in, the zoom level carries over to the newly visible page, and scrolling only crosses into that next page once the curator has panned past the bottom edge of the current page (see FR-006a).
- What happens when the curator opens a different source document while zoomed in on the previous one?
- What happens when the curator switches between the normal (split) preview and fullscreen preview while zoomed in?
- What happens if the curator attempts to zoom in past the maximum or out past the minimum (e.g., via a keyboard shortcut or rapid repeated clicks)?
- What happens on a very narrow browser window where zoom controls might overlap with page content?
- What happens when panning on a single-page document that, once zoomed, is wider than the viewport but not taller (or vice versa) — panning should still work along whichever axis has overflow.
- What happens when the curator tries to select/copy text while zoomed in — per FR-012, click-and-drag pans instead of selecting; text selection remains available once the curator returns to the default zoom level.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The PDF preview MUST provide a zoom-in control that increases the magnification of the displayed page content.
- **FR-002**: The PDF preview MUST provide a zoom-out control that decreases the magnification of the displayed page content.
- **FR-003**: The PDF preview MUST display the current zoom level (e.g., as a percentage) at all times while a document is open.
- **FR-004**: The PDF preview MUST provide a reset control that returns the view to the default fit-to-width zoom level in a single action.
- **FR-005**: When zoomed beyond the point where the full page width and/or height fits in the visible preview area, the system MUST let the curator pan (click-and-drag, or touch-drag, or scroll) to reveal other parts of the page.
- **FR-006**: The system MUST constrain panning to the bounds of the page content — the curator cannot drag past the page edges into empty space.
- **FR-006a**: While zoomed in, vertical scroll/drag MUST first pan within the current page's zoomed view; the preview MUST only advance to the next (or previous) page once the curator reaches the bottom (or top) edge of the current page at the current zoom level.
- **FR-007**: The system MUST enforce a minimum zoom level (the default fit-to-width view) and a maximum zoom level, and MUST clearly indicate when either limit is reached.
- **FR-008**: Zoom and pan MUST be available both in the normal (split) preview and in the fullscreen preview mode.
- **FR-009**: The system MUST preserve the curator's current zoom level as they scroll between pages of the same open document.
- **FR-010**: The system MUST reset the zoom level to the default when the curator opens a different source document.
- **FR-011**: Zoom and pan interactions MUST NOT alter, download, or damage the underlying source document/file — they only affect how it is displayed.
- **FR-012**: While zoomed in (above the default/minimum zoom level), click-and-drag MUST pan the page; text selection within the page is not available at that time. At the default zoom level, normal text selection continues to work as it does today.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A curator can magnify any region of a page to at least 2x its default display size within two interactions (e.g., two clicks on zoom in).
- **SC-002**: A curator can bring any part of a zoomed page (including all four corners) into view using pan alone, without needing to zoom out and back in.
- **SC-003**: A curator can return from any zoom level to the default full-page view in a single action.
- **SC-004**: A curator unfamiliar with the feature can successfully zoom in on and pan around a page to inspect fine text, without instructions, on first attempt.
- **SC-005**: Zooming and panning remain smooth and responsive (no perceptible lag) on documents of typical size used for golden dataset review.

## Assumptions

- Zoom is triggered via explicit on-screen controls (zoom in, zoom out, reset); keyboard shortcuts or scroll-wheel/pinch zoom are not required for this feature but may be added later without changing this scope.
- Pan is performed by clicking/touching and dragging directly on the page; no separate "pan mode" toggle is required — dragging simply pans whenever the page is zoomed beyond the visible area.
- The default zoom level matches the preview's current fit-to-width behavior, and this also serves as the minimum zoom level (the curator cannot zoom out smaller than the default view).
- The maximum zoom level is set high enough to read fine print/small text/table values (e.g., up to roughly 400% of default), which is a reasonable ceiling for careful document review.
- Zoom level is scoped per open document: it persists while the curator scrolls through that document's pages, but resets to default whenever a different source document is opened.
- This feature is a reading/inspection aid only. It does not include selecting, highlighting, annotating, or extracting specific text/regions for the golden dataset — that would be a separate, future capability outside this feature's scope.
- Zoom and pan behave the same way in both the normal split-view preview and the fullscreen preview mode already available in the product.
