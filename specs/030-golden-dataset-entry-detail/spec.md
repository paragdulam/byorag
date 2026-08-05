# Feature Specification: Golden Dataset Entry List Scoping & Read-Only Answer View

**Feature Branch**: `030-golden-dataset-entry-detail`

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Golden Data set should show questions and answers on approved question answers. When i click on the question, it should do that. It should not be editable. It can be deleted which is already implemeneted. Additionally, the question shown is same for whatever selection in the dropdown. It should show all questions asked when Entire corpus is selected on dropdown and it should show questions for that particular document when a document is selected."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entry list matches the selected scope (Priority: P1)

A user working on the Golden Dataset screen picks a specific document from the scope dropdown, expecting to see only the reference questions relevant to that document. Today the list shown never changes no matter what they pick in the dropdown — it always shows the same entries. They need the list to actually reflect their selection: every entry in the corpus when "Entire Corpus" is chosen, and only that document's entries when a specific document is chosen.

**Why this priority**: This is a correctness bug that undermines trust in the whole screen — if the list never changes with the dropdown, a user has no reliable way to review or curate entries for one document at a time, and every other capability on this screen (viewing, deleting) is being exercised against the wrong data. Nothing else on this screen is trustworthy until this is fixed.

**Independent Test**: Can be fully tested by creating entries scoped to different documents within the same corpus, then switching the dropdown between "Entire Corpus" and each individual document, and confirming the visible list changes to match each selection — independent of the read-only answer view in User Story 2.

**Acceptance Scenarios**:

1. **Given** a corpus with entries belonging to more than one of its documents, **When** the user selects "Entire Corpus" in the scope dropdown, **Then** every entry belonging to the corpus (across all its documents) is shown in the list.
2. **Given** the same corpus, **When** the user selects one specific document in the scope dropdown, **Then** only the entries whose evidence/question belongs to that document are shown in the list.
3. **Given** the list is currently showing one document's entries, **When** the user switches the dropdown to a different document, **Then** the list updates immediately, without a page reload, to show only that other document's entries.
4. **Given** a document with zero entries of its own, **When** the user selects that document in the dropdown, **Then** the list shows the existing "no entries yet" state rather than entries belonging to a different document or the whole corpus.

---

### User Story 2 - View an approved entry's answer without editing it (Priority: P2)

A user reviewing the Golden Dataset wants to check the actual answer text of an entry that has already been approved. Right now the list only shows the question — the answer is never visible, and there is no way to see it without editing tooling. They want to click the question and see its full answer, read-only, with no risk of accidentally changing an already-approved reference entry.

**Why this priority**: Valuable and directly requested, but it builds on a list that (per User Story 1) must already be showing the right entries — reading an answer is only useful once the list itself is trustworthy. It's also independently useful and testable on its own once US1 is in place.

**Independent Test**: Can be fully tested by approving an entry, clicking its question in the list, and confirming its full preferred answer becomes visible with no editable fields or save controls present — independent of whether the list is scoped to a document or the entire corpus.

**Acceptance Scenarios**:

1. **Given** an approved entry is shown in the list, **When** the user clicks its question, **Then** the entry's full preferred answer becomes visible alongside the question.
2. **Given** the answer is now visible, **When** the user looks for a way to change the question or answer text, **Then** no editable field or save control is present anywhere in that view.
3. **Given** the answer view is open for one approved entry, **When** the user clicks the question of a different approved entry, **Then** that entry's own answer is shown (not a mix of the two, and not the previous entry's answer left over).
4. **Given** the read-only answer view is open for an entry, **When** the user deletes that entry using the existing Delete control, **Then** the entry and its answer view are both removed from the screen, consistent with today's delete behavior.

---

### Edge Cases

- What happens when the user switches the scope dropdown while an entry's answer view is open? The list re-scopes per User Story 1, and the open answer view closes if its entry is no longer part of the newly selected scope (it isn't left open showing an entry that's no longer in the visible list).
- What happens when a user clicks the question of a pending-review or rejected entry in this same list? Nothing new — clicking those questions does not open the new read-only answer view; those entries continue to be reviewed through the existing pending-review workflow.
- What happens when an entry has an unusually long answer? The read-only view must remain fully readable (e.g., scrollable) rather than clipping the answer text.
- What happens if the currently selected document is later deleted? The dropdown and list fall back to the existing default-selection behavior already used elsewhere on this screen (e.g., reverting to "Entire Corpus" or the next available document).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show, in the entry list, only entries that belong to the corpus/document scope currently selected in the dropdown.
- **FR-002**: When "Entire Corpus" is selected, the system MUST show every entry belonging to the active corpus, regardless of which document each entry belongs to.
- **FR-003**: When a specific document is selected, the system MUST show only the entries that belong to that specific document.
- **FR-004**: The system MUST update the visible entry list immediately when the scope dropdown selection changes, without requiring a page reload.
- **FR-005**: For an entry with "Approved" status, clicking its question in the list MUST display that entry's full preferred answer.
- **FR-006**: The question/answer display opened this way MUST be read-only: it MUST NOT present any editable field or save/submit control for the question, the answer, or any other part of the entry.
- **FR-007**: Clicking the question of an entry that is not "Approved" (pending review or rejected) MUST NOT open the new read-only answer display; those entries' existing review behavior is unchanged.
- **FR-008**: The system MUST continue to allow deleting any entry from the list exactly as it does today, unaffected by this feature's changes.
- **FR-009**: Deleting an entry whose read-only answer view is currently open MUST close that view along with removing the entry from the list.

### Key Entities

- **Golden Dataset Entry**: An existing question/preferred-answer reference record already scoped to a corpus and, optionally, a specific document within it. This feature does not change what an entry is or how it's stored — only which entries are displayed for a given scope selection, and how an approved entry's answer can be viewed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Switching the scope dropdown always shows the correct set of entries for the new selection — 100% of the time, with no entries from a different document ever shown under a document-specific selection.
- **SC-002**: Users can see the full answer text of any approved entry in one click, without navigating away from the Golden Dataset screen.
- **SC-003**: Zero editable fields or save controls are ever present in the read-only answer view, across all approved entries.
- **SC-004**: Existing delete behavior continues to work for 100% of entries, including ones whose answer view is currently open.

## Assumptions

- The new read-only "click question to see answer" behavior applies only to entries with "Approved" status. Pending-review and rejected entries keep using their existing, separate review workflow (already in place) and are not affected by this feature.
- The read-only view's minimum content is the question and its full preferred answer. Also surfacing the entry's supporting evidence (already part of the stored record) alongside the answer is a reasonable, non-blocking addition, not a hard requirement of this feature.
- "Scope" filtering is a display concern only — it changes which existing entries are shown for a given dropdown selection, not which corpus/document an entry actually belongs to.
- Delete is explicitly called out by the requester as already working and is not being redesigned here; FR-008/FR-009 exist only to guarantee it isn't broken by this feature's changes, not to add new delete behavior.
