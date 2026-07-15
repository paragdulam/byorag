# Feature Specification: Move Corpus Row Actions to the Corpora Screen

**Feature Branch**: `011-move-corpus-row-actions`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "There is a mistake. The Corpora list on the right side in the main screen that shows up when you click Corpora in the left bar. Thats where I need the Make Active and Delete button. Remove the buttons from dropdown list"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage corpora directly from the Corpora screen's list (Priority: P1)

On the dedicated Corpora screen (reached via the "Corpora" item in the left navigation), the user
makes any corpus active and deletes any corpus directly from its row in the "All Corpora" list,
using explicit "Make Active" and "Delete" actions next to each corpus — the same per-row actions
that `010-corpora-dropdown-nav` mistakenly placed in the sidebar dropdown instead of here.

**Why this priority**: This is the corrected, intended location for these actions. Fixing the
placement is the primary purpose of this change.

**Independent Test**: Can be fully tested by navigating to the Corpora screen, clicking "Make
Active" next to a non-active corpus and confirming it becomes active, then clicking "Delete" next
to an empty corpus and confirming it is removed after confirmation.

**Acceptance Scenarios**:

1. **Given** the Corpora screen lists multiple corpora, **When** the user clicks "Make Active"
   next to a non-active corpus, **Then** that corpus becomes the active one app-wide and its row
   shows the active indicator instead of the "Make Active" action.
2. **Given** the Corpora screen lists an empty corpus, **When** the user clicks "Delete" next to
   it and confirms the action, **Then** that corpus is removed from the list everywhere in the app.
3. **Given** the Corpora screen lists a corpus that still has documents, **When** the user clicks
   "Delete" next to it, **Then** the deletion is blocked with a clear message explaining why
   (existing rule, unchanged).
4. **Given** the user deletes the currently active corpus (once it is empty), **When** the
   deletion completes, **Then** the app selects another remaining corpus as active, or clearly
   shows no corpus is selected if none remain (existing rule, unchanged).
5. **Given** the user clicks "Delete" next to a corpus, **When** the confirmation step appears,
   **Then** the corpus is only removed after the user confirms, not on the first click.

---

### User Story 2 - Sidebar dropdown no longer carries action buttons (Priority: P2)

The sidebar's corpora dropdown (introduced in `010-corpora-dropdown-nav`) returns to a simple,
compact list: clicking a corpus's name still switches to it, but the explicit "Make Active" and
"Delete" buttons are removed, since those actions now live on the Corpora screen.

**Why this priority**: This is the cleanup half of the correction, secondary to US1. The dropdown
remains useful for quick switching even without the buttons.

**Independent Test**: Can be fully tested by opening the sidebar dropdown, confirming no "Make
Active" or "Delete" button appears next to any corpus, and confirming that clicking a corpus's
name still switches the active corpus app-wide.

**Acceptance Scenarios**:

1. **Given** the sidebar dropdown is open, **When** the user views the list, **Then** no "Make
   Active" or "Delete" button appears next to any corpus.
2. **Given** the sidebar dropdown is open, **When** the user clicks a non-active corpus's name,
   **Then** it becomes the active corpus app-wide and the dropdown's collapsed label updates to
   reflect it.

---

### Edge Cases

- What happens if the user deletes the corpus currently shown in the sidebar dropdown's collapsed
  label (from the Corpora screen)? The dropdown's label updates to the newly active corpus, or "No
  corpus selected," immediately (existing rule, unchanged).
- What happens to the Corpora screen's previous single "Delete this corpus" control (in the
  documents panel below the list, scoped only to the active corpus)? It is removed, since deletion
  is now a per-row action in the list above (FR-007) — keeping both would give two different ways
  to delete the same corpus.
- What happens when the Corpora screen's list has many corpora with per-row actions? The list
  remains readable and scannable, consistent with the screen's existing layout for long lists (no
  pagination, per prior small/personal-scale assumption).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Corpora screen's corpus list MUST display a "Make Active" action next to each
  non-active corpus row; clicking it MUST make that corpus the active one app-wide.
- **FR-002**: The Corpora screen's corpus list MUST continue to clearly indicate which corpus is
  currently active (existing indicator, unchanged).
- **FR-003**: The Corpora screen's corpus list MUST display a "Delete" action next to every corpus
  row.
- **FR-004**: Clicking "Delete" on the Corpora screen's list MUST require the user to confirm
  before the corpus is actually removed.
- **FR-005**: Deleting a corpus that still has associated documents from the Corpora screen's list
  MUST be blocked with a clear message, consistent with the existing corpus-deletion rule.
- **FR-006**: Deleting the currently active corpus from the Corpora screen's list MUST fall back to
  another remaining corpus as active, or clearly indicate no corpus is selected if none remain,
  consistent with the existing rule.
- **FR-007**: The Corpora screen's standalone "Delete this corpus" control (scoped only to the
  currently active corpus, in the documents panel) MUST be removed now that each row in the list
  has its own "Delete" action.
- **FR-008**: The sidebar dropdown's open corpora list MUST NOT display "Make Active" or "Delete"
  buttons next to any corpus.
- **FR-009**: Clicking a corpus's name in the sidebar dropdown's open list MUST still make that
  corpus the active one app-wide, so the dropdown remains useful for quick switching even without
  its explicit buttons (see Assumptions).
- **FR-010**: The sidebar dropdown MUST otherwise continue to behave as established in
  `010-corpora-dropdown-nav`: closed by default, labeled with the active corpus's name (or "No
  corpus selected"), and opened/closed via its toggle, an outside click, or the Escape key.

### Key Entities

- **Corpus**: Unchanged from prior work — this feature only changes where the make-active and
  delete actions are presented, not the underlying data or its lifecycle rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can make a different corpus active from the Corpora screen's list in 1 click.
- **SC-002**: Users can delete an empty corpus from the Corpora screen's list in 2 clicks or fewer
  (delete, confirm).
- **SC-003**: 100% of attempts to delete a non-empty corpus from the Corpora screen's list are
  blocked with a clear explanation; 100% of attempts to delete an empty corpus succeed once
  confirmed.
- **SC-004**: The sidebar dropdown's open panel contains zero "Make Active" or "Delete" buttons.
- **SC-005**: Users can still switch the active corpus by clicking its name in the sidebar
  dropdown, reflected app-wide within 2 seconds with no page reload.

## Assumptions

- This is a corrective follow-up to `010-corpora-dropdown-nav` (which placed the per-row "Make
  Active"/"Delete" buttons in the sidebar dropdown instead of the dedicated Corpora screen) and
  `009-corpora-screen` (which established the Corpora screen's list and its single,
  active-corpus-scoped "Delete this corpus" control).
- The sidebar dropdown keeps click-to-select on each corpus row (clicking a name switches to it)
  even after its explicit buttons are removed, so the dropdown remains useful for quick switching
  from anywhere in the app — only the labeled "Make Active"/"Delete" buttons are being relocated,
  not the sidebar's general ability to switch the active corpus. If this assumption is wrong and
  the dropdown should become fully read-only instead, that is a follow-up scope change.
- The Corpora screen's existing single "Delete this corpus" control (scoped only to the currently
  active corpus, in the documents panel) is removed once each row has its own "Delete" action, to
  avoid two different ways to delete the same corpus.
- Deletion still requires confirmation and reuses the existing block-while-non-empty and
  fallback-on-delete-active rules, unchanged from prior work.
- Small/personal scale continues to apply (tens of corpora) — no pagination.
