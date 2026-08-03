# Feature Specification: Golden Dataset Split-Screen PDF Reference View

**Feature Branch**: `028-golden-dataset-split-view`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "I need some UI updates on Golden dataset screen. As a manual question/answer pair creator I want to read the PDF their itelf that gives me ideas about what questions should be asked that should qualify as Golden data set question. Lets split this screen in 2 halves, Left and right. Right side will have exact same PDF viewer as there is in Sources screen with all the current funtionalities intact. ZOom/ full screen etc. I found an issue in it. Zooming too much changes the width of the content div which should not happen, the pdf should be pannable but the content width should not change. This shouold be fixed in both sources and golden data set. Thats about Right hand side. The left hand side, the dropdown stays as is,below that, lets gave the other buttons Write Manually, Generate with LLM count input and Generate a batch horizontally arranged as a div should be placed below the Dropdown. The output of these buttons and controls should be the content on the Left half"

## Clarifications

### Session 2026-08-03

- Q: When the scope dropdown is set to "Entire Corpus" (no single document selected), what should
  the right-half preview show? → A: A neutral empty state — no document is auto-selected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the source PDF while authoring a golden entry (Priority: P1)

A subject-matter expert building golden-dataset entries wants to read the actual source document
side-by-side with the entry-authoring controls, so they can decide what's worth asking about
without switching screens or losing their place.

**Why this priority**: This is the core value of the feature — the reason for the split-screen
layout at all. Without it, the rest of the layout change has no purpose.

**Independent Test**: Open Golden Dataset for a corpus with an uploaded, previewable document,
select that document in the scope dropdown, and confirm the right half renders the document's PDF
readable and scrollable, while the left half still shows the entry-authoring controls.

**Acceptance Scenarios**:

1. **Given** a corpus with at least one previewable document is open in Golden Dataset, **When**
   the screen loads, **Then** the screen is divided into a left half and a right half, with the
   right half showing a PDF preview.
2. **Given** the scope dropdown is set to a specific document, **When** the user looks at the right
   half, **Then** it shows that document's PDF.
3. **Given** the scope dropdown is set to "Entire Corpus" (no single document selected), **When**
   the user looks at the right half, **Then** it shows a neutral empty state (no arbitrary document
   is auto-selected) rather than an error.
4. **Given** the PDF preview is visible, **When** the user uses its zoom-in, zoom-out, reset, and
   fullscreen controls, **Then** they behave exactly as they do today on the Sources screen (same
   zoom range, same pan-when-zoomed behavior, same fullscreen toggle).

---

### User Story 2 - Zoomed PDF stays pannable without resizing its container (Priority: P1)

A user zooming into dense text or a diagram must be able to pan around the enlarged page without
the surrounding layout shifting — today, zooming in far enough visibly widens the content area
itself (pushing against or past its neighboring panel), instead of staying a fixed-size viewport
the user pans within.

**Why this priority**: This is a pre-existing correctness bug called out explicitly by the user as
a blocker; shipping the new split-screen layout without fixing it would make the bug more visible
and disruptive (the right half's fixed width is now load-bearing for the left half to stay usable).
It also affects the already-shipped Sources screen today.

**Independent Test**: On either the Sources screen or the Golden Dataset screen, open a document
preview, zoom in repeatedly to maximum zoom, and confirm the preview panel's own width (and the
width of any sibling panel) never changes — only the scrollable content inside grows, and dragging
pans it within the unchanged viewport.

**Acceptance Scenarios**:

1. **Given** a document preview at default zoom, **When** the user zooms in to the maximum zoom
   level, **Then** the preview panel's outer width stays exactly the same as before zooming.
2. **Given** the Golden Dataset screen's split layout, **When** the user zooms the right-half
   preview to maximum, **Then** the left half's width and contents are unaffected.
3. **Given** a zoomed-in preview, **When** the user clicks and drags inside it, **Then** the
   enlarged page pans within the unchanged viewport (scrolls), rather than the viewport resizing
   to fit the enlarged page.
4. **Given** the same zoom-in steps performed on the Sources screen, **When** compared to the
   Golden Dataset screen, **Then** both exhibit the identical (fixed-width, pannable) behavior.

---

### User Story 3 - Entry-authoring controls and their output stay confined to the left half (Priority: P2)

A user creating entries manually or via LLM generation needs the scope dropdown, the action
controls (Write Manually / Generate with LLM / batch count / Generate a Batch), and everything
those controls produce (the editor, the pending-review queue, batch progress, the entry list) to
stay within the left half, so the right half remains a stable, uninterrupted PDF-reading pane.

**Why this priority**: Necessary for the split layout to be usable, but depends on User Story 1
already existing (the split itself) — it's a refinement of layout and control arrangement within
the half that US1 establishes, not new capability.

**Independent Test**: With the split-screen layout in place, trigger each control (Write Manually,
Generate with LLM, batch generation) one at a time and confirm every resulting piece of content
(editor, pending queue, progress indicator, entry list) renders only within the left half's width,
never spanning or overlapping the right half.

**Acceptance Scenarios**:

1. **Given** the Golden Dataset screen is open with a corpus selected, **When** the user views the
   left half, **Then** the scope dropdown appears at the top, unchanged from its current position
   and behavior.
2. **Given** the scope dropdown, **When** the user looks directly below it, **Then** a single
   horizontal row contains, in order: the "Write Manually" button, the "Generate with LLM" button,
   the batch-count input, and the "Generate a Batch…" button.
3. **Given** the user clicks "Write Manually", **When** the manual entry editor opens, **Then** it
   renders within the left half only.
4. **Given** the user clicks "Generate with LLM" or starts a batch, **When** the resulting
   entries/progress/errors appear, **Then** they render within the left half only.
5. **Given** existing golden dataset entries, **When** the user views the entry list below the
   controls, **Then** it renders within the left half only and remains independently scrollable if
   it overflows.

### Edge Cases

- No corpus is selected: the screen shows its existing "Select or create a corpus first" state;
  the split layout (and the right-half preview) does not apply since there is nothing to preview or
  author entries against.
- A document exists in the scope dropdown but its PDF file is missing, corrupted, or fails to load:
  the right half shows the same "preview unavailable" state the Sources screen already shows in
  that case, rather than blocking the left half's controls.
- The user narrows the browser window: both halves shrink proportionally rather than one
  overflowing or disappearing; if the viewport is too narrow for both halves to be usable, standard
  responsive scrolling behavior applies (consistent with the rest of the app, which does not define
  a dedicated mobile layout).
- The user switches the scope dropdown while a batch generation is in progress: the in-progress
  batch continues to completion and its progress stays visible in the left half; the right-half
  preview updates to the newly selected document immediately (previewing is read-only and has no
  bearing on an in-flight generation).
- Fullscreen is toggled on the right-half preview while the Golden Dataset screen's left-half
  content (editor, queue, batch progress) is mid-interaction: fullscreen expands the preview over
  the left half the same way it already does on the Sources screen, and returns to the split view
  on toggling off, without discarding any left-half state (unsaved editor text, in-progress batch).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Golden Dataset screen MUST present its content in two side-by-side halves: a left
  half and a right half.
- **FR-002**: The right half MUST render a PDF preview of the document currently selected in the
  scope dropdown, offering the same functionality already available on the Sources screen's
  document preview: continuous scroll through all pages, zoom in, zoom out, reset zoom, and
  fullscreen toggle.
- **FR-003**: When the scope dropdown is set to "Entire Corpus" (no single document selected), the
  right half MUST show an empty/neutral state rather than guessing or defaulting to any one
  document.
- **FR-004**: When the scope dropdown selection changes to a specific document, the right-half
  preview MUST update to show that document, resetting zoom to the default level (matching today's
  Sources-screen behavior when switching documents).
- **FR-005**: Zooming a document preview to any supported zoom level, on either the Sources screen
  or the Golden Dataset screen, MUST NOT change the outer width of the preview panel or any sibling
  panel (e.g., the Golden Dataset screen's left half). Only the content scrollable inside the
  preview may grow; the panel itself stays a fixed-size, pannable viewport.
- **FR-006**: This fixed-width-while-zoomed behavior MUST be corrected in both the Sources screen
  and the Golden Dataset screen, since both use the same underlying preview behavior.
- **FR-007**: Dragging inside a zoomed-in preview MUST continue to pan the enlarged content within
  the (now non-resizing) viewport, exactly as it already does today.
- **FR-008**: The left half MUST show the scope dropdown in its current position (top of the
  content area), unchanged in appearance and behavior.
- **FR-009**: Directly below the scope dropdown, the left half MUST show a single horizontal row
  containing, in this order: the "Write Manually" button, the "Generate with LLM" button, the
  batch-count input, and the "Generate a Batch…" button.
- **FR-010**: All content produced by the left half's controls — the manual entry editor, the
  LLM-generation error message, the batch-generation progress indicator, the pending-review queue,
  and the full entry list — MUST render within the left half's width only.
- **FR-011**: The right-half preview MUST remain visible and usable while the user interacts with
  left-half controls (opening the editor, generating entries, reviewing a batch), except when the
  user explicitly toggles the preview to fullscreen.
- **FR-012**: Toggling the right-half preview to fullscreen MUST behave the same way fullscreen
  already behaves on the Sources screen (expands over the other half; left-half state such as
  unsaved editor input or an in-progress batch is preserved, not discarded, while fullscreen is
  active).

### Key Entities

- No new data entities. This feature is purely a layout and UI-behavior change over existing
  Golden Dataset entries and existing source documents; no schema, request, or response shape
  changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can view a source document's PDF and the golden-entry authoring controls at
  the same time, without navigating away from the Golden Dataset screen, in 100% of cases where a
  document is selected and previewable.
- **SC-002**: Zooming a document preview to its maximum level, on either screen, never changes the
  measured outer width of the preview panel — verified to be pixel-identical before and after
  zooming, across all supported zoom steps.
- **SC-003**: All output produced by the left half's controls (editor, generated entries, batch
  progress, entry list) stays within the left half's boundary at every viewport width the app
  otherwise supports — zero instances of left-half content overlapping or extending into the right
  half.
- **SC-004**: Existing Golden Dataset functionality (creating manual entries, generating single and
  batch LLM entries, reviewing/approving/rejecting, filtering, deleting) continues to work
  identically to before this change, with no regressions in any existing scenario.
- **SC-005**: Existing Sources-screen preview functionality (scroll, zoom, fullscreen) continues to
  work identically to before this change aside from the fixed-width zoom fix itself.

## Assumptions

- "Exact same PDF viewer as there is in Sources screen with all the current functionalities
  intact" means the Golden Dataset screen's right half reuses the same preview behavior and
  feature set (continuous scroll, zoom in/out/reset, pan-when-zoomed, fullscreen toggle) that the
  Sources screen offers today — not that the two screens must literally share one on-screen
  instance, since they preview independently-selected documents in independent layouts.
- The right half previews only the document currently chosen in the existing scope dropdown; when
  scope is "Entire Corpus," there is no single document to preview, so an empty state is shown
  (per Edge Cases / FR-003) rather than picking one arbitrarily — confirmed via Clarifications
  (2026-08-03), not merely assumed.
- "Should not change the width of the content div" is interpreted as: the fixed-size *viewport*
  users pan within must not resize as zoom increases — this is a correctness fix to existing
  zoom/pan behavior (originally introduced by the prior `026-pdf-preview-zoom-pan` feature), applied
  everywhere that behavior is used, not a new zoom feature.
- No new backend endpoints, data, or persisted state are needed — this is a frontend layout and
  bug-fix change over existing screens, entries, and documents.
- Left/right halves default to an even (50/50) split, matching the Sources screen's existing
  left/right split convention, since the user described "2 halves" without specifying otherwise.
- Mobile/narrow-viewport layout is out of scope, consistent with the rest of this application,
  which does not define a dedicated mobile layout elsewhere.
