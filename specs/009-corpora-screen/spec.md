# Feature Specification: Dedicated Corpora Screen with App-Wide Scoping

**Feature Branch**: `009-corpora-screen`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Let corpora be an option above Sources. Corpora should have its own screen with crud operations on corpora. Add Corpora, Listing Corpora, Add/remove docs and delete corpora. There should be an option to select a corpora and all the options below it can get updated. From Sources to Logs, all of them."

## Clarifications

### Session 2026-07-14

- Q: Should the left navigation keep a quick corpus-switcher (a compact list you can click to change the active corpus from any screen), in addition to the new dedicated Corpora screen — or should all corpus interaction, including switching the active one, move entirely onto that screen? → A: Keep the quick-switcher in the sidebar — a compact, always-visible list of corpora remains for one-click switching from anywhere, while the new Corpora screen adds the deeper CRUD (document management and deletion).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage corpora from a dedicated screen (Priority: P1)

A user clicks "Corpora" in the left navigation — positioned above "Sources," alongside the other top-level sections — and lands on a dedicated Corpora screen. There they see every corpus they've created, can create a new one, and can pick any corpus to become the active one for the rest of the app.

**Why this priority**: This is the foundational surface the rest of the feature depends on. Without a real screen to land on, there is nowhere to perform the other corpus-management actions or make a deliberate active-corpus choice.

**Independent Test**: Can be fully tested by clicking "Corpora" in the nav, confirming a dedicated screen appears (not just an inline list), creating a corpus there, and selecting it as active.

**Acceptance Scenarios**:

1. **Given** the left navigation, **When** the user clicks "Corpora," **Then** they are taken to a dedicated Corpora screen (the same way clicking "Sources" takes them to the Sources screen).
2. **Given** the Corpora screen with no corpora yet, **When** it loads, **Then** an empty/prompt state invites the user to create their first corpus.
3. **Given** the Corpora screen, **When** the user creates a corpus named "Research Notes," **Then** it appears in the list on that screen.
4. **Given** two or more corpora listed on the screen, **When** the user selects one as active, **Then** that corpus is clearly marked as the active one on the screen.

---

### User Story 2 - Selecting a corpus updates every other section (Priority: P1)

A user picks a different active corpus. Every other section of the app that currently has real, corpus-specific content — Sources and Chunking today — immediately reflects that choice, so the user is always working within one consistent context as they move between sections. Sections without functional content yet (Embeddings, Vector View, Playground, Logs) are prepared to consume the same active-corpus context once they are built out.

**Why this priority**: The entire point of introducing corpora is to let a user focus on one topic's data at a time. If switching the active corpus doesn't consistently affect every section, the feature doesn't deliver its core value and different sections could show contradictory data.

**Independent Test**: Can be fully tested by switching the active corpus and confirming every section that currently shows corpus-specific content (Sources, Chunking) immediately reflects the newly selected corpus, without a page reload.

**Acceptance Scenarios**:

1. **Given** two corpora each with their own documents, **When** the user switches the active corpus, **Then** the Sources section immediately shows only the newly active corpus's documents.
2. **Given** the active corpus has been switched, **When** the user opens the Chunking section, **Then** it offers only documents belonging to the newly active corpus.
3. **Given** the user is in the middle of any section, **When** they switch the active corpus, **Then** the change takes effect without requiring a full page reload.

---

### User Story 3 - Manage a corpus's documents from the Corpora screen (Priority: P2)

While on the Corpora screen, a user looks at a specific corpus and adds an existing document to it or removes a document from it, without needing to go to the Sources screen to do so.

**Why this priority**: This completes the "CRUD on corpora" ask by making document membership manageable in the same place corpora themselves are managed, but it's a refinement on top of User Story 1 rather than something blocking it.

**Independent Test**: Can be fully tested by selecting a corpus on the Corpora screen, viewing its associated documents, adding an existing document to it, and removing a document from it — all without leaving the screen.

**Acceptance Scenarios**:

1. **Given** a corpus is selected on the Corpora screen, **When** the user views it, **Then** they see the list of documents currently associated with that corpus.
2. **Given** a document exists in another corpus, **When** the user adds it to the selected corpus from this screen, **Then** it appears in the selected corpus's document list without being re-uploaded.
3. **Given** a document is associated with the selected corpus, **When** the user removes it from this screen, **Then** it no longer appears in that corpus's document list (and is fully deleted if this was its last remaining corpus, consistent with existing behavior).

---

### User Story 4 - Delete a corpus from the Corpora screen (Priority: P3)

A user no longer needs a corpus and deletes it directly from the Corpora screen.

**Why this priority**: Deletion is a natural completion of full CRUD but is the lowest-risk/lowest-frequency action of the set, and depends on the screen (User Story 1) already existing.

**Independent Test**: Can be fully tested by creating an empty corpus on the Corpora screen and deleting it directly from that screen.

**Acceptance Scenarios**:

1. **Given** a corpus with no associated documents, **When** the user deletes it from the Corpora screen, **Then** it no longer appears in the list.
2. **Given** a corpus that still has associated documents, **When** the user attempts to delete it, **Then** the deletion is blocked with a clear message explaining that documents must be removed or reassigned first.
3. **Given** the user deletes the currently active corpus (once it is empty), **When** the deletion completes, **Then** the app selects a different remaining corpus as active, or shows a clear "no corpus selected" state if none remain.

---

### Edge Cases

- What happens when the user deletes every corpus? All corpus-scoped sections (Sources, Chunking, Embeddings) show a clear "no corpus selected" / "create a corpus to get started" state rather than stale data from the last-active corpus.
- What happens when the user tries to add a document to a corpus it's already associated with? The action succeeds without creating a duplicate association (no error, no duplicate entry).
- What happens when the user is actively viewing the Corpora screen and switches the active corpus mid-session — does the screen's own "active" marker update immediately? Yes, consistent with User Story 2's app-wide guarantee.
- Embeddings, Vector View, Playground, and Logs are currently non-functional placeholders with no content of their own — see Assumptions for how this feature treats them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present "Corpora" as its own clickable navigation option, positioned above "Sources," that takes the user to a dedicated Corpora screen for the full set of corpus-management actions (create, list, document management, delete).
- **FR-001a**: The left navigation MUST continue to offer a compact, always-visible corpus list that lets users switch the active corpus in one click from any screen, independent of whether they are on the Corpora screen.
- **FR-002**: The Corpora screen MUST allow users to create a new corpus with a name.
- **FR-003**: The Corpora screen MUST list all of the user's corpora.
- **FR-004**: The Corpora screen MUST allow users to select any listed corpus as the active corpus, and MUST clearly indicate which corpus is currently active.
- **FR-005**: The Corpora screen MUST allow users to view the documents currently associated with a given corpus.
- **FR-006**: The Corpora screen MUST allow users to add an existing document (one already uploaded via any corpus) to a corpus without re-uploading it.
- **FR-007**: The Corpora screen MUST allow users to remove a document from a corpus; if this was the document's last remaining corpus, the document is deleted entirely (consistent with existing document-corpus lifecycle rules).
- **FR-008**: The Corpora screen MUST allow users to delete a corpus, blocked while that corpus still has any associated documents, with a clear message explaining why.
- **FR-009**: System MUST scope the Sources and Chunking sections (the sections with real, corpus-specific content today) to whichever corpus is currently active, and MUST update them immediately (no page reload) whenever the active corpus changes.
- **FR-010**: System MUST make the currently active corpus a single, consistent, app-wide selection — there is never a state where two sections disagree about which corpus is active.
- **FR-011**: When the active corpus is deleted, System MUST automatically select another remaining corpus as active, or MUST clearly indicate that no corpus is selected if none remain.
- **FR-012**: System MUST reject creating a corpus with an empty, whitespace-only, or duplicate name, consistent with existing corpus-creation rules.

### Key Entities

- **Corpus**: A named collection representing a user's area of interest (already established). This feature adds a dedicated management surface for it; no new attributes are introduced.
- **Document**: A source file associated with one or more corpora (already established). This feature surfaces its corpus associations for management directly from the Corpora screen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can navigate to a fully functional Corpora screen and create their first corpus in under 15 seconds.
- **SC-002**: Switching the active corpus is reflected in every corpus-scoped section (Sources, Chunking) within 2 seconds, with no page reload.
- **SC-003**: Users can add an existing document to a corpus or remove it from a corpus in 2 clicks or fewer from the Corpora screen.
- **SC-004**: 100% of attempts to delete a non-empty corpus are blocked with a clear explanation; 100% of attempts to delete an empty corpus succeed.
- **SC-005**: After deleting the active corpus, 100% of sessions land on a valid state — either a different active corpus or a clear "no corpus selected" indicator — with no section showing stale or contradictory data.

## Assumptions

- Corpus and document-association data, along with their lifecycle rules (dedup-on-upload, delete-on-last-unlink, block-delete-while-non-empty, unique corpus names), already exist and are reused as-is; this feature is about surfacing and centralizing their management in a dedicated screen and guaranteeing consistent scoping, not changing those underlying rules.
- "Add a document" from the Corpora screen means associating an already-uploaded document with the selected corpus (the many-to-many relationship), not a duplicate file-upload flow; uploading brand-new files continues to happen via the Sources screen.
- The existing per-document "attach to another corpus" / "remove from this corpus" controls already available on the Sources screen may continue to coexist with the new Corpora screen's document management; this feature does not require removing them.
- Embeddings, Vector View, Playground, and Logs currently have no functional content (Embeddings shows a "coming soon" message; the other three are placeholder links). This feature does not add functionality to them; it ensures the active-corpus selection is available app-wide so that whenever those sections do gain real content, they can consume the same active-corpus context that Sources and Chunking already use, without a separate mechanism being invented later.
- A single active corpus applies app-wide for the current single-user scope; there is no per-section corpus override.
