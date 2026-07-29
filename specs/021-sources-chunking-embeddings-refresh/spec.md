# Feature Specification: Sources, Chunking & Embeddings UX Refresh

**Feature Branch**: `021-sources-chunking-embeddings-refresh`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "In Fixed size chunking screen, If there are already chunks stored, it doesnt show by default. It should show if chunking is already been done on it. Embeddings for Entire Corpus is not shown, Lets Implement UMAP and PCA for the embedding selected. Could be entire corpus or individual documents. Lets update Sources screen. I want Sources detail page to be divided in 2 parts. Left and Right Part, Left part will have Upload document cart and document list below it, When i select any document, I should see PDF preview on the right side. Mind you, this PDF preview should be on the right side of the sources screen. The Right side preview part should have a button on Right bottom called \"Chunked Preview\". This should show the document in markdown format. Every chunk in this view should have a unique random color assigned in its background to show it as a chunk."

## Clarifications

### Session 2026-07-28

- Q: How should per-chunk background colors in the Chunked Preview be chosen to keep text legible? → A: Random background chosen from a curated palette of soft/pastel colors, paired with a fixed dark text color so text always stays readable.
- Q: What is the minimum number of embedded chunks required before a UMAP/PCA projection can be computed, and how should the UI behave below that minimum? → A: 5 embedded chunks minimum (shared floor for both methods); the projection method selector stays disabled below this minimum rather than allowing selection and then erroring.
- Q: What corpus scale should "Entire Corpus" auto-load (chunking) and "Entire Corpus" embedding projection be designed to handle without special pagination/batching? → A: Typical lab scale, up to ~50 documents per corpus, for this feature. Larger scale (200+ documents, requiring a batched/paginated backend endpoint) is a plausible future need but explicitly out of scope for now.
- Q: The Chunked Preview renders chunk text through a markdown renderer, but chunk text is plain text extracted from a PDF with no markdown syntax — should the system attempt to reconstruct markdown structure (headings, lists, bold) from the PDF's layout? → A: Best-effort only — attempt lightweight structure reconstruction (e.g., obvious headings/lists) if it's a low-effort addition; otherwise fall back to rendering the raw extracted text as-is through the markdown renderer. Either outcome is acceptable; this is not a hard requirement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Previously Chunked Documents Show Immediately (Priority: P1)

A user returns to the Fixed Size Chunking screen for a document (or corpus) that was already chunked in an earlier session. Today the screen opens blank until the user re-runs chunking. Instead, the screen should recognize that chunks already exist and display them automatically, without requiring the user to re-trigger the chunking process.

**Why this priority**: This is a standing, high-friction defect. Users currently believe their prior work was lost, and re-running chunking wastes time and risks producing slightly different results than what was actually saved. It is a small, self-contained fix with immediate daily value.

**Independent Test**: Chunk a document, leave the screen (or reload the app), reopen the Fixed Size Chunking screen for that same document (and separately for a corpus with multiple already-chunked documents). Confirm the previously saved chunks render immediately with no manual action, and that the screen clearly indicates chunking is already complete for that selection.

**Acceptance Scenarios**:

1. **Given** a document has saved chunks from a prior run, **When** the user opens the Fixed Size Chunking screen and selects that document, **Then** the saved chunks display immediately and the screen indicates chunking has already been performed.
2. **Given** the user selects "Entire Corpus" and every document in the corpus already has saved chunks, **When** the screen loads, **Then** chunks for all documents display immediately without the user clicking "Re-Calculate Chunks."
3. **Given** a document has no saved chunks yet, **When** the user opens the screen for that document, **Then** the screen shows an empty/not-yet-chunked state (no change from today) and still allows the user to run chunking.
4. **Given** chunks are already displayed because they were auto-loaded, **When** the user clicks "Re-Calculate Chunks," **Then** the chunks are recomputed and replace the auto-loaded ones as they do today.

---

### User Story 2 - Sources Screen Split View With PDF Preview (Priority: P2)

A user managing source documents wants to preview a document's actual content without leaving the Sources screen or downloading the file. Today the Sources screen is a single column (upload area + document list) with no way to view a document's content in place.

**Why this priority**: Being able to see the document you're about to chunk or embed — without guessing from the filename — is a foundational usability improvement and is also a prerequisite for the chunk-visualization capability in User Story 3.

**Independent Test**: Open the Sources screen, upload or select an existing PDF document from the list, and confirm its content renders in a preview pane on the right side of the screen while the upload control and document list remain usable on the left.

**Acceptance Scenarios**:

1. **Given** the user is on the Sources screen, **When** the page loads, **Then** the screen is divided into a left part (upload control on top, document list below) and a right part (document preview), side by side.
2. **Given** no document is selected yet, **When** the user views the right part, **Then** it shows an empty/placeholder state inviting the user to select a document.
3. **Given** the document list contains a PDF document, **When** the user selects it, **Then** the right part displays a preview of that PDF's pages.
4. **Given** a document is already selected and previewed, **When** the user selects a different document, **Then** the right part updates to preview the newly selected document.
5. **Given** the user uploads a new document from the left part, **When** the upload completes, **Then** the new document appears in the list below the upload control without disrupting the current right-side preview (unless the user selects the new document).

---

### User Story 3 - Chunked Markdown Preview With Per-Chunk Colors (Priority: P3)

While previewing a document's PDF on the Sources screen, a user wants to switch to a view that shows how the document has been broken into chunks — rendered as markdown text with each chunk visually distinguished by its own background color — so they can sanity-check chunk boundaries at a glance.

**Why this priority**: This gives users direct visual confirmation of chunk quality (are chunks cutting sentences awkwardly, are they reasonably sized, etc.), which is valuable for trusting downstream retrieval quality. It builds on the preview pane introduced in User Story 2.

**Independent Test**: With a document selected that already has saved chunks, click "Chunked Preview" in the bottom-right of the preview pane and confirm the document renders as markdown text with each chunk's background rendered in a distinct color, and that toggling back returns to the PDF preview.

**Acceptance Scenarios**:

1. **Given** a document is selected and previewed on the right side, **When** the user looks at the bottom-right of the preview pane, **Then** they see a "Chunked Preview" button.
2. **Given** the user clicks "Chunked Preview" for a document that has saved chunks, **When** the view switches, **Then** the document's text renders in markdown format with each chunk's background highlighted in its own color, and adjacent chunks use visibly different colors.
3. **Given** the user clicks "Chunked Preview" for a document that has no saved chunks yet, **When** the view switches, **Then** the user sees a message indicating no chunks exist yet for this document, with guidance to run chunking first.
4. **Given** the user is viewing the Chunked Preview, **When** they want to return to the normal document view, **Then** a control is available to switch back to the PDF preview.
5. **Given** a document has many chunks, **When** the Chunked Preview renders, **Then** colors may repeat across the full document but no two consecutive chunks share the same color.

---

### User Story 4 - Visual Embedding Projection (UMAP / PCA) for Corpus or Document (Priority: P4)

A user wants to visually explore how a set of embeddings relate to one another — either for an entire corpus or for a single document's chunks — by projecting the high-dimensional embedding vectors down to a 2D/3D plot using UMAP or PCA, instead of only seeing the raw numeric vector grid available today.

**Why this priority**: This turns an abstract, hard-to-interpret numeric grid into an intuitive visual, helping users judge whether similar content clusters together as expected. It is valuable but depends on embeddings already being generated, and is independent of the Sources/Chunking work above.

**Independent Test**: Generate embeddings for a document (and separately for an entire corpus), open the embedding visualization, select UMAP as the projection method, confirm a 2D/3D plot renders; switch to PCA and confirm the plot updates using that method; switch the scope from a single document to "Entire Corpus" and confirm the plot reflects all selected documents' chunks.

**Acceptance Scenarios**:

1. **Given** a document has saved embeddings, **When** the user selects that document and chooses the UMAP projection method, **Then** a 2D/3D plot of the document's chunk embeddings renders, with each point identifiable back to its source chunk.
2. **Given** the same document's embeddings, **When** the user switches the projection method to PCA, **Then** the plot updates to reflect the PCA projection instead of UMAP.
3. **Given** a corpus where every document has saved embeddings, **When** the user selects "Entire Corpus" as the scope and a projection method, **Then** the plot renders points for every chunk across all documents in the corpus, distinguishing which document each point belongs to.
4. **Given** a corpus where only some documents have saved embeddings, **When** the user selects "Entire Corpus," **Then** the plot renders only the chunks that have embeddings and the screen indicates which documents were excluded and why.
5. **Given** fewer than 5 embedded chunks are available for the selected scope, **When** the user views the projection controls, **Then** the UMAP/PCA projection method selector is disabled and a message explains the 5-chunk minimum, rather than allowing selection and then showing an empty or broken plot.

---

### Edge Cases

- What happens if a document's underlying PDF file is missing or unreadable when the user selects it in the Sources screen preview? The right side should show a clear "preview unavailable" message rather than a blank or broken pane.
- What happens if chunking or embedding generation is still in progress for a document when the user opens Chunked Preview or the embedding projection view? The view should indicate work is in progress rather than showing stale or partial data as if it were final.
- What happens when a corpus contains zero documents, or a document has zero saved chunks, when the user requests "Entire Corpus" chunking auto-display or embedding projection? The screen should show an appropriate empty state rather than an error.
- What happens if a document is deleted while its PDF or Chunked Preview is open in the right-side pane? The preview should clear and indicate the document is no longer available.
- How does the system behave if a document has been re-chunked (producing new chunk boundaries) after embeddings were generated against the old chunks? The embedding projection should reflect only chunks that currently have saved embeddings, and should not assume today's chunk boundaries match those embeddings.

## Requirements *(mandatory)*

### Functional Requirements

**Fixed Size Chunking auto-display**

- **FR-001**: When the Fixed Size Chunking screen is opened for a document or corpus, the system MUST check whether saved chunks already exist and, if so, display them automatically without requiring the user to trigger a chunking run.
- **FR-002**: The Fixed Size Chunking screen MUST visually indicate when the currently displayed chunks were auto-loaded from prior saved results versus freshly computed in the current session.
- **FR-003**: Selecting "Entire Corpus" on the Fixed Size Chunking screen MUST auto-load saved chunks for every document in the corpus that already has them.
- **FR-004**: The manual "Re-Calculate Chunks" action MUST continue to work as today, replacing any auto-loaded chunks with freshly computed ones.

**Sources screen split view**

- **FR-005**: The Sources detail screen MUST present two side-by-side areas: a left area containing the document upload control followed by the document list, and a right area reserved for document preview.
- **FR-006**: Selecting a document in the left-side document list MUST render that document's content preview in the right-side area.
- **FR-007**: The right-side area MUST show an empty/placeholder state when no document is selected.
- **FR-008**: The system MUST be able to retrieve and display the stored PDF content for a selected source document.

**Chunked Preview**

- **FR-009**: The right-side preview area MUST include a "Chunked Preview" control positioned at its bottom-right.
- **FR-010**: Activating "Chunked Preview" MUST render the selected document's text through a markdown renderer, with each chunk's background displayed in a distinct color. Reconstructing markdown structure (headings, lists, bold) from the source PDF's layout is a best-effort, non-blocking enhancement — if not low-effort to implement, chunk text MUST still render as-is (plain paragraphs) through the markdown renderer.
- **FR-011**: Adjacent chunks in the Chunked Preview MUST use visibly different background colors, drawn at random from a curated palette of soft/pastel colors; colors may repeat non-consecutively elsewhere in the document. Chunk text MUST use a fixed dark text color so it stays legible against every palette color.
- **FR-012**: If the selected document has no saved chunks, the Chunked Preview MUST show a message explaining that no chunks exist yet and how to create them, rather than an empty or broken view.
- **FR-013**: The user MUST be able to switch back from the Chunked Preview to the standard PDF preview for the same document.

**Embedding projection (UMAP / PCA)**

- **FR-014**: The system MUST offer UMAP and PCA as selectable, working projection methods for visualizing saved embeddings (replacing their current "coming soon" placeholder state).
- **FR-015**: Users MUST be able to choose the scope of the embedding projection: a single document's chunk embeddings, or the entire corpus's chunk embeddings combined.
- **FR-016**: When "Entire Corpus" scope is selected, the projection view MUST visually distinguish which source document each plotted point belongs to.
- **FR-017**: When the selected scope includes documents without any saved embeddings, the system MUST exclude them from the plot and clearly indicate to the user which documents were excluded.
- **FR-018**: When fewer than 5 embedded chunks are available for the selected scope, the system MUST keep the UMAP/PCA projection method selector disabled and show an explanatory message stating the 5-chunk minimum, instead of allowing a selection that fails or renders an empty/broken plot.

### Key Entities

- **Saved Chunk**: A previously computed and persisted text segment of a source document, with its position/order within the document. Already exists today; this feature adds automatic surfacing of these on the Chunking screen and rendering of them as colored markdown segments.
- **Source Document Preview**: The renderable representation of a source document's stored PDF content, shown in the Sources screen's right-side pane.
- **Embedding Projection**: A computed 2D/3D representation of one or more chunk embeddings, produced via a chosen method (UMAP or PCA), scoped to either a single document or an entire corpus, with each point traceable back to its source chunk and document.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users opening the Fixed Size Chunking screen for an already-chunked document see their existing chunks within the same time it takes the screen to load today — with zero additional manual clicks required.
- **SC-002**: 100% of documents with saved chunks display those chunks automatically on first screen load, verified across both single-document and entire-corpus selections, for corpora of up to ~50 documents.
- **SC-003**: Users can view a selected source document's PDF content without leaving the Sources screen or downloading any file, in under 2 seconds after selection for typical document sizes.
- **SC-004**: Users can switch between PDF preview and Chunked Preview for a document in a single click, with each chunk visually distinguishable from its neighbors by color.
- **SC-005**: Users can generate and view a UMAP or PCA projection for both an individual document and an entire corpus, with points visibly clustering by similarity for semantically related content in manual spot checks.

## Assumptions

- "Chunked Preview" renders the document using the same saved chunks already produced by the Fixed Size Chunking feature; it does not introduce a new chunking method or re-chunk the document on the fly.
- Markdown structure reconstruction (headings/lists/bold) from PDF layout in the Chunked Preview is best-effort and optional; if not straightforward to implement, plain-text rendering through the markdown renderer is an acceptable, complete implementation of this feature.
- Per-chunk background colors are assigned automatically by the system each time the Chunked Preview is opened, drawn from a curated palette of soft/pastel colors with a fixed dark text color for legibility; users are not expected to customize or persist specific colors per chunk. The only hard constraint is that immediately adjacent chunks must not share a color.
- The PDF preview shows the document's stored file as-is (standard page-by-page viewing); advanced capabilities such as full-text search within the preview or annotation are out of scope for this feature.
- "Embeddings for Entire Corpus is not shown" refers to the lack of a working visual (plotted) representation of corpus-level embeddings — an "Entire Corpus" scope selector already exists in the current embeddings workflow, but no functioning projection/plot exists for any scope today. This feature delivers that missing visualization for both scopes.
- UMAP and PCA projections operate on embeddings already generated and saved using the currently configured embedding model; this feature does not change how or when embeddings are generated.
- A minimum of 5 embedded chunks is required before a projection can be meaningfully computed and plotted; below that, the projection method selector stays disabled with an explanatory message rather than allowing a failed attempt.
- Existing Sources screen capabilities (upload, delete, attach-to-corpus, capacity indicator) are preserved as-is within the new left-side area; this feature only changes the overall layout and adds the preview pane.
- "Entire Corpus" auto-load (chunking) and "Entire Corpus" embedding projection are designed for typical lab-scale corpora (up to ~50 documents); no special pagination or batched backend endpoint is required for this feature. Supporting substantially larger corpora (200+ documents) is a plausible future enhancement, not part of this feature's scope.
