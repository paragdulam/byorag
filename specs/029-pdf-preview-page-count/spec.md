# Feature Specification: PDF Preview Page Indicator

**Feature Branch**: `029-pdf-preview-page-count`

**Created**: 2026-08-04

**Status**: Draft

**Input**: User description: "Show the current page number / total pages in the PDF preview wherever its used in the app"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See position while scrolling a document (Priority: P1)

A user previewing a source PDF (on the Data Sources screen or the Golden Dataset screen's split view) scrolls through a multi-page document and wants to know which page they're currently looking at and how many pages the document has in total, without having to count pages manually.

**Why this priority**: This is the entire feature — a simple, always-visible orientation cue for anyone reading a document longer than one screen's worth of content. Without it, users lose their place in long PDFs and can't tell how much is left.

**Independent Test**: Open the preview for a multi-page document, scroll through it, and confirm the displayed page number updates to match whichever page is currently in view, while the total stays fixed.

**Acceptance Scenarios**:

1. **Given** a multi-page PDF is loaded in the preview and scrolled to the top, **When** the preview finishes loading, **Then** the indicator shows "Page 1 of N" where N is the document's total page count.
2. **Given** a multi-page PDF is loaded in the preview, **When** the user scrolls down so that a later page becomes the one predominantly visible in the viewport, **Then** the indicator updates to show that page's number as the current page.
3. **Given** the user scrolls back up toward the start of the document, **When** an earlier page becomes predominantly visible again, **Then** the indicator updates to reflect that earlier page number.

---

### User Story 2 - Page indicator stays correct while zooming (Priority: P2)

A user zooms in or out on the PDF preview (existing zoom controls) and expects the page indicator to keep reflecting reality rather than freezing or showing a stale value once page layout shifts.

**Why this priority**: Zoom is a core existing interaction on this preview; the indicator must remain trustworthy through it, but this is a refinement of the P1 behavior rather than new functionality on its own.

**Independent Test**: Load a multi-page document, zoom in until scrolling is required to see a page fully, scroll to a specific page, then zoom out, and confirm the indicator continues to reflect the page actually in view at each step.

**Acceptance Scenarios**:

1. **Given** the preview is showing "Page 2 of N", **When** the user zooms in or out, **Then** the indicator continues to show "Page 2 of N" immediately after the zoom change (no stale jump to another page caused purely by the zoom action).
2. **Given** the user is zoomed in and scrolls within a single enlarged page, **When** that page still occupies the majority of the viewport, **Then** the indicator continues to show that page's number rather than flickering to a neighboring page.

---

### User Story 3 - Indicator reflects loading and unavailable states correctly (Priority: P3)

A user opens the preview for a document that is still loading, has no pages, or fails to load, and the page indicator should never show a misleading or broken value in those states.

**Why this priority**: Edge-state correctness matters for trust in the UI but affects a much smaller slice of interactions than the core scrolling behavior.

**Independent Test**: Trigger the preview's loading state, an unavailable/failed-load state, and a normal loaded state in sequence, confirming the indicator's content (or absence) matches each state appropriately.

**Acceptance Scenarios**:

1. **Given** a document is selected but its preview has not finished loading, **When** the preview is in the loading state, **Then** no page indicator (or a non-numeric placeholder) is shown instead of a "Page 0 of 0" or similarly incorrect value.
2. **Given** a document's preview fails to load, **When** the "Preview unavailable" message is shown, **Then** the page indicator is not shown alongside it.
3. **Given** no document is selected, **When** the preview shows its empty-state prompt, **Then** no page indicator is shown.

---

### Edge Cases

- What happens for a single-page document? Indicator should show "Page 1 of 1" and never change while scrolling.
- What happens if the user resizes the browser window or preview pane such that the currently "in view" page changes without any scroll action? Indicator should still reflect whichever page is predominantly visible after the resize.
- What happens when switching from one selected document to another? Indicator must reset to that new document's "Page 1 of N" (or its own loading/unavailable state) rather than briefly showing the previous document's values.
- What happens during fullscreen toggle (existing fullscreen mode for this preview)? The indicator must continue to reflect the current page in both normal and fullscreen layouts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The PDF preview MUST display a page indicator showing the current page number and the total number of pages (e.g., "Page 3 of 12") whenever a document is successfully loaded and has at least one page.
- **FR-002**: The page indicator MUST be shown in every place in the app where the continuous-scroll PDF preview component is used, including the Data Sources screen and the Golden Dataset screen's document preview pane, and in both the preview's normal and fullscreen layout states.
- **FR-003**: The "current page" value MUST reflect the page that is predominantly visible within the scrollable preview viewport at any given moment, updating automatically as the user scrolls.
- **FR-004**: The "total pages" value MUST reflect the full page count of the currently loaded document, matching the count already used to render all of its pages.
- **FR-005**: The page indicator MUST update to remain accurate when the user changes zoom level, without misreporting the current page due to the zoom action itself.
- **FR-006**: The page indicator MUST NOT display while the preview is in its loading state (before the document's page count is known) or its unavailable/failed-to-load state.
- **FR-007**: The page indicator MUST NOT display when no document is selected (the preview's empty state).
- **FR-008**: When the selected document changes, the page indicator MUST reset to reflect the newly selected document (starting at page 1 of its own total) rather than retaining the previous document's values.
- **FR-009**: The page indicator is informational only for this feature — it does not need to support jumping to a page by typing a number or clicking it (out of scope; see Assumptions).

### Key Entities

- **PDF Preview Pane**: The existing continuous-scroll document viewer component used across the app to render a selected source document's pages; gains a page-position indicator as part of this feature.
- **Page Position**: The current page number the indicator reports, derived from which rendered page is predominantly visible in the preview's scrollable viewport, paired with the document's total page count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can determine their current position and the total length of any open PDF document within one glance, without scrolling to the end to count pages.
- **SC-002**: The displayed current page number matches the page a user would identify as "what I'm looking at" in at least 95% of scroll positions during manual verification across documents of varying page counts.
- **SC-003**: The page indicator is present and correct in 100% of the app's existing PDF preview locations (Data Sources screen, Golden Dataset screen), with no location left showing a stale or missing indicator.
- **SC-004**: Switching between documents or toggling fullscreen never leaves the indicator showing a value from a previously selected document for longer than the time it takes the new document to begin loading.

## Assumptions

- "Wherever it's used in the app" refers to the shared continuous-scroll PDF preview component (currently used on the Data Sources screen and the Golden Dataset screen's split view), not the separate chunk-in-context preview on the Fixed Size Chunking screen, which already labels each rendered page section with its page number in a different, non-paginated presentation and is out of scope here.
- The indicator is read-only for this feature: it reports position but does not add page-jump navigation (e.g., a text input or next/previous buttons). That would be a natural follow-up but was not requested.
- "Current page" is determined by viewport visibility (the page occupying the most visible area of the scroll container), consistent with how continuous-scroll PDF viewers conventionally define "current page" — no explicit paging/carousel interaction model is introduced.
- The indicator is placed within the preview's existing toolbar area (alongside the zoom controls) rather than overlaid on the page content itself, matching the existing UI pattern of that toolbar.
