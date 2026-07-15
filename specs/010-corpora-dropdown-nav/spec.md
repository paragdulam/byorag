# Feature Specification: Corpora Dropdown in the Left Navigation

**Feature Branch**: `010-corpora-dropdown-nav`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Let corpora be shown in Dropdown in the left bar. Let each corpora have a make active and a delete button in the list."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Corpora shown as a dropdown (Priority: P1)

Instead of always seeing every corpus listed inline in the left navigation, a user sees a compact
dropdown showing the currently active corpus. Clicking it opens the full list of corpora; clicking
again (or selecting elsewhere) closes it. This keeps the sidebar compact while still making the
full corpus list reachable in one click from any screen.

**Why this priority**: This is the structural change the rest of the feature depends on — the
per-item actions (make active, delete) live inside this dropdown's opened list.

**Independent Test**: Can be fully tested by loading the app, confirming the sidebar shows a
closed dropdown labeled with the active corpus's name (or a prompt if none is active), clicking it
to reveal the full corpora list, and clicking again to close it.

**Acceptance Scenarios**:

1. **Given** an active corpus exists, **When** the sidebar loads, **Then** the dropdown shows that
   corpus's name in its closed/collapsed state, without listing every corpus inline.
2. **Given** the dropdown is closed, **When** the user clicks it, **Then** it opens and shows every
   corpus in the list.
3. **Given** the dropdown is open, **When** the user clicks it again, **Then** it closes.
4. **Given** no corpora exist yet, **When** the sidebar loads, **Then** the closed dropdown shows a
   prompt (e.g. "No corpus selected") instead of a corpus name.
5. **Given** the dropdown is open and showing the corpora list, **When** the user wants to create a
   new corpus, **Then** they do so from the dedicated Corpora screen — the dropdown itself no
   longer offers a create control (amended during implementation; see Assumptions).

---

### User Story 2 - Make any corpus active from the dropdown (Priority: P1)

With the dropdown open, a user picks a corpus and makes it the active one for the rest of the app,
using an explicit "Make Active" action next to each corpus in the list.

**Why this priority**: Switching the active corpus is the dropdown's core purpose; without it the
dropdown is just a read-only list.

**Independent Test**: Can be fully tested by opening the dropdown, clicking "Make Active" on a
different corpus, and confirming it becomes the active one (reflected in the dropdown and in the
rest of the app, e.g. the Sources screen).

**Acceptance Scenarios**:

1. **Given** the dropdown is open and lists multiple corpora, **When** the user clicks "Make
   Active" next to a non-active corpus, **Then** that corpus becomes the active one app-wide.
2. **Given** a corpus is already active, **When** the user views it in the open dropdown, **Then**
   it is clearly marked as active and does not need its own "Make Active" action clicked again.
3. **Given** the user just made a different corpus active, **When** they look at any other
   corpus-scoped section (e.g. Sources), **Then** it reflects the newly active corpus immediately.

---

### User Story 3 - Delete a corpus from the dropdown (Priority: P2)

With the dropdown open, a user removes a corpus they no longer need using a "Delete" action next to
it in the list, without navigating to the dedicated Corpora screen.

**Why this priority**: Deletion is a convenience addition on top of the dropdown's primary
switching purpose (User Stories 1–2), reusing rules that already exist elsewhere in the app.

**Independent Test**: Can be fully tested by opening the dropdown, deleting an empty corpus from
its "Delete" action, and confirming it disappears from the list; and by confirming a non-empty
corpus's deletion is blocked with a clear message.

**Acceptance Scenarios**:

1. **Given** the dropdown is open, **When** the user clicks "Delete" next to an empty corpus and
   confirms the action, **Then** that corpus is removed from the list everywhere in the app.
2. **Given** the dropdown is open, **When** the user clicks "Delete" next to a corpus that still
   has documents, **Then** the deletion is blocked with a clear message explaining why (existing
   rule, unchanged).
3. **Given** the user deletes the currently active corpus (once it is empty), **When** the deletion
   completes, **Then** the app selects another remaining corpus as active, or clearly shows no
   corpus is selected if none remain (existing rule, unchanged).
4. **Given** the user clicks "Delete" next to a corpus, **When** the confirmation step appears,
   **Then** the corpus is only removed after the user confirms, not on the first click.

---

### Edge Cases

- What happens when the user deletes the corpus currently shown in the dropdown's closed/collapsed
  label? The label updates to the newly active corpus (or "No corpus selected") immediately.
- What happens when the last corpus is deleted from the dropdown? The dropdown's closed state shows
  the "no corpus selected" prompt, and corpus-scoped sections (Sources, Chunking) show their own
  empty states, consistent with existing behavior.
- What happens if the user clicks "Delete" and then cancels the confirmation? Nothing changes — the
  corpus remains in the list and stays active if it was active.
- What happens when there are enough corpora that the open dropdown's list would run off the bottom
  of the screen? The list scrolls within the open dropdown rather than pushing other page content
  around (small/personal scale assumption carried over from prior corpora work — no pagination).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The left navigation MUST show a closed/collapsed dropdown labeled with the currently
  active corpus's name (or a "no corpus selected" prompt when none is active), replacing the
  previous always-expanded inline list of corpora.
- **FR-002**: Clicking the closed dropdown MUST open it to reveal the full list of corpora; clicking
  it again (or an equivalent dismissal, e.g. clicking outside it) MUST close it.
- **FR-003**: The open dropdown MUST NOT include a create-corpus control (amended during
  implementation — the dropdown's "+ New Corpus" control is removed; creating a corpus is done from
  the dedicated Corpora screen instead, per `009-corpora-screen`).
- **FR-004**: Each corpus in the open dropdown's list MUST display a "Make Active" action; clicking
  it MUST make that corpus the active one app-wide.
- **FR-005**: The open dropdown MUST clearly indicate which corpus is currently active among the
  listed corpora.
- **FR-006**: Each corpus in the open dropdown's list MUST display a "Delete" action.
- **FR-007**: Clicking "Delete" MUST require the user to confirm before the corpus is actually
  removed.
- **FR-008**: Deleting a corpus that still has associated documents MUST be blocked with a clear
  message, consistent with the existing corpus-deletion rule.
- **FR-009**: Deleting the currently active corpus MUST fall back to another remaining corpus as
  active, or clearly indicate no corpus is selected if none remain, consistent with the existing
  rule.
- **FR-010**: Making a corpus active from the dropdown MUST be reflected immediately in every
  corpus-scoped section of the app (Sources, Chunking today), with no page reload.

### Key Entities

- **Corpus**: Unchanged from prior work — this feature changes how corpora are presented and acted
  upon in the left navigation, not the underlying data or its lifecycle rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The left navigation's corpora dropdown occupies no more vertical space than a single
  row when closed, regardless of how many corpora exist.
- **SC-002**: Users can switch the active corpus from the dropdown in 2 clicks or fewer (open, then
  make active).
- **SC-003**: Users can delete an empty corpus from the dropdown in 3 clicks or fewer (open, delete,
  confirm).
- **SC-004**: 100% of attempts to delete a non-empty corpus from the dropdown are blocked with a
  clear explanation; 100% of attempts to delete an empty corpus succeed once confirmed.
- **SC-005**: Switching the active corpus from the dropdown is reflected in every corpus-scoped
  section within 2 seconds, with no page reload.

## Assumptions

- The dropdown replaces the prior always-expanded inline corpora list in the sidebar; it does not
  remove or change the separate "Corpora" navigation item that leads to the dedicated Corpora
  screen introduced previously — that screen's own create/manage-documents/delete capabilities are
  unaffected by this change.
- **Amended during implementation**: the dropdown does not carry over the previous inline list's
  "+ New Corpus" create control. Corpus creation is no longer available from the left navigation at
  all — only from the dedicated Corpora screen (`009-corpora-screen`). This is a deliberate scope
  reduction from the original draft (which had the dropdown keep the create control), given
  directly by the user during implementation.
- Deletion from the dropdown reuses the exact rules already established elsewhere in the app: block
  while the corpus still has documents, and fall back to another corpus (or "no corpus selected")
  when the active one is deleted. This feature does not change those rules, only adds a second
  place (the dropdown) to trigger deletion from.
- Deletion requires an explicit confirmation step before it takes effect, consistent with how
  document deletion already works elsewhere in the app.
- The dropdown stays open after a "Make Active" click (it does not auto-close), so a user can
  immediately continue managing other corpora (e.g. deleting one) without reopening it. It closes
  only via an explicit close action (clicking the dropdown again or clicking outside it).
- Small/personal scale continues to apply (tens of corpora) — the open dropdown's list may scroll
  but is not paginated.
