---

description: "Task list for Corpora Management with Persistent Storage"
---

# Tasks: Corpora Management with Persistent Storage

**Input**: Design documents from `/specs/008-corpora-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level),
tests are NON-NEGOTIABLE and are included for every user story at unit, integration, contract,
and/or end-to-end level as appropriate. Write each story's tests first and confirm they fail
before implementing that story.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1=P1, US2=P2, US3=P2,
US4=P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete sibling task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths are exact and relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the PostgreSQL dependency surface (packages, container, config) with no schema yet

- [X] T001 Add `sqlalchemy>=2.0` and `psycopg[binary]>=3.2` to `backend/pyproject.toml` dependencies
- [X] T002 [P] Add a `postgres:16` service (named volume `pgdata:/var/lib/postgresql/data`, `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB=byorag` env vars) to `docker-compose.yml`; add `DATABASE_URL` and `depends_on: postgres` to the `backend` service (research.md §4)
- [X] T003 [P] Add a `DATABASE_URL` setting to `backend/app/config.py`, defaulting to `postgresql+psycopg://byorag:byorag@localhost:5432/byorag` when unset (research.md §4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The relational schema and DB plumbing every user story is built on top of

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create the SQLAlchemy engine, `SessionLocal`, and `get_db()` FastAPI dependency in `backend/app/db/base.py`, reading `settings.database_url` (research.md §1)
- [X] T005 [P] Define ORM models `Corpus`, `Document`, `DocumentCorpus`, `Chunk` — fields, `UNIQUE`/FK constraints, and relationships exactly as specified in `data-model.md` — in `backend/app/db/models.py` (depends on T004)
- [X] T006 [P] Implement a SHA-256 content-hash helper (`compute_content_hash(data: bytes) -> str`) in `backend/app/db/hashing.py` (research.md §3)
- [X] T007 Call `Base.metadata.create_all(engine)` from a FastAPI startup event in `backend/app/main.py` (depends on T004, T005)
- [X] T008 Implement an idempotent `migrate_legacy_pdfs()` startup routine in `backend/app/db/legacy_migration.py` — hash every file in `PDFS_DIR` not yet in `documents.content_hash`, create/reuse a single `"Uncategorized"` corpus, insert `Document` + `DocumentCorpus` rows — invoked from `backend/app/main.py` right after T007 (research.md §2, FR-015)
- [X] T009 [P] Extend `backend/tests/conftest.py` with a `db_session` fixture that opens a connection to `DATABASE_URL`, begins a transaction, binds a `Session` to it, and rolls back after each test (research.md §10) (depends on T004, T005)

**Checkpoint**: Schema exists, legacy PDFs migrate on startup, tests can use a clean per-test DB session — user story implementation can now begin.

---

## Phase 3: User Story 1 - Manage multiple corpora (Priority: P1) 🎯 MVP

**Goal**: Users can create, list, and select corpora from a new "Corpora" nav section positioned
above "Sources"; selecting a corpus scopes the Sources view to it.

**Independent Test**: Create two or more corpora, confirm both appear in the Corpora section above
Sources, and confirm selecting a corpus changes the document list shown in Sources.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these first; confirm they fail before implementing.

- [X] T010 [P] [US1] Contract test for `GET/POST/PATCH/DELETE /api/corpora` (create, list, rename, duplicate-name 409, delete blocked 409, delete success) in `backend/tests/contract/test_corpora_api.py` (contracts/corpora-api.md)
- [X] T011 [P] [US1] Update `backend/tests/contract/test_list_sources.py` for the new `corpusId`-scoped `GET /api/sources` contract (missing `corpusId` → 400, unknown `corpusId` → 404, scoped results) (contracts/sources-api.md)
- [X] T012 [P] [US1] Integration test covering the corpus lifecycle — create, reject duplicate name, list, switching the active corpus scopes `GET /api/sources`, delete blocked while non-empty — in `backend/tests/integration/test_corpora_lifecycle.py` (FR-001, FR-003, FR-004, FR-013, FR-014)
- [X] T013 [P] [US1] Unit tests for corpus name validation (empty/whitespace rejected, duplicate rejected) in `backend/tests/unit/test_corpora_service.py`
- [X] T014 [P] [US1] Unit tests for `CorpusContext` (loads list, tracks `activeCorpusId`, persists selection to `localStorage`) in `frontend/tests/unit/CorpusContext.test.tsx`
- [X] T015 [P] [US1] Extend `frontend/tests/unit/SidebarNav.test.tsx` for the Corpora section (empty/prompt state, corpus list rendered above Sources, active corpus highlighted, create control)
- [X] T016 [P] [US1] New e2e test: create two corpora and confirm switching between them updates the Sources view, in `frontend/tests/e2e/corpora-management.spec.ts`

### Implementation for User Story 1

- [X] T017 [P] [US1] Define `CorpusResponse`, `CreateCorpusRequest`, `RenameCorpusRequest` Pydantic schemas in `backend/app/corpora/schemas.py` (contracts/corpora-api.md)
- [X] T018 [US1] Implement corpus service — `create_corpus`, `list_corpora`, `rename_corpus`, `delete_corpus` (400 on empty/whitespace name, 409 on duplicate name or non-empty delete) — in `backend/app/corpora/service.py` (FR-001, FR-013, FR-014) (depends on T005, T017)
- [X] T019 [US1] Implement `GET/POST/PATCH/DELETE /api/corpora` in `backend/app/corpora/router.py` (depends on T018)
- [X] T020 [US1] Register the corpora router in `backend/app/main.py` (depends on T019)
- [X] T021 [US1] Rewrite `list_documents` in `backend/app/sources/service.py` to query `Document` joined to `DocumentCorpus` filtered by `corpus_id`, replacing the current filesystem-directory iteration (FR-004) (depends on T005)
- [X] T022 [US1] Update `GET /api/sources` in `backend/app/sources/router.py` to require a `corpusId` query param, returning 400 if missing and 404 if the corpus doesn't exist (depends on T021)
- [X] T023 [P] [US1] Add `Corpus` type to `frontend/src/types/corpus.ts` (data-model.md)
- [X] T024 [US1] Add `frontend/src/lib/corporaApi.ts` — `listCorpora`, `createCorpus`, `renameCorpus`, `deleteCorpus` (contracts/corpora-api.md) (depends on T023)
- [X] T025 [US1] Add `frontend/src/context/CorpusContext.tsx` — corpora list, `activeCorpusId`, create/select/rename/delete actions, `localStorage`-backed selection (research.md §7) (depends on T024)
- [X] T026 [US1] Add a "Corpora" section above "Sources" to `frontend/src/components/layout/SidebarNav.tsx`, driven by `CorpusContext` (list, empty state, create control, active-corpus highlight) (FR-002, FR-003) (depends on T025)
- [X] T027 [US1] Wrap the app tree in `CorpusProvider` in `frontend/src/app/App.tsx` (depends on T025)
- [X] T028 [US1] Update the Sources data-fetching hook/API call (`frontend/src/lib/sourcesApi.ts` and its consumer, e.g. `frontend/src/hooks/useSourceDocuments.ts`) to read `corpusId` from `CorpusContext` and pass it on `GET /api/sources` (FR-004) (depends on T022, T025)

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable (MVP).

---

## Phase 4: User Story 2 - Associate documents with one or more corpora (Priority: P2)

**Goal**: Uploading a document links it to the active corpus with content-hash dedup; an existing
document can be attached to additional corpora without re-uploading, unlinked from a corpus without
necessarily deleting it, and is fully deleted (with its chunks) only when unlinked from its last
corpus.

**Independent Test**: Upload a document into Corpus A, attach the same document to Corpus B,
confirm it appears in both, then unlink it from A and confirm it survives in B; unlink it from B
and confirm it (and its chunks) are gone entirely.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T029 [P] [US2] Update `backend/tests/contract/test_upload_sources_happy_path.py` for the required `corpusId` field and content-hash dedup response behavior (contracts/sources-api.md)
- [X] T030 [P] [US2] Contract test for `POST /api/sources/{documentId}/corpora` (attach, idempotent) and `DELETE /api/sources/{documentId}/corpora/{corpusId}` (unlink, 404 cases) in `backend/tests/contract/test_document_corpus_links.py`
- [X] T031 [P] [US2] Integration test: upload dedup by content hash (no duplicate document/chunks/file), attach to a second corpus, unlink from the first (document survives), unlink from the last (document + chunks deleted) in `backend/tests/integration/test_document_corpus_associations.py` (FR-005–FR-008)
- [X] T032 [P] [US2] Unit tests for content-hash dedup lookup and cascade-delete-on-last-unlink logic in `backend/tests/unit/test_sources_service_corpus_links.py`
- [X] T033 [P] [US2] Extend `frontend/tests/integration/DataSourcesScreen.test.tsx` for "attach to another corpus" and "remove from this corpus" actions
- [X] T034 [P] [US2] Extend `frontend/tests/e2e/corpora-management.spec.ts` — upload into Corpus A, attach to Corpus B without re-uploading, unlink from A, confirm the document still appears in B

### Implementation for User Story 2

- [X] T035 [US2] Rewrite `save_file` in `backend/app/sources/service.py` to require `corpus_id`: hash the upload (T006), link-and-skip-write on a hash match, otherwise create a `Document` row, write the file, and link it to the corpus (FR-005, FR-006) (depends on T021, T006)
- [X] T036 [US2] Implement `attach_document_to_corpus` and `unlink_document_from_corpus` (single transaction; on last unlink, delete `Chunk` rows, the `Document` row, and its file) in `backend/app/sources/service.py` (FR-006–FR-008, research.md §6) (depends on T035)
- [X] T037 [US2] Update `POST /api/sources` in `backend/app/sources/router.py` to require a `corpusId` form field (400 if missing, 404 if unknown) (depends on T035)
- [X] T038 [US2] Add `POST /api/sources/{documentId}/corpora` and `DELETE /api/sources/{documentId}/corpora/{corpusId}` to `backend/app/sources/router.py` (depends on T036)
- [X] T039 [US2] Update `delete_documents` in `backend/app/sources/service.py` so bulk delete also removes `Chunk` and `DocumentCorpus` rows (DB cascade) alongside the file (depends on T035)
- [X] T040 [P] [US2] Add an `AttachDocumentRequest` schema to `backend/app/sources/schemas.py`; document `SourceDocument.id` as the server-generated UUID (data-model.md)
- [X] T041 [US2] Update `frontend/src/lib/sourcesApi.ts` — `uploadSources(files, corpusId)`, `attachDocumentToCorpus(documentId, corpusId)`, `removeDocumentFromCorpus(documentId, corpusId)` (depends on T040)
- [X] T042 [US2] Add "attach to another corpus" and "remove from this corpus" actions (sourced from `CorpusContext`'s corpora list) to `frontend/src/components/sources/DataSourcesScreen.tsx` (depends on T041, T025)

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - Persistent storage across restarts (Priority: P2)

**Goal**: Corpora, documents, their corpus associations, and chunks all survive an application
restart; an unreachable database produces a clear error instead of a silent empty/broken state.

**Independent Test**: Create a corpus, upload a document, run chunking on it, restart the
backend/database process, and confirm everything is still present and correctly linked; separately,
confirm an unreachable database surfaces a clear startup error.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T043 [P] [US3] Integration test: create corpus + document + chunk results, simulate a restart (new app/`TestClient` instance bound to the same `DATABASE_URL`), verify all data is intact and correctly linked, in `backend/tests/integration/test_restart_persistence.py`
- [X] T044 [P] [US3] Integration test: an unreachable `DATABASE_URL` at startup produces a clear error rather than a silently empty/inconsistent app state, in `backend/tests/integration/test_db_unavailable_startup.py`
- [X] T045 [P] [US3] Extend `backend/tests/unit/test_chunking_service.py` for chunk-persist-on-result and replace-on-rerun semantics

### Implementation for User Story 3

- [X] T046 [US3] Add a DB connectivity check to the FastAPI startup path in `backend/app/main.py` that fails loudly (non-2xx health / startup exception) when `DATABASE_URL` is unreachable (depends on T004, T007)
- [X] T047 [US3] Persist chunks on the terminal `result` event of `stream_chunking()` in `backend/app/chunking/service.py` — one transaction: delete existing `Chunk` rows for the document, insert the new ones with `strategy`/`chunk_size`/`overlap` (research.md §9, FR-009, FR-011) (depends on T005)
- [X] T048 [US3] Surface a chunk-persist failure as the stream's `error` event in `backend/app/chunking/router.py` (depends on T047)

**Checkpoint**: User Stories 1, 2, and 3 all work independently — full persistence story validated (quickstart.md §5).

---

## Phase 6: User Story 4 - Visual indicator for expandable navigation items (Priority: P3)

**Goal**: The "Chunking" nav item shows a chevron reflecting its expanded/collapsed state; items
without suboptions show no chevron.

**Independent Test**: Load the nav, confirm a chevron appears next to "Chunking" and nowhere else,
click to expand/collapse, and confirm the chevron's orientation tracks the state.

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

- [X] T049 [P] [US4] Extend `frontend/tests/unit/SidebarNav.test.tsx` — chevron present next to "Chunking", absent next to non-expandable items, orientation toggles with expand/collapse (FR-012)
- [X] T050 [P] [US4] New e2e test `frontend/tests/e2e/sidebar-chevron.spec.ts` asserting the chevron's expanded/collapsed visual state (class or `aria-expanded`) on click

### Implementation for User Story 4

- [X] T051 [US4] Add an inline SVG chevron next to any `NavItem` with `subItems` in `frontend/src/components/layout/SidebarNav.tsx`, rotated via a CSS transform driven by the existing `isExpanded` state (research.md §8, FR-012)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency and performance passes across all stories

- [X] T052 [P] Reconcile pre-existing sources/chunking test suites broken by the `id`-as-UUID and corpus-scoping breaking changes (`backend/tests/contract/`, `backend/tests/integration/`, `backend/tests/unit/` sources- and chunking-related files)
- [X] T053 [P] Add indexes on `document_corpora.corpus_id` and `chunks.document_id` in `backend/app/db/models.py` for scoped-listing query performance
- [X] T054 [P] Log the legacy-PDF migration count (files migrated / already present) at startup in `backend/app/db/legacy_migration.py` for operator visibility
- [X] T055 Run `specs/008-corpora-management/quickstart.md` end-to-end manually and fix any discrepancies found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; builds on US1's `sources/service.py`
  changes (T021) but is independently testable once US1 is in place
- **User Story 3 (Phase 5)**: Depends on Foundational; the chunk-persistence work (T047) is
  independent of US1/US2's sources changes, though the "full restart" quickstart scenario is
  most meaningful once US1 and US2 also exist
- **User Story 4 (Phase 6)**: Depends only on Foundational (in practice, only on `SidebarNav.tsx`
  already existing) — fully independent of US1–US3, could be done first or in parallel
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests are written first and must fail before implementation begins
- Schemas before services; services before routers; backend endpoints before frontend API
  wrappers; API wrappers before UI components that consume them
- Story complete (checkpoint) before moving to the next priority

### Parallel Opportunities

- Setup: T002, T003 in parallel (T001 first, since both later tasks assume dependencies exist conceptually, though files don't overlap)
- Foundational: T005 and T006 in parallel once T004 exists; T009 in parallel with T007/T008
- All test tasks within a story phase marked [P] can run in parallel (different files)
- US4 can be implemented in parallel with US1–US3 by a different contributor (touches only
  `SidebarNav.tsx` and its tests)
- Within US1: T017 and T023 in parallel; within US2: T029–T034 (tests) in parallel; T040 in
  parallel with T035/T036

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for GET/POST/PATCH/DELETE /api/corpora in backend/tests/contract/test_corpora_api.py"
Task: "Update contract test for scoped GET /api/sources in backend/tests/contract/test_list_sources.py"
Task: "Integration test for corpus lifecycle in backend/tests/integration/test_corpora_lifecycle.py"
Task: "Unit tests for corpus name validation in backend/tests/unit/test_corpora_service.py"
Task: "Unit tests for CorpusContext in frontend/tests/unit/CorpusContext.test.tsx"
Task: "Extend SidebarNav.test.tsx for Corpora section"
Task: "New e2e test for corpus creation/switching in frontend/tests/e2e/corpora-management.spec.ts"

# Launch independent schema/type tasks together:
Task: "Define corpora Pydantic schemas in backend/app/corpora/schemas.py"
Task: "Add Corpus type to frontend/src/types/corpus.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently (quickstart.md §3)
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Postgres schema live, legacy PDFs migrated
2. Add User Story 1 → Test independently → Deploy/Demo (MVP: multi-corpus browsing)
3. Add User Story 2 → Test independently → Deploy/Demo (many-to-many document association)
4. Add User Story 3 → Test independently → Deploy/Demo (durability guarantees)
5. Add User Story 4 → Test independently → Deploy/Demo (nav polish)

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: User Story 1 (then User Story 2, which builds on it)
- Developer B: User Story 4 (fully independent — no shared files with A until Polish)
- Developer C: User Story 3's chunk-persistence half (T047/T048), joining A once US1's
  `sources/service.py` changes land for the restart-persistence integration test (T043)

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete sibling task
- [Story] label maps each task to its user story for traceability
- Verify each story's tests fail before implementing that story
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- T021/T022 (US1) and T035–T039 (US2) all touch `backend/app/sources/service.py`/`router.py` —
  do these two stories' implementation tasks in order (US1 before US2), not in parallel, to avoid
  merge conflicts in those shared files
