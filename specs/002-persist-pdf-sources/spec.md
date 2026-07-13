# Feature Specification: Persist Uploaded PDFs to Filesystem

**Feature Branch**: `002-persist-pdf-sources`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "Lets save the uploaded files in the filesystem in the pdfs folder for now. So that the PDFs stay in the UI and dont go away on refres"

## User Scenarios & Testing *(mandatory)*

<!--
  This feature extends 001-data-sources-screen, which explicitly kept uploaded
  documents in browser-session memory only (FR-009 of that spec) and reset the
  list on refresh. This feature replaces that in-memory behavior with real
  filesystem persistence so the document list survives a page reload.
-->

### User Story 1 - Uploaded PDFs Survive a Page Refresh (Priority: P1)

As the user of the RAG experimentation tool, I want the PDFs I upload on the Data Sources screen to be saved to disk, so that when I refresh or reopen the page my previously uploaded sources are still listed instead of disappearing.

**Why this priority**: This is the entire point of the feature — without durable storage, every browser refresh silently destroys the user's uploaded sources, which is the exact problem being fixed. This is the MVP.

**Independent Test**: Can be fully tested by uploading a valid PDF, confirming it appears in the document list, refreshing the page, and confirming the same document still appears in the list with the same name, size, and upload time.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen is open with an empty document list, **When** the user uploads a valid PDF, **Then** the file is saved to a `pdfs` folder on the server's filesystem and appears in the document list.
2. **Given** one or more PDFs have already been uploaded and saved, **When** the user refreshes the page, **Then** the document list repopulates from the files present in the `pdfs` folder, showing the same documents (name, size, upload date/time, status) without requiring the user to re-upload them.
3. **Given** one or more PDFs have already been uploaded and saved, **When** the user closes the browser tab and reopens the Data Sources screen later, **Then** the previously uploaded documents are still shown in the list.
4. **Given** multiple PDFs are uploaded in one action, **When** the upload completes, **Then** every file is individually saved to the `pdfs` folder and every file appears as its own entry in the document list.

---

### User Story 2 - Reject Invalid Uploads Before They Reach Disk (Priority: P2)

As the user, I want files that are not PDFs or that exceed the size limit to be rejected before anything is written to disk, so that the `pdfs` folder only ever contains valid source documents.

**Why this priority**: Prevents invalid or oversized files from silently accumulating in persistent storage now that uploads are actually written to disk; builds directly on the validation already established for the Data Sources screen.

**Independent Test**: Can be fully tested by attempting to upload a non-PDF file and a PDF larger than 50MB, and confirming neither is written to the `pdfs` folder, neither appears in the document list (before or after a refresh), and a visible error message names the rejected file and reason.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen is open, **When** the user uploads a non-PDF file, **Then** the file is rejected, nothing is written to the `pdfs` folder, a clear error message is shown, and no new entry is added to the document list.
2. **Given** the Data Sources screen is open, **When** the user uploads a PDF file larger than 50MB, **Then** the file is rejected, nothing is written to the `pdfs` folder, a clear error message is shown, and no new entry is added to the document list.
3. **Given** the user uploads a mix of valid and invalid files in one action, **When** the upload completes, **Then** only the valid PDF files are saved to the `pdfs` folder and listed, and the invalid ones are individually reported as rejected.

---

### User Story 3 - Re-uploading a File With the Same Name (Priority: P3)

As the user, I want a clear, predictable outcome when I upload a PDF whose name matches a file already saved in the `pdfs` folder, so that I don't lose a previous source by accident and don't end up confused about which file is which.

**Why this priority**: Only matters once files are actually persisted to a shared folder (a new possibility introduced by this feature); the core save-and-reload flow (User Story 1) delivers value without this edge case being handled first.

**Independent Test**: Can be fully tested by uploading a PDF, then uploading a different PDF file using the exact same file name, and confirming both the original and the new upload remain available afterward under distinct entries, with the newer one clearly distinguishable (e.g., a suffixed name).

**Acceptance Scenarios**:

1. **Given** a PDF named `report.pdf` is already saved in the `pdfs` folder and listed, **When** the user uploads a different file also named `report.pdf`, **Then** the new file is saved under a distinct name (e.g., `report (1).pdf`) so the original file on disk is never overwritten, and both entries appear in the document list.

---

### Edge Cases

- What happens when the `pdfs` folder does not yet exist (first run of the application)? The folder MUST be created automatically before the first file is saved.
- What happens when the disk is full or the server lacks permission to write to the `pdfs` folder? The upload MUST fail for the affected file(s), a clear error message MUST be shown, and no partial/corrupt file MUST be left in the `pdfs` folder or in the document list.
- What happens if a file is removed from the `pdfs` folder directly on disk (outside the app) between page loads? The document list MUST reflect only what is actually present in the `pdfs` folder the next time it is loaded — the removed file MUST no longer appear.
- What happens while a large file is still being written to disk? The document appears with a "Processing" status until the write completes, then updates to "Processed", consistent with the existing status behavior from the Data Sources screen.
- What happens on the very first load of the screen after this feature ships, if PDFs already exist in the `pdfs` folder from prior testing? They MUST appear in the document list immediately, with status "Processed" (no simulated processing delay for files that were already fully saved before the page loaded).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST save every successfully validated uploaded PDF as a file in a `pdfs` folder on the server's filesystem, rather than holding it only in browser memory.
- **FR-002**: The system MUST create the `pdfs` folder automatically if it does not already exist before saving the first file.
- **FR-003**: The system MUST reject, before writing to disk, any file that is not a PDF or that exceeds 50MB, using the same validation rules already established for the Data Sources screen (naming the file and the specific rejection reason).
- **FR-004**: When an uploaded file's name matches a file already saved in the `pdfs` folder, the system MUST save the new upload under a distinct, non-colliding name (e.g., by appending a numeric suffix) rather than overwriting the existing file.
- **FR-005**: On loading (or reloading) the Data Sources screen, the system MUST populate the document list from the files actually present in the `pdfs` folder, rather than from any in-memory/session-only state.
- **FR-006**: The document list MUST continue to show, for every persisted document, its name, human-readable file size, upload date/time, and a status indicator ("Processing" while a file is still being saved, "Processed" once saved), consistent with the existing Data Sources screen behavior.
- **FR-007**: Documents already fully saved in the `pdfs` folder before a page load MUST be shown immediately with status "Processed" (no simulated processing delay) when the list is populated.
- **FR-008**: If a file present in the `pdfs` folder at one page load is no longer present at a later page load (e.g., removed outside the app), the document list on the later load MUST NOT include that file.
- **FR-009**: If saving an uploaded file to disk fails for any reason (e.g., insufficient disk space or permissions), the system MUST show a clear, visible error naming the affected file and MUST NOT add a corresponding entry to the document list or leave a partial file behind.
- **FR-010**: The system MUST continue to support uploading multiple files in a single action, each saved and listed independently per the rules above.
- **FR-011**: The CSV export capability from the Data Sources screen MUST continue to export the currently displayed (filesystem-backed) document list unchanged in format.

### Key Entities

- **Source Document**: Represents a single PDF file persisted in the `pdfs` folder on the server's filesystem. Key attributes: file name (as stored on disk, which may differ from the originally uploaded name if a collision was resolved), file size, upload/save timestamp (derived from the file's filesystem metadata), processing status (Processing/Processed). Now durable across page reloads and application restarts.
- **Upload Rejection**: Represents a file the user attempted to upload that failed validation (wrong type or too large) and was therefore never written to disk. Key attributes: file name, rejection reason. Transient — used only to display an error message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload a PDF, refresh the page, and see that same document still listed 100% of the time, with no manual re-upload required.
- **SC-002**: A user can close and reopen the Data Sources screen at a later time and still see all previously uploaded, valid PDFs listed.
- **SC-003**: 0% of rejected (non-PDF or over-50MB) upload attempts result in a file being written to the `pdfs` folder.
- **SC-004**: 0% of same-named re-uploads result in an existing saved PDF being silently overwritten or lost.
- **SC-005**: After a failed save (e.g., disk error), the document list contains no partial or broken entries for that upload attempt.

## Assumptions

- The `pdfs` folder is a single shared folder on the server's local filesystem (per the project's fixed technology stack, which specifies local filesystem source storage); it is not per-user or per-session, consistent with this being a single-local-user tool.
- Upload date/time for a persisted document is derived from the file's filesystem metadata (e.g., creation/modification time) rather than from a separate database, since no database for source metadata exists yet.
- This feature only persists the raw PDF files themselves; it does not add ingestion, chunking, embedding, or storage of derived artifacts in Qdrant — those remain out of scope, consistent with prior Data Sources screen work.
- No delete/remove-document capability is introduced by this feature; removing a persisted file (if ever needed) is expected to be a future, separate feature.
- The 50MB size limit and PDF-only restriction remain unchanged from the existing Data Sources screen behavior.
- The "Vector Storage" indicator and other placeholder UI elements from the existing Data Sources screen are unaffected by this feature.
