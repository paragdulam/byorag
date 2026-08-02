# Feature Specification: Golden Dataset Creation (Manual & LLM-Generated)

**Feature Branch**: `027-golden-dataset`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Add a Golden Dataset capability to byorag, scoped per corpus (and optionally per document), so a user can build a reference set of question + supporting-evidence-chunks + preferred-answer entries used later to evaluate the RAG pipeline (reference-answer scoring and/or future fine-tuning export — exact downstream use intentionally left open/flexible for now). Two ways to create entries, sharing one review/edit UI: (1) Manual (subject-matter-expert) creation — question and preferred answer in the SME's own words (optionally starting from an LLM draft grounded in selected chunks), with mandatory evidence-chunk selection via merged question-search + answer-search candidates (Reciprocal Rank Fusion, labeled by which search(es) matched, 'matched both' pre-checked), saved as approved immediately. (2) LLM-generated creation — given a document/corpus scope, an LLM proposes question + chunks + draft answer, singly or in a batch, always landing in pending-review and requiring explicit human approval via the same shared editor before being usable. Evidence chunks are stored as content snapshots, not index/ID references, so entries survive re-chunking. Out of scope for this version: wiring into Metrics scoring, fine-tuning export, non-cosine similarity."

## Clarifications

### Session 2026-08-01

- Q: Is rejecting a pending (LLM-generated) entry final, or can a rejected entry be reopened and reconsidered later? → A: Reopenable — a rejected entry can be opened in the same shared editor at any time and moved back to pending review or approved directly, same as reviewing a fresh pending entry.
- Q: When a generation request fails or a batch partially fails (e.g. an LLM call errors, or a document has too little content), what should happen? → A: Partial success — single-entry generation shows an error with nothing saved; a batch keeps whichever entries succeeded and reports the ones that failed (e.g. "7 of 10 generated") rather than discarding successful work.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manually build a golden dataset entry (Priority: P1)

A subject-matter expert (SME) wants to record a trustworthy question-and-answer reference for a document or corpus they know well, so it can later be used to check whether the RAG pipeline retrieves and answers correctly. They write a question, get a shortlist of likely supporting passages that the system found by searching for both the question and (once written) their own answer, pick the ones that actually support their answer, and save it as a ready-to-use reference.

**Why this priority**: This is the foundational capability — without it, there is no golden dataset at all, and nothing for the LLM-assisted path to share an editor with.

**Independent Test**: Can be fully tested by opening a corpus/document, writing a question and an answer by hand, selecting evidence from the suggested candidates, and saving — producing one immediately usable entry, with no LLM-generation feature involved at all.

**Acceptance Scenarios**:

1. **Given** a corpus with processed, chunked documents, **When** the SME starts a new manual entry, writes a question, and writes a preferred answer, **Then** the system shows a single, deduplicated list of candidate evidence chunks found by searching separately for the question text and the answer text.
2. **Given** the candidate list is shown, **When** the SME looks at it, **Then** each candidate indicates whether it matched the question search, the answer search, or both, and any chunk that matched both is already selected by default.
3. **Given** the SME wants a different or additional passage than what was suggested, **When** they search or browse chunks directly, **Then** they can add any chunk to the selected evidence regardless of whether it appeared in the suggested candidates.
4. **Given** the SME has selected at least one evidence chunk, **When** they save the entry, **Then** it is stored immediately as a usable ("approved") golden dataset entry with no additional review step.
5. **Given** the SME has written a question and selected some evidence chunks but has not yet written an answer, **When** they request a drafted answer, **Then** the system produces an answer grounded only in the currently selected chunks, which the SME can freely edit or rewrite before saving.
6. **Given** no evidence chunks are selected, **When** the SME attempts to save, **Then** the system blocks saving and explains that at least one evidence chunk is required.

---

### User Story 2 - Generate and review a single entry with an LLM (Priority: P2)

A user wants to build up the golden dataset faster than writing every entry by hand. They point the system at a document (or the whole corpus) and ask it to propose a question, supporting evidence, and a draft answer. Nothing becomes part of the usable dataset until the user has looked it over and approved it.

**Why this priority**: Meaningfully speeds up dataset creation once the manual path (and its shared editor) exists, but the product is already useful without it.

**Independent Test**: Can be fully tested by requesting one generated entry from a document, seeing it appear in a pending-review list, opening it, and approving or rejecting it — independent of whether batch generation exists.

**Acceptance Scenarios**:

1. **Given** a document with processed chunks, **When** the user requests a generated entry for it, **Then** the system produces a proposed question, a set of supporting evidence chunks drawn from that document's real content, and a draft answer, and places it in a pending-review state.
2. **Given** a pending entry, **When** the user opens it, **Then** they see the same editor used for manual creation — the question, evidence-chunk selection, and answer are all editable — pre-filled with the generated content.
3. **Given** a pending entry the user is satisfied with (as-is or after edits), **When** they approve it, **Then** it becomes a usable golden dataset entry, indistinguishable in status from a manually created one except for its recorded source.
4. **Given** a pending entry the user does not want, **When** they reject it, **Then** it is excluded from the usable golden dataset and clearly marked as rejected.
5. **Given** a pending entry, **When** the user has not yet approved or rejected it, **Then** it never appears anywhere the usable golden dataset would be consumed (e.g., counts, future evaluation use).

---

### User Story 3 - Generate a batch of entries at once (Priority: P3)

A user wants to seed a substantial golden dataset quickly rather than requesting entries one at a time. They ask the system to generate several candidate entries from a document or corpus in one go, see progress while it works, and then work through the resulting review queue.

**Why this priority**: A meaningful efficiency multiplier on top of User Story 2, but not required for the feature to deliver value — single-entry generation and manual creation are both usable without it.

**Independent Test**: Can be fully tested by requesting a batch of several entries from a document, observing progress until it completes, and confirming that each resulting entry appears individually in the pending-review list, ready for the same one-by-one review as User Story 2.

**Acceptance Scenarios**:

1. **Given** a document or corpus with enough content, **When** the user requests a batch of several entries, **Then** the system shows visible progress while generating them.
2. **Given** a batch generation is running, **When** it completes, **Then** every generated entry appears in the pending-review list as its own independent entry, each reviewable and approvable/rejectable on its own.
3. **Given** a batch generation is in progress, **When** the user navigates away and returns, **Then** they can still see how the batch is progressing or its completed results.
4. **Given** a batch generation where some requested entries fail (e.g., a generation call errors, or the content doesn't support every requested entry), **When** the batch finishes, **Then** the entries that succeeded still appear in the pending-review list, and the user is told which/how many failed rather than the whole batch being discarded.

---

### Edge Cases

- What happens when the question/answer searches find very few or no strong candidate chunks (e.g., a small or sparsely-related document)? The SME can still find and add evidence manually via search/browse; saving remains blocked only by "zero chunks selected," not by "few suggestions."
- What happens when a document referenced by existing golden dataset entries is later re-chunked with different settings? Existing entries keep their evidence exactly as originally captured (their own snapshot of the text), so they remain valid reference records even though that exact text may no longer align with a chunk boundary in the newly re-chunked document.
- What happens when a document that has associated golden dataset entries is deleted? Its golden dataset entries are removed along with it, since their evidence is inherently tied to that document's content.
- What happens when a user tries to approve a pending entry after editing it down to zero selected chunks? Approval is blocked the same way manual saving is — at least one evidence chunk is always required for any entry that becomes usable.
- What happens when the question-search and answer-search candidate sets barely overlap (e.g., the SME's answer paraphrases heavily)? Both sets still surface in the merged, labeled candidate list — the SME isn't limited to only "matched both" chunks, those are just the default selection.
- What happens when a batch generation request is made against a document with too little content to produce the requested number of distinct entries, or when some items in a batch fail (e.g., a generation call errors)? The batch keeps whatever entries succeeded and reports which requested entries failed or were skipped, rather than discarding successful work or fabricating low-quality entries to hit an exact count.
- What happens when a single-entry generation request fails outright (e.g., a generation call errors)? The system shows an error and does not save any entry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to create a golden dataset entry manually by providing a question and a preferred answer, scoped to a corpus or to a specific document within a corpus.
- **FR-002**: The system MUST require at least one evidence chunk to be selected before any entry — manual or LLM-generated — can be saved as usable/approved.
- **FR-003**: When creating or drafting a manual entry, the system MUST search for candidate evidence chunks using the question text and, once available, the answer text, as two separate searches, and present their merged, deduplicated results as a single candidate list.
- **FR-004**: Each candidate evidence chunk shown MUST indicate whether it matched the question search, the answer search, or both.
- **FR-005**: Candidate chunks that matched both searches MUST be selected by default; the user MAY change any selection before saving.
- **FR-006**: Users MUST be able to search or browse for and add evidence chunks beyond the suggested candidates.
- **FR-007**: Users MUST be able to request a drafted answer grounded only in the currently selected evidence chunks, and then freely edit or replace that draft before saving.
- **FR-008**: A manually created entry MUST be usable immediately upon saving, without requiring a separate review/approval step.
- **FR-009**: Users MUST be able to request that the system generate a complete candidate entry (question, evidence chunks, draft answer) from a chosen document or corpus.
- **FR-010**: Users MUST be able to request generation of multiple candidate entries at once from a chosen document or corpus, with visible progress while generation runs.
- **FR-010a**: If a single-entry generation request fails, the system MUST show an error and MUST NOT save a partial or broken entry.
- **FR-010b**: If part of a batch generation request fails, the system MUST keep whichever entries were generated successfully and report which ones failed, rather than discarding the successful entries.
- **FR-011**: Every LLM-generated entry MUST be placed in a pending-review state and MUST NOT be treated as part of the usable golden dataset until a person explicitly approves it.
- **FR-012**: Users MUST be able to review a pending entry using the same editing capability as manual creation — including changing the question, adjusting selected evidence chunks, and editing the answer — before approving or rejecting it.
- **FR-013**: Users MUST be able to reject a pending entry; rejected entries MUST NOT be treated as part of the usable golden dataset.
- **FR-013a**: Users MUST be able to reopen a rejected entry in the same shared editor at any time and move it back to pending review or directly to approved — rejection is not a terminal, unrecoverable state.
- **FR-014**: The system MUST record, for every entry, how it was created (manual or LLM-generated) and its current status (approved, pending review, or rejected).
- **FR-015**: Users MUST be able to view a list of golden dataset entries for a corpus, showing at minimum the question, status, and creation source, and MUST be able to filter that list by status and by creation source.
- **FR-016**: Evidence chunks associated with an entry MUST be preserved as a snapshot of their actual text content at the time of selection, so an entry remains valid and unchanged even if its source document is later re-processed with different chunking settings.
- **FR-017**: Users MUST be able to edit an existing approved entry's question, evidence selection, or answer after the fact.
- **FR-018**: Users MUST be able to delete a golden dataset entry.
- **FR-019**: When a source document is deleted, its associated golden dataset entries MUST also be removed.

## Key Entities *(include if feature involves data)*

- **Golden Dataset Entry**: A single reference record — a question, a preferred answer, the corpus (and optionally specific document) it belongs to, how it was created (manual or LLM-generated), and its status (approved, pending review, or rejected).
- **Evidence Chunk Snapshot**: A piece of supporting text content linked to a Golden Dataset Entry, capturing the chunk's actual text as selected (not a live reference to a chunk's position), along with how it was surfaced (matched the question search, the answer search, both, or added manually).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can produce a complete, approved golden dataset entry by hand — question, evidence, and answer — in under 5 minutes for a document they're already familiar with.
- **SC-002**: In at least 80% of manually created entries, the user selects their final evidence chunks entirely from the suggested candidates, without needing to manually search for additional chunks.
- **SC-003**: Reviewing and approving (or rejecting) a single LLM-generated entry takes well under half the time of authoring an equivalent entry entirely by hand.
- **SC-004**: 100% of LLM-generated entries require an explicit human approval action before ever appearing as part of the usable golden dataset — none become usable automatically.
- **SC-005**: 100% of entries that are ever usable (approved) have at least one associated evidence chunk.
- **SC-006**: Existing golden dataset entries remain fully intact and readable after their source document's chunking configuration changes — 0% are corrupted or lost by re-chunking.

## Assumptions

- Only cosine similarity is used for the question/answer evidence searches in this version. The searching mechanism should be structured so a different similarity approach could be introduced later without a redesign, consistent with this product's general preference for swappable strategies, but no additional similarity method needs to be built now.
- Roughly the top 10 merged, deduplicated candidates are shown per search; this is a reasonable starting default, not a fixed requirement.
- A document must already have processed chunks available before golden dataset entries can be created against it (evidence selection and generation both draw from existing chunked content, mirroring how retrieval works elsewhere in the product).
- Golden dataset entries follow the same per-corpus (and single-owner) scoping already used throughout the product — no shared/collaborative access beyond the corpus's owner.
- Rejected entries are kept (not permanently deleted) and remain visible/filterable as rejected, for reference, but are always excluded from the usable golden dataset unless reopened (Clarifications, 2026-08-01) and moved back to pending review or approved.
- Wiring golden dataset entries into automated pipeline-quality scoring (comparing live pipeline answers against golden answers) is out of scope for this version — this feature only builds and manages the reference dataset itself.
- Exporting the golden dataset (e.g., for fine-tuning) is out of scope for this version.
- Each entry has exactly one preferred answer (no multiple acceptable-answer variants) in this version.
