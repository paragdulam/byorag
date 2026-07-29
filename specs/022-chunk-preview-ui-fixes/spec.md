# Feature Specification: Chunk Preview Structure & UI Fixes

**Feature Branch**: `022-chunk-preview-ui-fixes`

**Created**: 2026-07-28

**Status**: Draft

**Input**: User description: "First version of chunked Preview is implemented. I want to preserve the original document structure and color the background as chunks. If we can get a markdown format that matches the PDF that is shown and just background color is given showing chunks. That would be a great feature addon for users and help them understand how chunking is working. Also, the UI list of documents in Sources is broken. Wrap the text, its ok if the row of the height is based on content. Match the UI in Fixed size chunking for Entire corpus to Embeddings. When entire corpus is selected in Embeddings, the UI is different to that of Entire corpus in FIxed size chunking"

## Clarifications

### Session 2026-07-28

- Q: What fidelity level should the markdown structure reconstruction target? → A: A lightweight heuristic — detect obvious cues from the extracted text itself (e.g., short standalone lines treated as headings, bullet/number prefixes treated as lists) without analyzing the PDF's actual layout (fonts, positions).
- Q: When a chunk boundary falls mid-paragraph or mid-sentence, where does the background color change? → A: Inline — the color changes exactly at the chunk boundary, even mid-line or mid-word, matching the real boundary precisely.
- Q: When chunk overlap causes a span of text to belong to two chunks, how is that shared span colored? → A: A distinct third "overlap" indicator (a different color/pattern from either chunk's own color), so shared spans are clearly recognizable as such rather than looking like they belong to only one chunk.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Readable Document List in Sources (Priority: P1)

A user managing source documents currently sees the document list break or clip document names, because the list only occupies half the screen width (since the Sources screen was split into upload/list and preview panes) while the table still assumes full-width columns. Document names must wrap onto multiple lines instead of being cut off or overflowing, and each row must grow taller to fit its wrapped content.

**Why this priority**: This is an active defect affecting every visit to the Sources screen — the most basic, constantly-used screen in the app. It's small and isolated, so fixing it first restores baseline usability immediately.

**Independent Test**: Open the Sources screen with a corpus containing a document with a long file name, and confirm the name wraps onto multiple lines within its column, the row expands to fit it, and no text is clipped or overflows outside the table.

**Acceptance Scenarios**:

1. **Given** a document with a long name, **When** the Sources screen renders the document list, **Then** the name wraps onto as many lines as needed within its column, fully visible, with no truncation or horizontal overflow.
2. **Given** a row with a wrapped, multi-line document name, **When** the row renders, **Then** the row's height grows to fit the wrapped content, and the row's other cells (size, upload date, status, actions) remain vertically aligned and usable.
3. **Given** a mix of short and long document names in the same list, **When** the list renders, **Then** each row's height is independent — short names produce compact rows, long names produce taller rows, and no row's content overlaps a neighboring row.

---

### User Story 2 - Chunked Preview Shows the Document as a Continuous, Structured Read (Priority: P2)

Today's Chunked Preview renders each chunk as its own separate, boxed card stacked with gaps between them — which reads as a disconnected list of snippets rather than the document itself. A user wants to see the document the way it actually reads (continuous paragraphs, headings, and structure resembling the original PDF), with each chunk's extent shown purely as a background color change — like a highlighter marking sections of one continuous page — so they can understand how chunking divides up their real document, not an abstracted list of pieces.

**Why this priority**: This is the flagship enhancement requested — it turns Chunked Preview from a rough first version into a genuinely useful tool for understanding chunking behavior. It depends on chunks already existing (delivered by prior work) and is independent of the other two fixes in this spec.

**Independent Test**: Open Chunked Preview for a document with multiple saved chunks and confirm the document reads as one continuous, naturally-flowing body of text (no card borders, no gaps, no per-chunk boxes) with each chunk's span visually distinguished only by background color, and that adjacent chunks use different colors.

**Acceptance Scenarios**:

1. **Given** a document with multiple saved chunks, **When** the user opens Chunked Preview, **Then** the document renders as one continuous flow of text — no borders, dividers, or gaps separate one chunk's text from the next.
2. **Given** the same continuous document, **When** the user looks at any point in the text, **Then** the background color at that point reflects which chunk that text belongs to, and the color changes at each chunk boundary.
3. **Given** two adjacent chunks in the flow, **When** both are visible on screen, **Then** their background colors are visibly different from one another, exactly as today's per-chunk color assignment already guarantees.
4. **Given** the document's extracted text has obvious structural cues (e.g., a short standalone line that reads like a heading, or lines starting with bullet/number markers), **When** Chunked Preview renders, **Then** those cues are reflected in the markdown output (as headings/lists) rather than rendered as flat paragraphs; text without such cues renders as plain paragraphs.
5. **Given** a chunk boundary falls in the middle of a paragraph or sentence, **When** Chunked Preview renders that paragraph, **Then** the background color changes exactly at the boundary position, even mid-line, rather than coloring the whole paragraph with one color.
6. **Given** chunk overlap causes a span of text to belong to two chunks, **When** Chunked Preview renders that shared span, **Then** it displays a distinct "overlap" background color/pattern different from either contributing chunk's own color.
7. **Given** a document with no saved chunks, **When** the user opens Chunked Preview, **Then** the existing "no chunks yet" message continues to show (unchanged from today).
8. **Given** the user is viewing Chunked Preview, **When** they switch back to the PDF view, **Then** that toggle continues to work exactly as today.

---

### User Story 3 - Consistent "Entire Corpus" Experience Across Chunking and Embeddings (Priority: P3)

A user who selects "Entire Corpus" on the Embeddings screen currently sees a different visual presentation than selecting "Entire Corpus" on the Fixed Size Chunking screen — an extra, differently-styled "existing data" block that has no counterpart on the Chunking screen, alongside a per-document results summary that behaves differently after generating versus after saving. The user wants both screens to present "Entire Corpus" the same way, so switching between them feels like one consistent tool rather than two different UIs bolted together.

**Why this priority**: This is a polish/consistency fix. It matters for trust and learnability but doesn't block any workflow — users can already generate and save embeddings today, just with an unfamiliar-looking summary.

**Independent Test**: Select "Entire Corpus" on the Fixed Size Chunking screen and note the presentation (progress display, already-done indicator, per-document summary list). Select "Entire Corpus" on the Embeddings screen and confirm the same presentation pattern is used for the equivalent states (already-existing data, in-progress, completed-with-results, per-document failure).

**Acceptance Scenarios**:

1. **Given** "Entire Corpus" is selected on the Embeddings screen and every document already has saved embeddings for the selected model, **When** the screen loads, **Then** the "already has existing data" indicator uses the same presentation (wording pattern, placement, and single-summary style) as the Fixed Size Chunking screen's equivalent "already chunked" indicator, not a separate multi-line breakdown block.
2. **Given** "Entire Corpus" is selected on the Embeddings screen and a batch generate or save is in progress, **When** the user views the progress display, **Then** it matches the Fixed Size Chunking screen's combined progress bar and "Processing document X of N" wording exactly.
3. **Given** a batch action (generate or save) has completed for "Entire Corpus" on the Embeddings screen, **When** the user views the results, **Then** they see one per-document summary list styled identically to the Fixed Size Chunking screen's summary list, showing each document's outcome (count or error) — not two different list variants depending on whether generate or save ran most recently.
4. **Given** a per-document failure in an "Entire Corpus" batch on either screen, **When** the summary renders, **Then** the failed document's row is styled identically on both screens (same error presentation).

---

### Edge Cases

- What happens when a fixed-size chunk boundary falls in the middle of a paragraph or sentence (a common outcome of fixed-size chunking)? The background color changes exactly at that position, inline (Clarifications).
- What happens when chunk overlap (from the existing overlap control) means the same span of text belongs to two chunks at once? That span shows a distinct "overlap" color/pattern, not either chunk's own color (Clarifications).
- What happens to Chunked Preview's markdown-structure rendering when the extracted text has no clear structural cues at all (e.g., a single unbroken block of extracted words)? It still renders as a continuous flow with background-color chunk highlighting, as plain paragraphs, without inventing headings/lists that aren't there.
- What happens in the Sources document list when a document name is a single unbroken long token (e.g., no spaces, like a long hash-based filename)? The wrap behavior must still keep it within its column (breaking the token if necessary) rather than overflowing.
- What happens in Embeddings' "Entire Corpus" summary when some documents in the corpus have no saved chunks at all (so nothing to embed)? The unified per-document summary row for that document should indicate that plainly (e.g., an explanatory message), consistent with how the Fixed Size Chunking screen already reports a document with no extractable content.

## Requirements *(mandatory)*

### Functional Requirements

**Sources document list readability**

- **FR-001**: The Sources document list MUST wrap document names onto multiple lines instead of clipping, truncating, or overflowing them, regardless of name length.
- **FR-002**: Each document row's height MUST expand to fit its (possibly multi-line) content; rows MUST NOT have a fixed height that clips wrapped text.
- **FR-003**: The document list's other columns (size, upload date, status, actions) MUST remain aligned and usable when a row's height grows to fit a wrapped name.

**Chunked Preview — structure-preserving, background-only chunk highlighting**

- **FR-004**: Chunked Preview MUST render a document's saved chunks as one continuous flow of text, not as separate bordered, padded, or gapped blocks.
- **FR-005**: Chunked Preview MUST indicate each chunk's extent using only a background color change at the chunk's boundaries — no additional visual separators (borders, dividers, spacing) between adjacent chunks.
- **FR-006**: Adjacent chunks in the continuous flow MUST use visibly different background colors, and chunk text MUST remain legible (fixed dark text color) against every background color, including the distinct "overlap" color — carrying forward the existing color-assignment legibility guarantee.
- **FR-007**: Chunked Preview's markdown rendering MUST apply a lightweight heuristic to detect structural cues already present in the extracted text (e.g., a short standalone line treated as a heading, a line starting with a bullet/number marker treated as a list item) and render them as such; text without such cues MUST render as plain paragraphs. No analysis of the original PDF's visual layout (fonts, positions, columns) is required.
- **FR-008**: When a chunk boundary falls in the middle of a paragraph or sentence, Chunked Preview MUST change the background color exactly at that boundary position (inline, potentially mid-line or mid-word) rather than coloring the entire paragraph as one unit.
- **FR-009**: When chunk overlap means a span of text belongs to more than one chunk, Chunked Preview MUST render that shared span with a distinct "overlap" background color/pattern, visually different from either contributing chunk's own assigned color.
- **FR-010**: A document with no saved chunks MUST continue to show today's "no chunks yet" message; the toggle between PDF view and Chunked Preview MUST continue to work as today.

**Entire Corpus UI consistency (Chunking vs. Embeddings)**

- **FR-011**: The Embeddings screen's "Entire Corpus" already-existing-data state MUST match the Fixed Size Chunking screen's "already chunked" presentation in full: the single-line indicator (same style, placement, wording pattern) *and* the per-document summary list shown immediately below it (one row per document, with its existing-embeddings count), not just the indicator on its own.
- **FR-012**: The Embeddings screen's "Entire Corpus" in-progress display MUST match the Fixed Size Chunking screen's combined progress bar and "Processing document X of N" presentation.
- **FR-013**: The Embeddings screen's "Entire Corpus" post-action results MUST be presented as one unified per-document summary list, styled identically to the Fixed Size Chunking screen's summary list, regardless of whether the most recent action was generate or save.
- **FR-014**: Per-document failures in an "Entire Corpus" batch MUST be styled identically between the Fixed Size Chunking screen and the Embeddings screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of document names in the Sources list — regardless of length — are fully visible (wrapped, not truncated or overflowing) in manual spot checks across short and long names.
- **SC-002**: Users can read a chunked document as one continuous, naturally-flowing document (no boxes, borders, or gaps interrupting the text) while still visually identifying every chunk boundary by background color alone.
- **SC-003**: Users switching between the Fixed Size Chunking screen and the Embeddings screen with "Entire Corpus" selected see the same presentation pattern for progress, already-existing-data, and per-document results, without needing to learn two different summary styles.
- **SC-004**: Users can explain, from looking at Chunked Preview alone, roughly where one chunk ends and the next begins, without any additional legend or help text.

## Assumptions

- "Preserve the original document structure" means rendering the document's extracted text as a continuous flow, with a lightweight text-cue heuristic (not real PDF layout analysis) reconstructing headings/lists where obvious cues exist — it does not mean pixel-perfect visual replication of the PDF's layout (columns, images, fonts, font sizes), which remains out of scope.
- The underlying saved chunks and their boundaries (index, content, overlap) are unchanged by this feature — only how they're visually presented in Chunked Preview changes.
- The distinct "overlap" color/pattern is a new addition to the existing chunk color-palette concept, reserved specifically for shared/overlapping spans — it is never assigned to a chunk's own (non-shared) text.
- The Sources document list's other UI capabilities (selection checkboxes, delete, export, view-all) are unchanged; only text wrapping and row-height behavior are fixed.
- Aligning Embeddings' "Entire Corpus" UI to Chunking's does not change the underlying data each screen tracks (embeddings vs. chunks) — only the visual presentation pattern for progress, existing-data, and results summaries is unified.
- This feature does not change Fixed Size Chunking's Entire Corpus UI itself — Chunking remains the reference/source-of-truth presentation that Embeddings is brought into alignment with.
