# Feature Specification: Data Sources Screen

**Feature Branch**: `001-data-sources-screen`

**Created**: 2026-07-04

**Status**: Draft

**Input**: User description: "I have added a design for sources implementation. Go through the design and implement the screen. Dont worry about adding the uploaded files to a database for now. Let show the uploaded files as shown in the image"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload PDF Source Documents (Priority: P1)

As the user of the RAG experimentation tool, I want to upload PDF source documents by dragging them onto the Data Sources screen (or browsing for them), so that I can see which sources are available for my experiments.

**Why this priority**: Uploading and seeing sources is the entire purpose of this screen; without it there is nothing to experiment on. This is the MVP.

**Independent Test**: Can be fully tested by dragging a valid PDF onto the upload area (or selecting one via the browse dialog) and confirming it immediately appears in the document list below with its name, size, and upload time.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen is open with an empty document list, **When** the user drags a valid PDF file onto the upload area, **Then** the file appears as a new entry in the document list showing its name, size, and current upload date/time.
2. **Given** the Data Sources screen is open, **When** the user clicks the upload area and selects a valid PDF file through the browse dialog, **Then** the file appears as a new entry in the document list.
3. **Given** the user uploads multiple valid PDF files at once, **When** the upload completes, **Then** every file appears as its own entry in the document list.
4. **Given** a document has just been added to the list, **When** the user looks at its status, **Then** the document shows a status indicator (e.g., "Processing" transitioning to "Processed") consistent with the design.

---

### User Story 2 - Reject Invalid Uploads (Priority: P2)

As the user, I want the screen to reject files that are not PDFs or that exceed the size limit, so that I don't accidentally clutter my sources with unsupported or oversized files.

**Why this priority**: Protects the integrity of the source list and matches the constraints visibly advertised on the screen ("Max size: 50MB", "PDF only"), but the screen is still usable end-to-end without this validation being the very first thing built.

**Independent Test**: Can be fully tested by attempting to upload a non-PDF file and a PDF larger than 50MB, and confirming both are rejected with a visible error message and never appear in the document list.

**Acceptance Scenarios**:

1. **Given** the Data Sources screen is open, **When** the user uploads a non-PDF file, **Then** the file is rejected, a clear error message is shown, and no new entry is added to the document list.
2. **Given** the Data Sources screen is open, **When** the user uploads a PDF file larger than 50MB, **Then** the file is rejected, a clear error message is shown, and no new entry is added to the document list.
3. **Given** the user uploads a mix of valid and invalid files in one action, **When** the upload completes, **Then** only the valid PDF files appear in the document list and the invalid ones are individually reported as rejected.

---

### User Story 3 - Export the Document List (Priority: P3)

As the user, I want to export the current list of uploaded documents to a CSV file, so that I can keep an external record of what I've uploaded during this session.

**Why this priority**: Useful convenience but not required for the core upload-and-view workflow to deliver value.

**Independent Test**: Can be fully tested by uploading one or more documents, clicking "Export CSV", and confirming a CSV file is produced containing the name, size, upload date, and status of every document currently shown in the list.

**Acceptance Scenarios**:

1. **Given** one or more documents are listed, **When** the user clicks "Export CSV", **Then** a CSV file downloads containing one row per listed document with its name, size, upload date, and status.
2. **Given** the document list is empty, **When** the user clicks "Export CSV", **Then** a CSV file downloads containing only the header row.

---

### Edge Cases

- What happens when the user uploads a file with the same name as one already in the list? Both entries are kept as separate rows (no de-duplication), since there is no backing store to check against.
- What happens when the user opens the file browser dialog and cancels without picking a file? The document list is unchanged.
- What happens when the user refreshes or navigates away from the page? The document list resets to empty, since documents are not persisted anywhere for this feature.
- How does the screen behave while a large file is still being read/added? The document appears with a "Processing" status until it is ready, then updates to "Processed".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The screen MUST provide an upload area that accepts PDF files via drag-and-drop.
- **FR-002**: The screen MUST provide a click-to-browse alternative to drag-and-drop for selecting PDF files from the local filesystem.
- **FR-003**: The screen MUST support uploading multiple files in a single action.
- **FR-004**: The screen MUST reject any file that is not a PDF and MUST display an inline, visible message naming the rejected file and stating the specific reason ("not a PDF file").
- **FR-005**: The screen MUST reject any file larger than 50MB and MUST display an inline, visible message naming the rejected file and stating the specific reason ("exceeds the 50MB limit").
- **FR-006**: The screen MUST display the maximum file size (50MB) and accepted file type (PDF only) as visible constraints near the upload area.
- **FR-007**: The screen MUST display every successfully uploaded document in a document list, showing: document name, human-readable file size (e.g., "2.4 MB"), upload date/time, and a status indicator.
- **FR-008**: The screen MUST show each document's status as either "Processing" or "Processed"; a newly uploaded document MUST start as "Processing" and automatically transition to "Processed" shortly after, since no real ingestion pipeline exists yet.
- **FR-009**: The screen MUST NOT persist uploaded documents or their metadata to any backend, database, or server-side storage; the document list MUST reflect only documents uploaded during the current browser session and MUST reset when the page is reloaded.
- **FR-010**: The screen MUST allow the user to export the currently displayed document list as a CSV file containing name, size, upload date, and status for each row.
- **FR-011**: The screen MUST display an aggregate vector storage indicator (amount used and percentage of capacity) matching the design; since no vector database is integrated yet, this indicator MUST use static/placeholder values rather than data computed from real storage.
- **FR-012**: The screen MUST display the application's primary navigation (sections: Sources, Experiments, Playground, Vector View, Logs) with "Sources" shown as the active section; the other sections are visual placeholders only and are not required to be functional as part of this feature.
- **FR-013**: The screen MUST display the top bar elements shown in the design (notifications icon, search icon, and a "Deploy Pipeline" primary button); the "Deploy Pipeline" button is a visual placeholder only and is not required to perform a real deployment as part of this feature.
- **FR-014**: The "View All" control MAY be present as a visual element matching the design but is not required to navigate to a distinct view as part of this feature.

### Key Entities

- **Source Document**: Represents a single PDF file uploaded during the current browser session. Key attributes: file name, file size, upload timestamp, processing status (Processing/Processed). Exists only in the current session; not persisted to any store.
- **Upload Rejection**: Represents a file the user attempted to upload that failed validation (wrong type or too large). Key attributes: file name, rejection reason. Transient — used only to display an error message; never becomes a Source Document and is not persisted.
- **Vector Storage Stat**: Represents the aggregate "Vector Storage" indicator shown on the screen (amount used, percent of capacity). Static/placeholder values in this feature since no vector database is integrated yet.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload a valid PDF and see it appear in the document list in under 2 seconds, with no full-page reload.
- **SC-002**: 100% of non-PDF upload attempts are rejected with a visible error message and never appear in the document list.
- **SC-003**: 100% of upload attempts for files over 50MB are rejected with a visible error message and never appear in the document list.
- **SC-004**: A user can determine the processing status of every listed document at a glance, without leaving the screen or opening another view.
- **SC-005**: A user can export the visible document list to a CSV file in 2 clicks or fewer.
- **SC-006**: The screen visually matches the provided design reference (layout, colors, typography, and component styling) as judged by side-by-side comparison.

## Assumptions

- Uploaded documents are held only in the browser session's memory; no backend API, database, or filesystem persistence is implemented as part of this feature (per explicit user instruction).
- Because there is no real ingestion pipeline yet, the "Processing" → "Processed" status transition is simulated (e.g., a short delay) purely to match the visual design; it does not reflect real document processing.
- The "Vector Storage" capacity widget uses static placeholder values, since Qdrant integration is out of scope for this feature.
- Sidebar navigation items other than "Sources" and the "Deploy Pipeline" button are visual-only placeholders with no behavior in this feature.
- No delete/remove-document capability is included in this iteration, since it is not present in the provided design; it may be added in a future feature.
- This screen is used by a single local user (per the project constitution); no multi-user or access-control behavior is in scope.
