# Feature Specification: Delete Source Documents

**Feature Branch**: `004-delete-source-documents`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "I should be able to delete the PDFs on demand from my corpus"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete a single document from my corpus (Priority: P1)

As the user of the RAG experimentation tool, I want to delete an individual PDF from my document
list whenever I no longer want it in my corpus, so that my source collection only contains
documents I actually intend to use.

**Why this priority**: This is the entire feature — without the ability to remove a single
document, there is no delete capability at all. It is independently valuable and delivers the
core request on its own.

**Independent Test**: Can be fully tested by uploading a document, triggering delete on it,
confirming the action, and verifying it no longer appears in the document list and no longer
exists in backend storage.

**Acceptance Scenarios**:

1. **Given** a document is listed in the Document List, **When** the user triggers delete on that
   document and confirms the action, **Then** the document is removed from the list and is no
   longer present in backend storage.
2. **Given** a document is listed, **When** the user triggers delete but cancels the confirmation,
   **Then** the document remains untouched in the list and in backend storage.
3. **Given** a document has just been deleted, **When** the user reloads the page, **Then** the
   deleted document does not reappear (deletion is permanent and persisted, not just removed from
   local view).
4. **Given** a delete request fails (e.g., the file was already removed outside the app, or a
   filesystem error occurs), **When** the failure happens, **Then** the user sees a clear error
   message and the document list reflects the actual current state (removed from the list only if
   it is confirmed gone from storage).

---

### User Story 2 - Delete multiple documents at once (Priority: P2)

As the user, I want to select several documents in my corpus and delete them together, so that
cleaning up a large batch of unwanted sources doesn't require repeating the single-delete action
one file at a time.

**Why this priority**: A meaningful convenience once single-document delete exists, but the
feature is fully usable without it — users can already achieve the same end state by deleting one
document at a time (User Story 1).

**Independent Test**: Can be fully tested by uploading several documents, selecting more than one,
triggering a bulk delete, confirming once, and verifying all selected documents are removed from
the list and from backend storage while unselected documents remain.

**Acceptance Scenarios**:

1. **Given** multiple documents are listed, **When** the user selects more than one and triggers
   delete, **Then** a single confirmation covers all selected documents, and confirming removes
   all of them from the list and from backend storage.
2. **Given** a multi-select delete is in progress, **When** one of the selected files fails to
   delete (e.g., already removed externally) while others succeed, **Then** the successfully
   deleted documents are removed from the list, and the failed one is reported individually with
   its own error message rather than silently discarded or blocking the others.

---

### Edge Cases

- What happens when the user tries to delete a document that is still shown as "Processing" (its
  server-confirmed identity may not exist yet)? Delete is only available once a document has a
  server-confirmed identity in the list; a still-processing placeholder has no delete action
  available.
- What happens when the document was already deleted or moved outside the app (e.g., someone
  removed the file directly from the storage directory) before the user's delete request reaches
  the backend? The system treats this as a successful outcome for the user's intent (the file is
  gone either way) and removes the stale entry from the list rather than showing a confusing error.
- What happens if the user has no documents in the list? No delete controls are shown or are
  disabled, since there is nothing to delete.
- What happens if the user double-clicks delete or triggers it twice quickly? Only one deletion is
  processed per document; a repeat request for an already-deleted document is treated as already
  satisfied, not as a new error.
- Does deleting a document affect the System Capacity widget's processing estimate (see
  `003-system-capacity-widget`)? No — that estimate is a static, hardware-derived snapshot and is
  not tied to the number or size of documents currently in the corpus.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Document List MUST provide a way for the user to delete an individual,
  server-confirmed document.
- **FR-002**: The system MUST require the user to confirm a delete action before it takes effect,
  since deletion is destructive and cannot be undone.
- **FR-003**: Confirming a delete MUST permanently remove the underlying PDF file from backend
  storage, not merely hide it from the current view.
- **FR-004**: After a successful delete, the document MUST no longer appear in the document list,
  including after a page reload (the deletion is persisted, not session-local).
- **FR-005**: If a delete request fails for a reason other than the file already being absent
  (e.g., a filesystem/permission error), the system MUST show a clear, specific error message and
  MUST leave the document visible in the list, since it was not actually removed.
- **FR-006**: If a delete request targets a file that is already absent from backend storage (e.g.,
  removed externally), the system MUST treat this as a successful deletion from the user's
  perspective and remove the stale entry from the list rather than surfacing an error.
- **FR-007**: The system MUST NOT offer a delete action for a document that only exists as a
  transient, not-yet-server-confirmed "Processing" placeholder.
- **FR-008**: The Document List MUST allow the user to select more than one document and delete
  them together in a single confirmed action.
- **FR-009**: During a multi-document delete, if some documents fail to delete while others
  succeed, the system MUST remove the successful ones from the list and MUST report each failure
  individually, rather than treating the whole batch as all-or-nothing.
- **FR-010**: Deleting one or more documents MUST NOT alter or invalidate any other document
  remaining in the corpus.

### Key Entities

- **SourceDocument** (existing entity, from `002-persist-pdf-sources`): This feature adds a
  deletion lifecycle to it — a document exists (as today) from successful upload until either it
  is removed externally or the user deletes it via this feature; deletion is a terminal,
  irreversible state transition with no "undo" or recovery path.
- **DeletionResult**: Represents the outcome of a single document's deletion within a request
  (including a multi-document request) — which document, and whether it succeeded, was already
  absent (treated as success), or failed with a specific reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can remove an unwanted document from their corpus in 2 clicks or fewer
  (trigger delete, confirm) without leaving the Data Sources screen.
- **SC-002**: 100% of successfully deleted documents no longer appear in the document list after a
  page reload, confirming deletion is persisted rather than merely visual.
- **SC-003**: Users deleting a batch of documents at once complete the cleanup in a single
  confirmation step, regardless of how many documents are selected.
- **SC-004**: When a delete fails for a reason other than the file already being gone, 100% of the
  time the user sees a specific, actionable error message rather than a silent failure or a
  generic crash.

## Assumptions

- Deletion is permanent and irreversible — there is no trash, recycle bin, or undo mechanism in
  this feature, consistent with the project's current single-user, no-database, filesystem-backed
  storage model (`002-persist-pdf-sources`) and the constitution's Single-User Simplicity (YAGNI)
  principle.
- Only documents already listed with a server-confirmed identity (i.e., persisted to backend
  storage) can be deleted; the transient client-side "Processing" placeholder state has no delete
  action.
- No experiment-tracking or ingestion pipeline exists yet (per the constitution, that is future
  work), so deleting a source document has no downstream experiment-configuration or
  reproducibility impact to reconcile in this feature.
- The System Capacity widget's estimate (`003-system-capacity-widget`) is unaffected by deletion,
  since it is a static hardware-derived snapshot, not a live corpus-usage meter.
- Bulk (multi-document) delete is a same-priority-tier convenience on top of single-document
  delete, not a replacement for it; both remain available side by side.
