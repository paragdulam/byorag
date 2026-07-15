# Feature Specification: Corpora Management with Persistent Storage

**Feature Branch**: `008-corpora-management`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "Chunking has suboptions, lets show chevron on the chunking text in the left bar. Lets setup a postgresSQL db locally where documents can be stored against a corpus. User can store multiple corpora involving different user's interests. Currently sources has that view against one corpus. Add Corpora as a section above sources. Keep document to corpus many to many relationship, document to chunks should be one to many relationship"

## Clarifications

### Session 2026-07-14

- Q: When a user uploads a file that has identical content to a document already stored (in any corpus), should the system automatically reuse/link the existing document, or always create a separate new document record? → A: Auto-dedupe by content — system detects identical content on upload and links the existing document (and its chunks) to the new corpus instead of creating a duplicate.
- Q: Should the system-created "Uncategorized" corpus (for migrated pre-existing documents) be a protected/permanent corpus, or an ordinary corpus the user can rename/delete like any other? → A: Ordinary corpus — created once as a normal corpus with no special protection; the user can rename it and delete it once empty, same as any other corpus.
- Q: What scale should the corpora/documents view be designed for? → A: Small/personal scale — tens of corpora and up to a few hundred documents per corpus; simple full lists with no pagination or search are sufficient for this local, single-user tool.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage multiple corpora (Priority: P1)

A user organizes their work by topic of interest. Instead of a single implicit collection of documents, they can create named corpora (e.g. "Contract Law Research", "Product Docs Q3"), see all their corpora listed in a dedicated section of the navigation, and switch between them to focus on one topic's documents at a time.

**Why this priority**: This is the foundational capability the rest of the feature depends on. Without the ability to create and select a corpus, there is nothing to scope documents, sources, or chunks to.

**Independent Test**: Can be fully tested by creating two or more corpora, confirming both appear in a "Corpora" section above "Sources" in the navigation, and confirming selecting a corpus changes the active context used elsewhere in the app.

**Acceptance Scenarios**:

1. **Given** no corpora exist yet, **When** the user opens the app, **Then** they see an empty/prompt state in the Corpora section inviting them to create their first corpus.
2. **Given** the user creates a corpus named "Research Notes", **When** creation succeeds, **Then** it appears in the Corpora section and becomes the active corpus.
3. **Given** multiple corpora exist, **When** the user selects a different corpus from the Corpora section, **Then** the Sources view updates to show only documents belonging to the newly selected corpus.
4. **Given** a corpus with a duplicate name is submitted, **When** the user attempts to create it, **Then** the system rejects it with a clear message (corpus names are unique per user).

---

### User Story 2 - Associate documents with one or more corpora (Priority: P2)

A user uploads a document while a corpus is active, and that document becomes associated with that corpus. Because the same source material can be relevant to more than one topic, the user can also attach an already-uploaded document to additional corpora without re-uploading it, and remove a document from a corpus without necessarily deleting the underlying document or its chunks.

**Why this priority**: This delivers the core value of the many-to-many relationship the user explicitly asked for, and depends on User Story 1 (a corpus must exist to associate a document with it).

**Independent Test**: Can be fully tested by uploading a document into Corpus A, attaching the same document to Corpus B, confirming it appears in the Sources view for both corpora, then removing it from Corpus A and confirming it still appears in Corpus B.

**Acceptance Scenarios**:

1. **Given** an active corpus, **When** the user uploads a document, **Then** the document is persisted and associated with that corpus, and appears in that corpus's Sources view.
2. **Given** a document already associated with Corpus A, **When** the user attaches it to Corpus B, **Then** the document appears in Corpus B's Sources view without creating a duplicate copy of the document or its chunks.
3. **Given** a document associated with two corpora, **When** the user removes it from one corpus, **Then** it no longer appears in that corpus's Sources view but remains associated with the other corpus, and its chunks are unaffected.
4. **Given** a document associated with only one corpus, **When** the user removes it from that corpus, **Then** the document and its chunks are deleted entirely (no orphaned documents remain outside of any corpus).

---

### User Story 3 - Persistent storage across restarts (Priority: P2)

A user uploads documents and organizes them into corpora, closes the application, and returns later expecting their corpora, documents, and chunking configuration to still be there.

**Why this priority**: Without durable storage, corpora and document-corpus associations would be lost on every restart, undermining the entire feature. This is technically foundational but is scoped as its own story because it can be validated independently of the UI work.

**Independent Test**: Can be fully tested by creating a corpus, uploading a document, restarting the backend/database process, and confirming the corpus, document, its corpus associations, and any generated chunks are all still present and correctly linked.

**Acceptance Scenarios**:

1. **Given** a corpus and its documents were created in a prior session, **When** the application restarts, **Then** the corpus, its documents, their corpus associations, and their chunks are all available exactly as before.
2. **Given** the database is unreachable at startup, **When** the user opens the app, **Then** the system shows a clear error rather than silently falling back to an empty or inconsistent state.

---

### User Story 4 - Visual indicator for expandable navigation items (Priority: P3)

A user looking at the left navigation sees the "Chunking" item and, without needing to click it, can tell it expands into suboptions because of a chevron indicator that also reflects whether the section is currently expanded or collapsed.

**Why this priority**: This is a small usability polish item, independent of the corpora/storage work, and lowest risk/impact if delayed.

**Independent Test**: Can be fully tested by loading the navigation, visually confirming a chevron appears next to "Chunking", clicking it, and confirming the chevron orientation changes to reflect the expanded state.

**Acceptance Scenarios**:

1. **Given** the left navigation is rendered, **When** the user views the "Chunking" item, **Then** a chevron icon is visible next to the label indicating it has suboptions.
2. **Given** the "Chunking" section is collapsed, **When** the user clicks it to expand, **Then** the chevron orientation updates (e.g. rotates) to indicate the expanded state, and updates back when collapsed again.
3. **Given** other navigation items without suboptions (e.g. "Sources", "Embeddings"), **When** rendered, **Then** no chevron is shown next to them.

---

### Edge Cases

- Deleting a corpus that still has documents associated with it is blocked, per FR-013; the user must unlink or delete those documents first.
- What happens when a user tries to create a corpus with an empty or whitespace-only name?
- What happens when the last remaining corpus is deleted — does the Sources view show an empty state, and can the user still upload documents?
- What happens when a document is mid-upload or mid-chunking and the user switches the active corpus?
- Previously uploaded documents (from before this feature existed, stored as flat files) are auto-migrated into a system-created "Uncategorized" corpus, per FR-015.
- What happens when two browser tabs/sessions modify corpus membership for the same document concurrently?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create a corpus with a unique, non-empty name.
- **FR-002**: System MUST display a "Corpora" section in the left navigation, positioned above the "Sources" section.
- **FR-003**: System MUST allow users to list all of their corpora and select one as the active corpus.
- **FR-004**: The Sources view MUST scope the documents it displays to the currently active corpus.
- **FR-005**: System MUST allow users to upload a document into the active corpus, persisting the document and its association to that corpus. If the uploaded content is identical to a document that already exists (in any corpus), the system MUST link the existing document (and its chunks) to the active corpus instead of creating a duplicate document or re-running chunking.
- **FR-006**: System MUST allow users to associate an existing document with additional corpora beyond the one it was originally uploaded into, without duplicating the document or its chunks.
- **FR-007**: System MUST allow users to remove a document from a corpus (unlink) independently of deleting the document itself, as long as the document remains associated with at least one other corpus.
- **FR-008**: System MUST delete a document and all of its chunks when it is removed from its last remaining associated corpus.
- **FR-009**: System MUST persist corpora, documents, document-corpus associations, and chunks in a local PostgreSQL database so that data survives application restarts.
- **FR-010**: System MUST maintain a many-to-many relationship between documents and corpora (a document can belong to multiple corpora; a corpus can contain multiple documents).
- **FR-011**: System MUST maintain a one-to-many relationship between a document and its chunks (each chunk belongs to exactly one document; a document can have multiple chunks), independent of how many corpora that document belongs to.
- **FR-012**: System MUST display a chevron indicator next to any navigation item that has suboptions (currently "Chunking"), and the chevron orientation MUST reflect whether the item's suboptions are currently expanded or collapsed.
- **FR-013**: System MUST block deletion of a corpus that still has associated documents, informing the user that they must first remove or reassign all documents before the corpus can be deleted.
- **FR-014**: System MUST reject creation of a corpus with a duplicate name for the same user, returning a clear error.
- **FR-015**: System MUST automatically migrate any documents that existed prior to this feature (stored without a corpus association) into a system-created default corpus (e.g. "Uncategorized") when the database is introduced, so no document is lost or hidden. This default corpus is an ordinary corpus with no special protection — the user may rename it or delete it (once empty) like any other corpus.

### Key Entities

- **Corpus**: A named collection representing a user's area of interest. Attributes: unique identifier, name, created timestamp. Relates to Document via a many-to-many association.
- **Document**: A source file uploaded by the user (e.g. a PDF). Attributes: unique identifier, name, content hash (used to detect duplicate uploads and dedupe across corpora), size, upload timestamp, processing status. Relates to Corpus via a many-to-many association; relates to Chunk via a one-to-many relationship (one document has many chunks).
- **Document-Corpus Association**: The join between a document and a corpus, representing "this document belongs to this corpus." A document must belong to at least one corpus to exist; removing its last association deletes the document and its chunks.
- **Chunk**: A segment of a document produced by a chunking strategy (e.g. fixed-size chunking). Attributes: unique identifier, parent document reference, sequence/position, content, size. Belongs to exactly one document, regardless of how many corpora that document is associated with.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new corpus and see it reflected in the navigation in under 5 seconds.
- **SC-002**: Users can switch the active corpus and see the Sources view update to the correct scoped document list in under 2 seconds.
- **SC-003**: 100% of documents, corpora, and their associations persist correctly across an application restart, with zero data loss in normal shutdown conditions.
- **SC-004**: A document can be associated with at least 2 corpora simultaneously and appears correctly in the Sources view of each without duplication of stored content or chunks.
- **SC-005**: Users can visually identify, without clicking, which navigation items have expandable suboptions, verified by the presence of a chevron on 100% of items that have suboptions and its absence on items that do not.
- **SC-006**: Deleting a document from its last associated corpus removes 100% of its chunks with no orphaned chunk records remaining.

## Assumptions

- "User" in this iteration refers to a single local user of the application; multi-tenant user accounts and authentication are out of scope for this feature.
- PostgreSQL runs locally (e.g. via a local service or container) for development; production deployment topology is not addressed by this feature.
- The existing single-corpus behavior (Sources view scoped to one implicit collection) is replaced by explicit corpus selection; there is always exactly one "active" corpus once at least one exists.
- Chunking continues to operate per-document (as already implemented) and is unaffected by how many corpora a document belongs to — chunks are not duplicated per corpus.
- The chevron indicator is a visual-only change to the existing expandable navigation behavior already present for "Chunking"; no new navigation items or restructuring of the expand/collapse interaction itself is required.
- Corpus names are unique per user but documents may share the same file name across different corpora (no cross-corpus name collision restriction on documents).
- The system is designed for small/personal scale: tens of corpora and up to a few hundred documents per corpus. Simple full lists (no pagination or search) are sufficient for the Corpora and Sources views at this scale.
