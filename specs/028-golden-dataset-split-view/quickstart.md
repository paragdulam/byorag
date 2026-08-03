# Quickstart: Golden Dataset Split-Screen PDF Reference View

Validation scenarios proving each user story works end-to-end. Run against a local dev stack.

## Prerequisites

- Stack running (`docker-compose up` or local backend + `npm run dev`, per repo README).
- A corpus with at least one uploaded, previewable PDF document.

## US1 — Read the source PDF while authoring a golden entry

1. Open Golden Dataset for the prepared corpus.
   **Expect**: the screen is split into a left half (scope dropdown, controls, entries) and a
   right half (PDF preview) (FR-001).
2. With a specific document selected in the scope dropdown.
   **Expect**: the right half shows that document's PDF, scrollable through all pages (FR-002).
3. Switch the scope dropdown to "Entire Corpus".
   **Expect**: the right half shows a neutral empty state — no document is guessed (FR-003,
   Clarifications 2026-08-03).
4. Switch back to a specific document.
   **Expect**: the right half updates to that document at default zoom (FR-004).
5. Use the preview's zoom in/out/reset and fullscreen controls.
   **Expect**: identical behavior to the Sources screen today (FR-002).

## US2 — Zoomed PDF stays pannable without resizing its container

1. On the Sources screen, open a document preview and note the right pane's rendered width
   (e.g., via browser dev tools).
2. Zoom in repeatedly to maximum zoom.
   **Expect**: the pane's outer width is unchanged; the enlarged page is scrollable/pannable by
   dragging inside it (FR-005, FR-007, SC-002).
3. Repeat steps 1–2 on the Golden Dataset screen's right half.
   **Expect**: identical behavior; the left half's width and contents are unaffected while zooming
   (FR-006, US2 acceptance scenario 2).

## US3 — Entry-authoring controls and their output stay confined to the left half

1. Open Golden Dataset with a corpus selected.
   **Expect**: the scope dropdown is at the top of the left half, and directly below it is one
   horizontal row containing Write Manually, Generate with LLM, the batch-count input, and
   Generate a Batch…, in that order (FR-008, FR-009).
2. Click **Write Manually**.
   **Expect**: the entry editor renders within the left half only, not overlapping or spanning the
   right half (FR-010).
3. Click **Generate with LLM**, then start a batch.
   **Expect**: the generated entry, any error message, and the batch progress indicator all render
   within the left half only (FR-010).
4. Scroll the entry list below the controls.
   **Expect**: it scrolls independently within the left half; the right-half preview is unaffected
   (FR-010).

## Cross-cutting checks

- With a batch generation in progress, switch the scope dropdown to a different document.
  **Expect**: the batch continues to completion in the left half; the right-half preview switches
  to the newly selected document immediately.
- Toggle the right-half preview to fullscreen while the left half has unsaved editor text or an
  in-progress batch.
  **Expect**: the preview expands over the left half; toggling off restores the split view with the
  left half's state (unsaved text, batch progress) intact (FR-012).
- Select a document whose PDF file is missing/corrupted in the scope dropdown.
  **Expect**: the right half shows the same "preview unavailable" state the Sources screen already
  shows, without blocking the left half's controls.
- Compare the same zoom-to-max steps on both screens side by side.
  **Expect**: both exhibit identical fixed-width, pannable behavior (SC-005 — no regression to
  existing Sources-screen preview functionality beyond the width fix itself).
