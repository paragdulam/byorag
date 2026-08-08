# Feature Specification: UI/UX Polish Across Corpora, Sources, Chunking, Embeddings, Vector View, and Playground

**Feature Branch**: `033-ui-ux-polish`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "UI/UX Updates — 1. Corpora Screen: emoji delete-per-document with confirmation modal, remove the Remove Document section (documents can now be deleted, not just unlinked), document names become hyperlinks deep-linking to Sources. 2. Sources Screen: remove the Upload PDF Documents card, add an Upload button top-right aligned with the Data Sources title, document list uses the full left pane, font sizes reduced to match Corpora screen. 3. Fixed Size Chunking: font sizes reduced to match Corpora, per-chunk Copy Link button (top-right) linking to that chunk. 4. Embeddings: font sizes reduced to match Corpora. 5. Vector View: font sizes reduced to match Corpora. 6. Playground: font sizes reduced to match Corpora; turns get an Actions button (unicode icon, top-right) replacing the standalone Copy Link button, opening a popover with Copy Link and Query Embedding options; chunks and answer merge together; answer segments that draw on a specific chunk get an info icon opening a modal with that chunk's content, cosine similarity, a 'Go To Chunk' deep link, and a close control; the Query Embedding option reveals both the query embedding and a new Retrieved Chunks group (each chunk's cosine similarity value shown); the popover dismisses on outside click."

## Clarifications

### Session 2026-08-08

- Q: Corpora screen's per-document delete — documents can currently belong to more than one corpus (attach/detach). Should deleting remove the document everywhere, or only from corpora where it's the sole owner? → A: The corpus↔document relationship itself changes from many-to-many to one-to-many — every document belongs to exactly one corpus going forward. Deleting a document therefore always removes it from the system entirely; there is no "still needed by another corpus" case anymore. The same source PDF can still exist in two different corpora, but only as two independently-uploaded, independently-owned document records, not a shared reference.
- Q: How does the app decide which chunk(s) a given part of a Playground answer's info icon should point to, given answers are free-form LLM text with no existing citation markers? → A: The answer-generation step itself is changed so its output includes inline citation markers tied to specific retrieved chunks (e.g., per sentence/claim), and each marker becomes a clickable info icon in the rendered answer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Delete a document directly from the Corpora screen (Priority: P1)

As a user managing a corpus, I want to delete one of its documents right from the Corpora screen — with a clear confirmation first — instead of only being able to "remove" it (which today just detaches it while leaving it to still exist elsewhere). I also want to click a document's name to jump straight to it on the Sources screen, instead of navigating there manually and finding it in a list.

**Why this priority**: This is the first item requested and the one with real data consequences (actual deletion, not just unlinking) — it also requires a foundational change to how documents relate to corpora, which the rest of the corpus/document experience depends on.

**Independent Test**: On the Corpora screen, open a corpus with at least one document, click the delete affordance next to a document, confirm in the modal, and verify the document is gone from every corpus/screen that referenced it. Separately, click a document's name and verify it opens directly on the Sources screen with that document's preview showing.

**Acceptance Scenarios**:

1. **Given** a corpus with a document listed, **When** the user clicks the delete icon next to that document's name, **Then** a confirmation modal appears describing that this permanently deletes the document.
2. **Given** the confirmation modal is open, **When** the user confirms, **Then** the document and everything derived from it (chunks, embeddings, and its membership in this corpus) is removed, and it disappears from the list without a page reload.
3. **Given** the confirmation modal is open, **When** the user cancels or dismisses it, **Then** the document is untouched and remains listed.
4. **Given** a corpus with a document listed, **When** the user clicks the document's name (not the delete icon), **Then** the app navigates to the Sources screen with that exact document already open in the preview.
5. **Given** the Corpora screen's document panel, **When** the user views it, **Then** there is no separate "remove from corpus" control or "attach an existing document to this corpus" control — every document shown belongs to this corpus alone, and deleting is the only removal action available.

---

### User Story 2 - Simplified Sources screen layout (Priority: P2)

As a user on the Sources screen, I want the document list to use the full width of the left side of the screen, with a simple Upload button up near the page title instead of a large upload card taking up space above the list.

**Why this priority**: A layout simplification that makes the most common action (browsing/managing documents) easier without needing any data-model change — safe, independent, and quick to deliver.

**Independent Test**: Open the Sources screen for a corpus with documents and confirm the document list starts right at the top of the left pane (no upload card above it), with an "Upload" button visible in the top area aligned with the "Data Sources" title; clicking it still lets the user add PDFs.

**Acceptance Scenarios**:

1. **Given** the Sources screen for a corpus, **When** it loads, **Then** the "Data Sources" title and an "Upload" button appear on the same top row, with the button on the right.
2. **Given** the Sources screen, **When** the user views the left pane, **Then** it shows only the document list (no upload card/dropzone box) and the list occupies the full height and width available to that pane.
3. **Given** the Upload button, **When** the user clicks it, **Then** they can select and upload one or more PDF files exactly as they could before, with the same size/type validation and rejection messaging.
4. **Given** the Sources screen, **When** compared to the Corpora screen, **Then** heading, body, and secondary text sizes visually match the Corpora screen's scale.

---

### User Story 3 - Copyable chunk links on Fixed Size Chunking (Priority: P3)

As a user reviewing chunks on the Fixed Size Chunking screen, I want a "Copy Link" control on each chunk so I can share a direct link to that exact chunk with a teammate, and I want the screen's text sized consistently with the Corpora screen.

**Why this priority**: Reuses the chunk deep-linking capability already built for this screen; this is just exposing it as a visible, one-click action per chunk, plus a cosmetic typography pass.

**Independent Test**: Open Fixed Size Chunking for a document with computed/saved chunks, click "Copy Link" on a specific chunk, and verify the copied link opens directly on that chunk when visited.

**Acceptance Scenarios**:

1. **Given** a chunk shown in the list, **When** the user views it, **Then** a "Copy Link" control appears in the top-right corner of that chunk's row.
2. **Given** a chunk's "Copy Link" control, **When** clicked, **Then** a shareable link to that specific chunk is copied, without changing which chunk is currently selected.
3. **Given** the Fixed Size Chunking screen, **When** compared to the Corpora screen, **Then** heading, body, and secondary text sizes visually match the Corpora screen's scale.

---

### User Story 4 - Typography parity on the Embeddings screen (Priority: P4)

As a user, I want the Embeddings screen's text sizes to match the Corpora screen so the app feels visually consistent as I move between screens.

**Why this priority**: Pure cosmetic consistency pass with no behavior change; low risk, low effort, independently shippable.

**Independent Test**: Open the Embeddings screen and the Corpora screen side by side (or in sequence) and confirm headings, section titles, and body/list text use the same size scale.

**Acceptance Scenarios**:

1. **Given** the Embeddings screen, **When** compared to the Corpora screen, **Then** heading, body, and secondary text sizes visually match the Corpora screen's scale, with no functional behavior changed.

---

### User Story 5 - Typography parity on the Vector View screen (Priority: P5)

As a user, I want the Vector View screen's text sizes to match the Corpora screen for the same reason as Embeddings.

**Why this priority**: Same rationale as User Story 4 — cosmetic-only, independent, low risk.

**Independent Test**: Open Vector View and confirm its text sizing matches the Corpora screen's scale.

**Acceptance Scenarios**:

1. **Given** the Vector View screen, **When** compared to the Corpora screen, **Then** heading, body, and secondary text sizes visually match the Corpora screen's scale, with no functional behavior changed.

---

### User Story 6 - Richer, traceable Playground answers (Priority: P6)

As a user asking questions in the Playground, I want each answer to clearly show which retrieved evidence backs each part of it, be able to jump from a cited piece of evidence straight to its source chunk, and be able to see the full retrieval detail (query embedding and every retrieved chunk's similarity score) when I want it — without it cluttering the screen by default. I also want one compact "Actions" control per turn instead of a lone "Copy Link" button, and I want the screen's text sized consistently with the Corpora screen.

**Why this priority**: The most valuable but also most involved change — it depends on the answer-generation step itself producing citation information, not just a UI rearrangement, so it's sequenced last.

**Independent Test**: Ask a question in the Playground, receive an answer, click an in-answer citation marker and confirm a modal opens showing the specific supporting chunk with its similarity score and a working "Go To Chunk" link; separately, open the turn's Actions control, choose "Query Embedding," and confirm both the query embedding and a full list of retrieved chunks (each with its similarity score) appear; click outside the open Actions popover and confirm it closes.

**Acceptance Scenarios**:

1. **Given** a turn with a generated answer, **When** the user views the top-right of that turn, **Then** they see a single icon-based "Actions" control instead of a standalone "Copy Link" button.
2. **Given** the Actions control, **When** clicked, **Then** a popover opens listing at least "Copy Link" and "Query Embedding" as options.
3. **Given** the Actions popover is open, **When** the user clicks anywhere outside it, **Then** it closes without taking any other action.
4. **Given** the Actions popover, **When** the user chooses "Copy Link," **Then** the same shareable turn link that the old standalone button produced is copied.
5. **Given** the Actions popover, **When** the user chooses "Query Embedding," **Then** the turn expands to show both the query embedding values and a new "Retrieved Chunks" list, with each chunk's cosine similarity value displayed; neither is shown before this is chosen.
6. **Given** a turn's generated answer, **When** the user views it, **Then** the answer and the evidence behind it read as one connected block rather than two separate, always-visible sections stacked on top of each other.
7. **Given** a portion of an answer that was informed by a specific retrieved chunk, **When** the user views that portion, **Then** an info icon appears there.
8. **Given** an info icon in the answer, **When** clicked, **Then** a modal opens showing that chunk's content and its cosine similarity score.
9. **Given** the open chunk modal, **When** the user clicks "Go To Chunk," **Then** they're taken to that exact chunk on the Fixed Size Chunking screen.
10. **Given** the open chunk modal, **When** the user clicks the close control, **Then** the modal closes and the Playground turn is unchanged.
11. **Given** the Playground screen, **When** compared to the Corpora screen, **Then** heading, body, and secondary text sizes visually match the Corpora screen's scale.

---

### Edge Cases

- What happens when a user deletes a document from the Corpora screen that has golden dataset entries, saved chunks, embeddings, or Playground history depending on it? All of that dependent data is removed along with the document — there is no partial/orphaned state left behind.
- What happens when a user opens a Fixed Size Chunking chunk link for a chunk that hasn't been computed or saved for that document yet? The screen selects the right document but shows no matching chunk highlighted, the same as visiting the screen with any other not-yet-computed selection today.
- What happens when a user opens a Playground chunk-citation modal for a chunk whose source document has since been deleted? The modal shows a clear "no longer available" message instead of the chunk content, and "Go To Chunk" is not offered.
- What happens when the LLM's answer doesn't clearly cite any particular chunk for some of its text? That text is shown with no info icon — info icons only appear where a citation exists, they are never guessed or forced.
- What happens when a user clicks "Copy Link" from within the Actions popover? The popover closes after the link is copied, same as choosing any other action from it.
- What happens when a user reopens the Actions popover on a turn where "Query Embedding" was already chosen once? The query embedding and retrieved-chunks groups remain visible as already expanded; the option doesn't need to be re-chosen every time the popover reopens.

## Requirements *(mandatory)*

### Functional Requirements

**Corpora screen (US1)**

- **FR-001**: The corpus↔document relationship MUST change from many-to-many to one-to-many: every document belongs to exactly one corpus. Existing functionality for attaching an already-uploaded document to a second corpus MUST be removed from every screen that offers it.
- **FR-002**: On the Corpora screen, each document listed under its corpus MUST show a clickable delete icon immediately after its name.
- **FR-003**: Clicking a document's delete icon MUST open a confirmation modal before anything is deleted; deletion MUST NOT happen without explicit confirmation in that modal.
- **FR-004**: Confirming deletion MUST permanently remove the document and everything derived from it (its file content, chunks, and embeddings) from the system, not just detach it from the current corpus.
- **FR-005**: The Corpora screen's existing "remove document from this corpus" control and "attach an existing document to this corpus" control MUST be removed, since every document now belongs to exactly one corpus.
- **FR-006**: Each document's name on the Corpora screen MUST be a link that navigates to the Sources screen with that exact document already open for preview.

**Sources screen (US2)**

- **FR-007**: The Sources screen MUST NOT show a large upload card/dropzone as a standalone element; uploading MUST be reachable via a single "Upload" button.
- **FR-008**: The "Upload" button MUST appear in the top area of the screen, on the same row as and visually aligned with the "Data Sources" title.
- **FR-009**: The document list MUST occupy the entirety of the left side of the screen (no longer sharing that space with an upload card).
- **FR-010**: Uploading via the new Upload button MUST support the same file types, size limits, and rejection messaging as today's upload flow.

**Fixed Size Chunking screen (US3)**

- **FR-011**: Each chunk shown on the Fixed Size Chunking screen MUST have a "Copy Link" control in the top-right corner of its row.
- **FR-012**: Using a chunk's "Copy Link" control MUST copy a shareable link to that specific chunk without changing the current selection or triggering navigation.

**Typography consistency (US2-US6)**

- **FR-013**: The Sources, Fixed Size Chunking, Embeddings, Vector View, and Playground screens MUST use the same heading, section-title, and body/list text size scale as the Corpora screen, adjusting any text that is currently larger than its Corpora-screen equivalent.

**Playground screen (US6)**

- **FR-014**: Each Playground turn MUST show a single icon-based "Actions" control in place of today's standalone "Copy Link" button.
- **FR-015**: The Actions control MUST open a popover offering, at minimum, a "Copy Link" option and a "Query Embedding" option.
- **FR-016**: The Actions popover MUST close when the user clicks anywhere outside it, without performing any action.
- **FR-017**: Choosing "Copy Link" from the Actions popover MUST copy the same shareable link to that turn that the previous standalone button produced.
- **FR-018**: Choosing "Query Embedding" from the Actions popover MUST reveal both the turn's query embedding values and a "Retrieved Chunks" list; neither MUST be visible before this option is chosen for that turn.
- **FR-019**: The Retrieved Chunks list MUST show, for each retrieved chunk, its cosine similarity score alongside its content.
- **FR-020**: Answer generation MUST produce, alongside the answer text, markers tying specific parts of the answer to the specific retrieved chunk(s) that informed them.
- **FR-021**: The rendered answer MUST show an info icon at each such marker; text with no citation marker MUST NOT show an info icon.
- **FR-022**: Clicking an answer's info icon MUST open a modal showing that cited chunk's content and its cosine similarity score.
- **FR-023**: The chunk modal MUST offer a "Go To Chunk" link that navigates to that exact chunk on the Fixed Size Chunking screen, and a separate control that closes the modal without navigating.
- **FR-024**: The retrieved-chunks list and the generated answer MUST be presented as one connected turn experience rather than two separate, always-visible, disconnected sections.

### Key Entities *(include if feature involves data)*

- **Document**: A single uploaded PDF and everything derived from it (extracted text, chunks, embeddings). Now belongs to exactly one Corpus (previously could belong to several).
- **Corpus**: An isolated collection of Documents. Its document list no longer supports attaching documents owned by another corpus.
- **Chunk (Fixed Size Chunking)**: A positional segment of a document's current chunking run; gains a shareable link scoped to its document and position.
- **Retrieved Chunk (Playground)**: A chunk returned for a specific turn's question, already carrying a cosine similarity score; now also visibly displayed with that score.
- **Answer Citation**: A new association between a segment of a generated answer and the specific retrieved chunk(s) that informed it, produced at generation time and rendered as an info icon.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can delete a document from the Corpora screen, with confirmation, in 2 clicks (delete icon, confirm).
- **SC-002**: 100% of documents deleted from the Corpora screen are fully removed from every corpus, screen, and derived dataset that referenced them — no orphaned references remain.
- **SC-003**: Clicking a document's name from the Corpora screen lands the user on that exact document's preview on the Sources screen in a single action.
- **SC-004**: On first load, the Sources screen's document list is immediately visible using the full left-side pane, with no upload card displacing it.
- **SC-005**: Across Corpora, Sources, Fixed Size Chunking, Embeddings, Vector View, and Playground, no screen's heading, section-title, or body/list text is visibly larger than the Corpora screen's equivalent.
- **SC-006**: Users can copy a link to a specific chunk on the Fixed Size Chunking screen in a single click.
- **SC-007**: For at least 90% of generated answers that draw on retrieved evidence, every cited part of the answer has a visible info icon leading to its source chunk within 2 clicks.
- **SC-008**: From an open chunk citation modal, users reach that exact chunk on the Fixed Size Chunking screen in a single click via "Go To Chunk."
- **SC-009**: A turn's full retrieval detail (query embedding and every retrieved chunk with its similarity score) is available within 2 clicks (Actions, then Query Embedding) but never shown before the user asks for it.

## Assumptions

- Corpus/document relationship: moving from many-to-many to one-to-many is a real data-model change, not just a UI change — existing documents currently attached to more than one corpus will need a one-time resolution (e.g., treated as belonging to whichever corpus is designated primary, or duplicated) when this ships; the exact migration approach is a planning-phase decision, not a product-behavior question.
- Deleting a document cascades to everything derived solely from it (chunks, embeddings) and its Golden Dataset entries and Playground history that depended on it, consistent with how document deletion already behaves elsewhere in the app today.
- The confirmation modal for document deletion is a real in-app modal dialog (not a native browser confirmation prompt), matching the explicit "confirmation modal" wording in the request.
- The delete icon's exact glyph is left to visual design (a recognizable delete/trash-style symbol); the spec only requires it to be icon-based (unicode/emoji) and positioned immediately after the document's name.
- The Actions control's exact glyph is likewise left to visual design (a recognizable "more actions" symbol).
- Answer citation markers are produced per meaningful answer segment (e.g., sentence or claim) rather than per word; the precise granularity is a planning-phase decision as long as every citation is traceable to specific chunk(s) and no citation is fabricated.
- "Query Embedding" in the Actions popover acts as a per-turn expand toggle: once chosen, the query embedding and Retrieved Chunks groups stay visible for that turn (collapsing them again is not in scope here).
- Existing keyboard/focus-management conventions used elsewhere in the app (e.g., closing on outside click) apply to the new Actions popover and chunk modal; no new interaction pattern beyond what's explicitly requested is introduced.
