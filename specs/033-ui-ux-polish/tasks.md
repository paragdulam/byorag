---

description: "Task list for 033-ui-ux-polish"
---

# Tasks: UI/UX Polish Across Corpora, Sources, Chunking, Embeddings, Vector View, and Playground

**Input**: Design documents from `/specs/033-ui-ux-polish/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included below at unit, integration, and e2e level for every user
story. Write each test task and confirm it fails before starting the implementation task(s) that
follow it.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story, per spec.md's priority order (US1 → US6).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app: `backend/app/`, `backend/tests/`, `frontend/src/`, `frontend/tests/` (existing
`frontend/` + `backend/` split — see plan.md Project Structure). All paths below are relative to
the repository root.

---

## Phase 1: Setup

**Purpose**: Skeletons for the two genuinely new, shared frontend primitives this feature needs

- [X] T001 [P] Create `frontend/src/hooks/useClickOutside.ts` with its exported signature only
      (`useClickOutside(ref: RefObject<HTMLElement>, onOutside: () => void): void`), per
      research.md §6 — no behavior yet
- [X] T002 [P] Create `frontend/src/components/shared/ConfirmModal.tsx` with its props interface
      only (`{ title, message, confirmLabel, onConfirm, onCancel }` or similar, modeled on
      `ComparisonModal.tsx`'s dialog structure per research.md §3) — no behavior yet

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The corpus↔document one-to-many migration and removal of the now-invalid
"attach/unlink" machinery — blocks both US1 (Corpora screen) and US2 (Sources screen), since both
touch document/corpus association UI that only makes sense once this lands

**⚠️ CRITICAL**: No User Story 1 or User Story 2 work can begin until this phase is complete

- [X] T003 [P] Backend test for the `documents.corpus_id` migration in
      `backend/tests/unit/test_schema_migrations.py`: asserts the migration is idempotent
      (safe to run twice), correctly backfills `corpus_id` from each document's earliest
      `document_corpora` association, and that `document_corpora` no longer exists afterward —
      write first, confirm it fails
- [X] T004 Implement the migration in `backend/app/db/schema_migrations.py`
      (`ensure_schema_migrations()`): add `documents.corpus_id` (guarded `ADD COLUMN IF NOT
      EXISTS`), backfill per data-model.md's exact steps, add the `NOT NULL` + FK constraint,
      replace `uq_document_user_content_hash` with `uq_document_user_corpus_content_hash`, drop
      `document_corpora`; update `Document`/`DocumentCorpus` in `backend/app/db/models.py`
      (remove `DocumentCorpus`, add `Document.corpus_id`) to satisfy T003 (depends on T003)
- [X] T005 [P] Backend test in `backend/tests/contract/test_document_corpus_links.py` (rewritten):
      `POST /api/sources/{document_id}/corpora` and
      `DELETE /api/sources/{document_id}/corpora/{corpus_id}` no longer exist (404) — write
      first, confirm it fails
- [X] T006 Remove `POST /{document_id}/corpora` and `DELETE /{document_id}/corpora/{corpus_id}`
      from `backend/app/sources/router.py`; remove `attach_document_to_corpus`/
      `unlink_document_from_corpus` from `backend/app/sources/service.py`; update the
      content-hash dedup check to be scoped per `(user_id, corpus_id)` instead of per `user_id`
      alone, per contracts/sources-api-changes.md — satisfies T005 (depends on T004)
- [X] T007 [P] Update or remove the now-invalid backend tests asserting the old many-to-many
      behavior: `backend/tests/unit/test_sources_service_corpus_links.py`,
      `backend/tests/unit/test_document_corpus_ownership.py`,
      `backend/tests/integration/test_document_corpus_associations.py`, and any
      attach/unlink-specific cases in `backend/tests/contract/test_corpora_api.py` and
      `backend/tests/integration/test_corpora_lifecycle.py` — replace with assertions matching
      the new one-to-many reality (a document is created with a `corpus_id`, never reassigned)
      (depends on T006)
- [X] T008 Remove `attachDocumentToCorpus`/`removeDocumentFromCorpus` from
      `frontend/src/lib/sourcesApi.ts`, and `attachToCorpus`/`removeFromCorpus` from
      `frontend/src/hooks/useSourceDocuments.ts`'s return value (depends on T006)

**Checkpoint**: One-to-many relationship live end-to-end; old attach/unlink machinery fully gone
from backend and frontend API layers — User Story 1 and User Story 2 implementation can now begin

---

## Phase 3: User Story 1 - Delete a document directly from the Corpora screen (Priority: P1) 🎯 MVP

**Goal**: Real per-document deletion (with confirmation) and a clickable document-name deep link,
replacing the old "remove from this corpus"/"attach existing document" controls.

**Independent Test**: Open a corpus with a document, click its delete icon, confirm in the modal,
and verify it's gone everywhere; separately, click a document's name and verify it opens directly
on the Sources screen.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T009 [P] [US1] Unit test `frontend/tests/unit/ConfirmModal.test.tsx`: renders the given
      title/message, calls `onConfirm`/`onCancel` correctly, matches the `role="dialog"
      aria-modal="true"` backdrop-click-to-cancel pattern from `ComparisonModal.tsx` — write
      first, confirm it fails
- [X] T010 [P] [US1] Integration test (extend/rewrite `frontend/tests/integration/
      test_corpora_screen_flow`-equivalent frontend file, or a new
      `frontend/tests/integration/CorporaScreen.deleteDocument.test.tsx`): each document's name
      renders as a link to its Sources deep link; a delete icon appears immediately after the
      name; clicking it opens `ConfirmModal` without deleting; confirming calls the delete API
      and removes the row from the list; canceling leaves it untouched; no "Remove" button or
      "attach an existing document" control exists anywhere in the panel — write first, confirm
      it fails

### Implementation for User Story 1

- [X] T011 [US1] Implement `frontend/src/components/shared/ConfirmModal.tsx` (satisfies T009,
      depends on T002)
- [X] T012 [US1] `frontend/src/components/corpora/CorporaScreen.tsx`'s `CorpusDocumentsPanel`:
      replace each document's plain-text name with a link to
      `buildDocumentLink(corpusId, documentId)` (existing builder, `router/urlScheme.ts`); add a
      delete icon (unicode/emoji) immediately after the name that opens `ConfirmModal`; on
      confirm, call `deleteSources([documentId])` (`lib/sourcesApi.ts`, already used elsewhere
      for real deletion) and refresh the document list; remove the "attach an existing document"
      `<select>`, its `allDocuments`/`listAllSources()` usage, and the old "Remove" button
      entirely (satisfies T010, depends on T008, T011)

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Simplified Sources screen layout (Priority: P2)

**Goal**: Document list fills the whole left pane; upload is a single button next to the page
title instead of a large card.

**Independent Test**: Open Sources for a corpus with documents; confirm the list starts at the
top of the left pane with no card above it, and an "Upload" button sits beside "Data Sources".

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T013 [P] [US2] Extend `frontend/tests/integration/DataSourcesScreen.test.tsx`: an "Upload"
      button renders in the same header row as the "Data Sources" heading; no "Upload PDF
      Documents" heading/card exists; uploading via the new button still adds documents to the
      list with the same validation/rejection behavior as today — write first, confirm it fails
- [X] T014 [P] [US2] Update `frontend/tests/unit/DocumentList.test.tsx` and
      `frontend/tests/integration/DataSourcesScreen.test.tsx`'s existing "attaches a document to
      another corpus via the row control" and "removes a document from the active corpus via the
      row control" tests: remove them (the feature they assert no longer exists per Phase 2) —
      write first, confirm the remaining suite still reflects the new reality

### Implementation for User Story 2

- [X] T015 [US2] `frontend/src/components/sources/DataSourcesScreen.tsx`: move the upload trigger
      into the header row beside "Data Sources" (top-right, top-aligned with the title); stop
      rendering `UploadDropzone` as a standalone card in the left pane (satisfies T013)
- [X] T016 [US2] `frontend/src/components/sources/DocumentList.tsx`: remove the `otherCorpora`,
      `onAttachToCorpus`, and `onRemoveFromCorpus` props and their UI (the "add to another
      corpus" combobox and "remove from corpus" control); the document list now fills the full
      left pane on its own (satisfies T014, depends on T008)
- [X] T017 [US2] Typography pass on `DataSourcesScreen.tsx`/`DocumentList.tsx` to match the
      Corpora-screen reference scale from research.md §5 (h1 `text-4xl`, section `h2` `text-xl`,
      secondary `text-sm`, tertiary `text-xs`, body/list text unstyled/base)

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Copyable chunk links on Fixed Size Chunking (Priority: P3)

**Goal**: A "Copy Link" control per chunk, plus typography parity with Corpora.

**Independent Test**: Click "Copy Link" on a specific chunk and confirm the copied link opens
directly on that chunk.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T018 [P] [US3] Extend `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx`: each chunk row
      has a "Copy Link" control in its top-right corner; clicking it writes
      `buildChunkingChunkLink(corpusId, documentId, chunkIndex)`'s result to the clipboard
      without changing `selectedChunkIndex` — write first, confirm it fails (matches the existing
      `handleCopyLink` pattern already used in `GoldenEntryList.tsx`/`PlaygroundTurnDetail.tsx`)

### Implementation for User Story 3

- [X] T019 [US3] `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx`: add a "Copy
      Link" button to the top-right of each `data-testid="fixed-size-chunk-{index}"` row
      (satisfies T018)
- [X] T020 [US3] Typography pass on `FixedSizeChunkingScreen.tsx` per research.md §5

**Checkpoint**: User Story 3 done.

---

## Phase 6: User Story 4 - Typography parity on the Embeddings screen (Priority: P4)

**Goal**: Embeddings screen's text sizes match Corpora's.

**Independent Test**: Compare Embeddings against Corpora and confirm matching heading/body/
secondary text sizes.

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

- [X] T021 [P] [US4] Unit test in `frontend/tests/unit/EmbeddingsScreen.test.tsx` (extend
      existing): asserts the screen's heading/section/body elements use the Corpora-reference
      classes from research.md §5 — write first, confirm it fails wherever a mismatch exists

### Implementation for User Story 4

- [X] T022 [US4] Adjust any oversized classes found in
      `frontend/src/components/embeddings/EmbeddingsScreen.tsx` to match (satisfies T021)

**Checkpoint**: User Story 4 done.

---

## Phase 7: User Story 5 - Typography parity on the Vector View screen (Priority: P5)

**Goal**: Vector View screen's text sizes match Corpora's.

**Independent Test**: Compare Vector View against Corpora and confirm matching sizes.

### Tests for User Story 5 (MANDATORY per constitution) ⚠️

- [X] T023 [P] [US5] Unit test in `frontend/tests/unit/VectorViewScreen.test.tsx` (extend
      existing): asserts the screen's heading/section/body elements use the Corpora-reference
      classes from research.md §5 — write first, confirm it fails wherever a mismatch exists

### Implementation for User Story 5

- [X] T024 [US5] Adjust any oversized classes found in
      `frontend/src/components/vector-view/VectorViewScreen.tsx` to match (satisfies T023)

**Checkpoint**: User Story 5 done.

---

## Phase 8: User Story 6 - Richer, traceable Playground answers (Priority: P6)

**Goal**: An Actions popover (Copy Link, Query Embedding) replacing the standalone Copy Link
button; the answer and its retrieved chunks merged into one block with per-citation info icons
opening a chunk-detail modal; a Retrieved Chunks group (with cosine similarity) revealed on
demand; typography parity with Corpora.

**Independent Test**: Ask a question, click an in-answer citation icon, confirm the modal shows
the right chunk with its similarity score and a working "Go To Chunk" link; open Actions, choose
Query Embedding, confirm both groups appear; click outside the open popover and confirm it
closes.

### Tests for User Story 6 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T025 [P] [US6] Unit test `frontend/tests/unit/useClickOutside.test.ts`: calls `onOutside`
      on a `mousedown` outside the referenced element, not on one inside it — write first,
      confirm it fails
- [X] T026 [P] [US6] Unit test `frontend/tests/unit/AnswerCitations.test.tsx`: a `[1]` marker
      resolving to `turn.chunks[0]` renders an info icon there; an out-of-range marker (e.g.
      `[9]` with only 2 chunks) renders its surrounding text with the marker stripped and no
      icon; text with no markers passes through unchanged — write first, confirm it fails
- [X] T027 [P] [US6] Backend test for `backend/app/playground/service.py`'s shared prompt
      builder: asserts the assembled prompt includes citation-marker instructions per
      contracts/citation-marker-syntax.md — write first, confirm it fails
- [X] T028 [P] [US6] Extend `frontend/tests/unit/PlaygroundTurnDetail.test.tsx`: a single
      icon-based "Actions" control replaces the standalone Copy Link button; clicking it opens a
      `role="menu"` popover with "Copy Link" and "Query Embedding" options; clicking outside
      closes it; "Copy Link" copies the same turn link as before; "Query Embedding" reveals both
      the query embedding values and a Retrieved Chunks list (each chunk showing its cosine
      similarity score), neither visible before it's chosen — write first, confirm it fails
- [X] T029 [P] [US6] Extend `frontend/tests/unit/PlaygroundTurnDetail.test.tsx` (or a new file):
      an info icon in the rendered answer opens a modal showing that chunk's content and cosine
      similarity; "Go To Chunk" links to `buildChunkingChunkLink(corpusId, documentId,
      chunkIndex)`; a close control dismisses the modal without navigating — write first, confirm
      it fails

### Implementation for User Story 6

- [X] T030 [US6] Update the shared prompt template in `backend/app/playground/service.py` to
      instruct `[N]` citation markers per contracts/citation-marker-syntax.md (satisfies T027)
- [X] T031 [US6] Implement `frontend/src/hooks/useClickOutside.ts` (satisfies T025, depends on
      T001)
- [X] T032 [US6] Implement `frontend/src/components/playground/AnswerCitations.tsx`: splits
      `answer` on `/\[(\d+)\]/g`, renders each segment through the existing `ReactMarkdown`,
      inserts an info-icon button after each resolvable marker (satisfies T026)
- [X] T033 [US6] `frontend/src/components/playground/PlaygroundTurnDetail.tsx`: replace the
      standalone "Copy Link" button with an icon "Actions" control (`aria-haspopup="menu"`)
      opening a `role="menu"` popover offering "Copy Link" and "Query Embedding"; wire
      `useClickOutside` to dismiss it (depends on T031; part of T028)
- [X] T034 [US6] `PlaygroundTurnDetail.tsx`: gate the existing query-embedding block, plus a new
      "Retrieved Chunks" list (each `turn.chunks` entry shown with its `score`), behind the
      Actions popover's "Query Embedding" option — hidden until chosen, per-turn (rest of T028)
- [X] T035 [US6] `PlaygroundTurnDetail.tsx`: replace the separate, always-visible chunk-list
      section with `<AnswerCitations>` rendering the answer inline, merging chunk evidence into
      the answer instead of a disconnected block above/below it (depends on T032; part of T029)
- [X] T036 [US6] Add `frontend/src/components/playground/ChunkCitationModal.tsx` (dialog pattern
      matching `ConfirmModal`/`ComparisonModal`): shows the cited chunk's content and cosine
      similarity, a "Go To Chunk" link (`buildChunkingChunkLink`), and a close control; wire it
      from `AnswerCitations`' info icons (satisfies rest of T029, depends on T032)
- [X] T037 [US6] Typography pass on `PlaygroundTurnDetail.tsx`/`PlaygroundScreen.tsx` per
      research.md §5

**Checkpoint**: All six user stories independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Full-repo regression check now that the corpus/document model and Playground answer
rendering have both changed

- [ ] T038 [P] Run `npx tsc -b --noEmit` in `frontend/` and `pytest` in `backend/`, fix any errors
- [ ] T039 [P] Run the full `npx vitest run` (frontend) and full backend `pytest` suites, fix any
      regressions
- [ ] T040 Update or remove e2e specs that assert the now-removed attach/unlink behavior:
      `frontend/tests/e2e/corpora-management.spec.ts`'s "upload into one corpus, attach to
      another without re-uploading, then unlink from the first" test, and any equivalent
      assertions in `frontend/tests/e2e/corpora-screen.spec.ts`, to match the new one-to-many
      reality (a document belongs to exactly one corpus for its whole lifetime)
- [X] T041 Walk through `specs/033-ui-ux-polish/quickstart.md` Scenarios 1–5 manually end-to-end
      and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS User Story 1 and User Story 2
- **User Story 1 (Phase 3)** and **User Story 2 (Phase 4)**: Both depend on Foundational; once
  it's done, US1 and US2 can proceed in parallel (different files: `CorporaScreen.tsx` vs.
  `DataSourcesScreen.tsx`/`DocumentList.tsx`)
- **User Story 3 (Phase 5)**, **User Story 4 (Phase 6)**, **User Story 5 (Phase 7)**: Each depends
  only on Setup — none touch the corpus/document relationship, so none need Foundational and all
  three can run in parallel with each other and with US1/US2
- **User Story 6 (Phase 8)**: Depends only on Setup (needs T001's `useClickOutside` skeleton) —
  independent of the corpus/document migration entirely, can run in parallel with every other
  story
- **Polish (Phase 9)**: Depends on all six user stories being complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation (e.g., T009–T010 before T011–T012)
- `ConfirmModal`/`useClickOutside` skeletons (Setup) before their real implementations (US1/US6)
- Within US6: prompt change (T030) and `useClickOutside`/`AnswerCitations` (T031–T032) before the
  `PlaygroundTurnDetail.tsx` wiring that depends on them (T033–T036)

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel
- T003 and T005 (Foundational tests) can run in parallel; T007 and T008 can run in parallel once
  T006 lands
- Once Foundational is done: User Story 1, User Story 2, User Story 3, User Story 4, User Story
  5, and User Story 6 can **all** proceed in parallel (six different files/areas, no
  cross-story dependencies)
- Within US6: T025, T026, T027, T028, T029 (all five test tasks) can run in parallel
- T038 and T039 (Polish) can run in parallel

---

## Parallel Example: After Foundational completes

```bash
# Launch all six user stories' first test tasks together:
Task: "Unit test ConfirmModal in frontend/tests/unit/ConfirmModal.test.tsx"                    # US1
Task: "Extend DataSourcesScreen.test.tsx for the new header/Upload button"                      # US2
Task: "Extend FixedSizeChunkingScreen.test.tsx for per-chunk Copy Link"                          # US3
Task: "Extend EmbeddingsScreen.test.tsx for typography parity"                                   # US4
Task: "Extend VectorViewScreen.test.tsx for typography parity"                                   # US5
Task: "Unit test useClickOutside.test.ts"                                                        # US6
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks US1/US2)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md Scenario 1 manually
5. Deploy/demo if ready — real per-document deletion and Sources deep-linking from Corpora

### Incremental Delivery

1. Setup + Foundational → one-to-many relationship live, old attach/unlink gone
2. User Story 1 → validate independently → deploy
3. User Stories 2–5 → each validates and deploys independently, any order, even in parallel
4. User Story 6 → the richest change, validate thoroughly (quickstart.md Scenario 5) → deploy
5. Each story adds value without breaking any other (no cross-story UI dependencies beyond the
   shared Foundational phase)

### Parallel Team Strategy

With multiple developers, after Foundational:
- Developer A: User Story 1 (Corpora)
- Developer B: User Story 2 (Sources)
- Developer C: User Stories 3–5 (Chunking/Embeddings/Vector View typography + chunk link)
- Developer D: User Story 6 (Playground — the largest single story, backend + frontend)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- US1 and US2 are the only stories touching the backend corpus/document relationship; US3–US6 are
  frontend-only (US6 also touches the backend prompt template, but not the data model)
