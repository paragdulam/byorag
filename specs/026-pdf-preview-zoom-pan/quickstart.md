# Quickstart: PDF Preview Zoom & Pan

Validation scenarios proving each user story works end-to-end. Run against a local dev stack.

## Prerequisites

- Stack running (`docker-compose up` or local backend + `npm run dev`, per repo README).
- A corpus with at least one uploaded, multi-page PDF document with some small/fine-print text
  (e.g. a footnote or table) that's hard to read at the default zoom.

## US1 — Zoom in to read fine details clearly

1. Open Sources, select the prepared document.
   **Expect**: PDF preview shows at the default (100%) zoom level; a zoom toolbar is visible
   showing "100%" (FR-003).
2. Click zoom in (+) a few times.
   **Expect**: the page enlarges each click; the percentage indicator updates each time (FR-001,
   FR-003); small text that was illegible at 100% becomes readable.
3. Keep clicking zoom in until it stops increasing.
   **Expect**: the view stops at the maximum (400%); further clicks have no effect and the control
   visibly indicates the limit is reached (FR-007).

## US2 — Pan around a zoomed page

1. With the page zoomed in beyond the visible preview area, click-and-drag inside the preview.
   **Expect**: the visible portion of the page shifts with the drag; the zoom percentage does not
   change (FR-005).
2. Drag toward a corner of the page and keep dragging past it.
   **Expect**: panning stops at the page edge — no blank space beyond the page content is ever
   shown (FR-006).
3. While zoomed in, scroll (wheel/trackpad) down through the current page.
   **Expect**: scrolling moves within the current page first; only after reaching the bottom edge
   of the current page's zoomed view does the next page come into view (FR-006a, Clarification 1).
4. While zoomed in, click-and-drag directly over a line of text as if trying to select it.
   **Expect**: the drag pans the page instead of starting a text selection (FR-012, Clarification
   2).

## US3 — Return to the default view

1. While zoomed in, click zoom out (−) repeatedly.
   **Expect**: the page shrinks back toward the default view and stops at 100% — it does not go
   below the default (FR-007).
2. Zoom in again, then click the reset control.
   **Expect**: the view returns to exactly the default 100% view in one click (FR-004).
3. At the default (100%) zoom level, click-and-drag over a line of text.
   **Expect**: normal text selection works exactly as it does today (FR-012).

## Cross-cutting checks

- Zoom in on one page, then scroll to a different page of the same document.
  **Expect**: the zoom level carries over — the new page is shown at the same zoom (FR-009).
- Zoom in, then select a different document from the list.
  **Expect**: the newly selected document opens at the default 100% zoom, not the previous
  document's zoom level (FR-010).
- Zoom in, then toggle Fullscreen / Restore.
  **Expect**: zoom and pan controls are present and work the same way in both layouts; the zoom
  level itself is unaffected by the fullscreen toggle (FR-008, research.md §7).
- Confirm no network request is made when zooming/panning (Network tab) and the document itself is
  never re-downloaded or modified (FR-011).
