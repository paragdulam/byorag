---

description: "Task list template for feature implementation"
---

# Tasks: Golden Dataset Creation (Manual & LLM-Generated)

**Input**: Design documents from `/specs/027-golden-dataset/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app per plan.md: `backend/app/...`, `backend/tests/...`, `frontend/src/...`,
`frontend/tests/...`.

---

## Phase 1: Setup (Shared Infrastructure)

No new dependencies are needed for this feature (plan.md Technical Context — no new packages;
this feature only consumes the existing `EMBEDDING_MODELS`/`RETRIEVAL_STRATEGIES`/
`GENERATION_PROVIDERS` registries). Proceed directly to the Foundational phase below.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The two new tables and the entry-ownership lookup helper every endpoint in every
story depends on.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [X] T001 [P] Unit test for `backend/tests/unit/test_golden_dataset_cascade.py` — deleting a
  `Document` cascades (deletes) its associated `GoldenDatasetEntry` rows; deleting a `Corpus`
  cascades corpus-scoped (no-document) `GoldenDatasetEntry` rows; deleting a `GoldenDatasetEntry`
  cascades its `GoldenDatasetEntryChunk` rows; deleting a `Chunk` sets
  `GoldenDatasetEntryChunk.chunk_id` to `NULL` without deleting the snapshot row itself
  (data-model.md, research.md §6)
- [X] T002 Add `GoldenDatasetEntry` and `GoldenDatasetEntryChunk` models to
  `backend/app/db/models.py` per data-model.md — `document_id`/`corpus_id` both
  `ondelete="CASCADE"` on the entry; `entry_id` `ondelete="CASCADE"` and `chunk_id`
  `ondelete="SET NULL"` on the chunk snapshot; `chunks` relationship with
  `cascade="all, delete-orphan"`, `order_by="GoldenDatasetEntryChunk.position"` — depends on T001
  failing first
- [X] T003 [P] Add `get_golden_dataset_entry_owned_by(db, entry_id, user_id)` to
  `backend/app/db/lookups.py`, matching the existing `get_document_owned_by`/
  `get_corpus_owned_by` pattern (returns `None` for both "doesn't exist" and "not yours",
  research.md §8) — depends on T002; exercised by the GET/PATCH/DELETE contract tests in later
  phases rather than a dedicated unit test, consistent with how this codebase tests its other
  ownership-lookup helpers

**Checkpoint**: Tables and ownership lookup ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Manually build a golden dataset entry (Priority: P1) 🎯 MVP

**Goal**: A subject-matter expert can write a question and answer, get a merged/labeled candidate
evidence list (question-search + answer-search, Reciprocal Rank Fusion), select evidence chunks
(mandatory), optionally request an LLM draft grounded in the selection, and save immediately as an
approved entry.

**Independent Test**: Open the Golden Dataset screen for a corpus, write a question and answer by
hand, select evidence from the suggested candidates, and save — producing one immediately usable
entry visible in the entry list, with no LLM-generation feature touched at all.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T004 [P] [US1] Unit test for `backend/tests/unit/test_golden_dataset_rrf.py` — merging two
  ranked chunk-id lists via Reciprocal Rank Fusion (`1/(rank + 60)` summed per list a chunk
  appears in); a chunk present in both lists outranks one present in only one list at the same
  individual rank; dedup by chunk id; an empty answer-side list still returns the question-side
  results with `matchedAnswer: false` on all of them (research.md §1, data-model.md's candidate
  shape)
- [X] T005 [P] [US1] Contract test for `POST /api/golden-dataset/candidates` in
  `backend/tests/contract/test_golden_dataset_api.py` — question-only search returns candidates
  with `matchedAnswer: false`; question+answer search returns candidates labeled
  `matchedQuestion`/`matchedAnswer`/both; `400` when neither/both of `documentId`/`corpusId` are
  given or `question` is blank; `404` for a corpus/document that doesn't exist or isn't owned by
  the caller (contracts/golden-dataset-api.md)
- [X] T006 [P] [US1] Contract test for `POST /api/golden-dataset/draft-answer` — returns a
  `draftAnswer` grounded in the given chunk contents; `400` on empty `chunks` or when the
  caller has no Anthropic key on file; `502` when the generation call fails
  (contracts/golden-dataset-api.md)
- [X] T007 [P] [US1] Contract test for `POST /api/golden-dataset/entries` — creating with at least
  one chunk succeeds (`201`, status `approved`, source `manual`); `400` when `chunks` is empty
  (FR-002); `404` for corpus/document not owned (contracts/golden-dataset-api.md)
- [X] T008 [P] [US1] Contract test for `GET /api/golden-dataset/entries` — lists entries for a
  corpus; `status` and `source` filters work individually and combined
  (contracts/golden-dataset-api.md, FR-015)

### Implementation for User Story 1

- [X] T009 [US1] Implement the candidate-search/RRF-merge function in
  `backend/app/golden_dataset/service.py` — embeds question (and answer, if given) via
  `EMBEDDING_MODELS["bert"].embed(...)`, calls
  `RETRIEVAL_STRATEGIES["cosine-similarity"].search`/`search_corpus` once per embedded text,
  merges via RRF, returns top ~10 deduplicated candidates with `matchedQuestion`/`matchedAnswer`
  flags (research.md §1) — depends on T004 failing first, T002
- [X] T010 [US1] Create `backend/app/golden_dataset/schemas.py` — `CandidateSearchRequest`,
  `CandidateOut`, `CandidateSearchResponse`, `DraftAnswerRequest`, `DraftAnswerResponse`,
  `EntryChunkIn`, `CreateEntryRequest`, `EntryChunkOut`, `EntryOut`, `EntrySummaryOut`,
  `EntryListResponse` (contracts/golden-dataset-api.md)
- [X] T011 [US1] Implement `create_entry`/`list_entries` in
  `backend/app/golden_dataset/service.py` — validates at least one chunk before saving as
  `approved` (FR-002), snapshots chunk `content`/`chunkIndex`/`documentId` exactly as sent by the
  client rather than re-fetching live chunk rows (FR-016, contracts/golden-dataset-api.md's note
  on race-safety), supports `status`/`source` filters for listing — depends on T007/T008 failing
  first, T002, T010
- [X] T012 [US1] Implement `draft_answer` in `backend/app/golden_dataset/service.py`, reusing
  Playground's `[CHUNK n]`-block prompt shape (research.md §7) and the same
  `profile_service.resolve_decrypted_key` + `GENERATION_PROVIDERS[provider].generate(...)` call
  Playground's `generate_answer` uses — depends on T006 failing first, T010
- [X] T013 [US1] Create `backend/app/golden_dataset/router.py` —
  `APIRouter(prefix="/api/golden-dataset")` with `POST /candidates`, `POST /draft-answer`,
  `POST /entries`, `GET /entries` routes, translating service exceptions to `HTTPException`
  (matching the existing router convention) — depends on T009, T011, T012
- [X] T014 [US1] Register the golden-dataset router in `backend/app/main.py` — depends on T013

- [X] T015 [P] [US1] Unit test for `frontend/tests/unit/EvidenceChunkPicker.test.tsx` — renders
  candidate chunks as checkboxes with badges for matched-question/matched-answer/matched-both;
  "matched both" candidates start checked; toggling a checkbox works; a manually
  searched-and-added chunk can be included even if absent from the candidate list (FR-004–FR-006)
- [X] T016 [P] [US1] Unit test for `frontend/tests/unit/GoldenEntryEditor.test.tsx` — question and
  answer fields; a "Draft from selected chunks" button that calls the draft-answer endpoint and
  fills the answer field, editable afterward (FR-007); save is blocked with an explanatory message
  when zero chunks are selected (FR-002); save succeeds once at least one chunk is selected
- [X] T017 [P] [US1] Integration test for `frontend/tests/integration/GoldenDatasetScreen.test.tsx`
  (mocked API) — opening the screen, creating a manual entry end-to-end, and seeing it appear in
  the entry list with status "Approved"

- [X] T018 [P] [US1] Create `frontend/src/lib/goldenDatasetApi.ts` — typed fetch wrappers for
  `POST /candidates`, `POST /draft-answer`, `POST /entries`, `GET /entries`
  (contracts/golden-dataset-api.md)
- [X] T019 [US1] Create `frontend/src/components/golden-dataset/EvidenceChunkPicker.tsx` —
  checkbox candidate list with match-source badges, pre-checked "matched both" candidates, and a
  manual search/add affordance beyond the suggested candidates — depends on T015 failing first,
  T018
- [X] T020 [US1] Create `frontend/src/components/golden-dataset/GoldenEntryEditor.tsx` — question
  and answer fields, embeds `EvidenceChunkPicker`, wires the draft-answer button, blocks save at
  zero selected chunks — depends on T016 failing first, T019
- [X] T021 [US1] Create `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx` — entry
  list (question/status/source columns), a "+ New Entry → Write Manually" action opening
  `GoldenEntryEditor` in create mode — depends on T017 failing first, T020
- [X] T022 [P] [US1] Add `'golden-dataset'` to the `ScreenId` union and a `NAV_ITEMS` entry (with
  `requiresAnthropicKey: true`, matching Playground/Metrics, research.md §9) in
  `frontend/src/components/layout/SidebarNav.tsx`
- [X] T023 [US1] Add the `'golden-dataset'` ternary branch rendering `GoldenDatasetScreen` wrapped
  in `AppShell` in `frontend/src/app/App.tsx` — depends on T021, T022

**Checkpoint**: User Story 1 is fully functional and independently testable — MVP deliverable.

---

## Phase 4: User Story 2 - Generate and review a single entry with an LLM (Priority: P2)

**Goal**: A user can request one LLM-proposed entry (question, evidence, draft answer) from a
document/corpus; it lands in pending review; opening it reuses User Story 1's editor to approve
(optionally after edits), reject, or — for an already-rejected entry — reopen back to pending
review or straight to approved.

**Independent Test**: Request one generated entry from a document, see it appear in a
pending-review list, open it in the shared editor, and approve or reject it — independent of
whether batch generation (User Story 3) exists.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T024 [P] [US2] Contract test for `POST /api/golden-dataset/generate` — succeeds (`201`,
  status `pending_review`, source `llm_generated`, evidence chunks drawn from real content); `400`
  when the scope has no chunked content or no Anthropic key on file; `502` on a
  generation failure, with **nothing saved** in that case (FR-010a, contracts/golden-dataset-api.md)
- [X] T025 [P] [US2] Contract test for `GET /api/golden-dataset/entries/{id}` — returns the full
  entry including its evidence chunks; `404` for not-found/not-owned
  (contracts/golden-dataset-api.md)
- [X] T026 [P] [US2] Contract test for `PATCH /api/golden-dataset/entries/{id}` — editing
  question/answer/chunks on any entry regardless of status (FR-017); `pending_review → approved`
  and `pending_review → rejected` transitions (FR-012, FR-013); `rejected → pending_review` and
  `rejected → approved` transitions (FR-013a); `400` when the request would leave status
  `approved` with zero chunks (FR-002/FR-018's invariant applied to every save, not just creation)
  (contracts/golden-dataset-api.md, data-model.md's state diagram)

### Implementation for User Story 2

- [X] T027 [US2] Implement `generate_entry` in `backend/app/golden_dataset/service.py` —
  evidence-first sampling (pick a chunk from the document/corpus scope, preferring chunks not
  already referenced by an existing entry where practical, research.md §5), a
  chunk-content-to-question/answer prompt (inverting Playground's `[CHUNK n]`-block shape,
  research.md §5), saves the result as `pending_review` on success and saves nothing on failure
  (FR-010a) — depends on T024 failing first, T002, T010 (extend schemas with
  `GenerateEntryRequest`)
- [X] T028 [US2] Implement `get_entry`/`update_entry` in `backend/app/golden_dataset/service.py` —
  field edits, the status-transition rules from data-model.md's state diagram (no transition
  blocked except the zero-chunk-at-approved invariant), using
  `get_golden_dataset_entry_owned_by` (T003) — depends on T025/T026 failing first, T002, T010
  (extend schemas with `UpdateEntryRequest`)
- [X] T029 [US2] Add `POST /generate`, `GET /entries/{id}`, `PATCH /entries/{id}` routes to
  `backend/app/golden_dataset/router.py` — depends on T027, T028

- [X] T030 [P] [US2] Unit test for `frontend/tests/unit/GoldenReviewQueue.test.tsx` — lists
  pending-review entries; opening one loads `GoldenEntryEditor` pre-filled with the generated
  content; approve/reject actions change status; opening a rejected entry offers a way back to
  pending review or straight to approved (FR-013a)
- [X] T031 [US2] Extend `frontend/src/lib/goldenDatasetApi.ts` with `generate`/`getEntry`/
  `updateEntry` wrappers — depends on T018
- [X] T032 [US2] Extend `frontend/src/components/golden-dataset/GoldenEntryEditor.tsx` to support
  an edit/review mode (pre-filled from an existing entry via `getEntry`) plus
  approve/reject/reopen actions calling `updateEntry`, reusing the same component User Story 1
  built for creation (FR-012) — depends on T020, T031
- [X] T033 [US2] Create `frontend/src/components/golden-dataset/GoldenReviewQueue.tsx` — a
  pending-review list that opens `GoldenEntryEditor` in review mode — depends on T030 failing
  first, T032
- [X] T034 [US2] Wire "+ New Entry → Generate with LLM" and the review queue view into
  `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx` — depends on T021, T033

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Generate a batch of entries at once (Priority: P3)

**Goal**: A user can request several entries generated at once from a document/corpus, see
progress while it runs (surviving a navigate-away-and-back), and have every result — successes and
reported failures alike — land in the same review queue User Story 2 built.

**Independent Test**: Request a batch of several entries from a document, observe progress until
it completes, and confirm each result appears individually in the pending-review list, ready for
the same one-by-one review as User Story 2.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T035 [P] [US3] Unit test for `frontend/tests/unit/BatchGenerationProgress.test.tsx` — runs
  `runSequentialBatch` (`frontend/src/lib/batchRunner.ts`) over N calls to the `generate` API
  wrapper; reports per-item progress; when some items fail, the successful ones are still reported
  as results rather than the whole batch being discarded (FR-010b); progress state is held where
  it survives the owning screen unmounting and remounting (research.md §4's navigate-away edge
  case)

### Implementation for User Story 3

- [X] T036 [US3] Create `frontend/src/components/golden-dataset/BatchGenerationProgress.tsx` —
  drives `runSequentialBatch` over repeated `generate()` calls, lifting its progress/results state
  so it's readable again after navigating away and back (research.md §4) — depends on T035 failing
  first, T031
- [X] T037 [US3] Wire "+ New Entry → Generate a Batch…" into
  `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx`, launching
  `BatchGenerationProgress` and refreshing the entry/review-queue lists as results land — depends
  on T034, T036

**Checkpoint**: All three user stories are independently functional — full Golden Dataset feature
complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Delete (a cross-cutting utility not central to any single story's demonstrated value)
plus end-to-end verification across all three stories.

- [X] T038 [P] Contract test for `DELETE /api/golden-dataset/entries/{id}` in
  `backend/tests/contract/test_golden_dataset_api.py` — `204` on success and cascades its chunk
  snapshots (data-model.md); `404` for not-found/not-owned (FR-018,
  contracts/golden-dataset-api.md)
- [X] T039 Implement `delete_entry` in `backend/app/golden_dataset/service.py` and add the
  `DELETE /entries/{id}` route in `backend/app/golden_dataset/router.py` — depends on T038 failing
  first
- [X] T040 [P] Add a delete action to
  `frontend/src/components/golden-dataset/GoldenDatasetScreen.tsx` (or the editor) — depends on
  T039
- [X] T041 [P] E2E test in `frontend/tests/e2e/golden-dataset.spec.ts` — against the real stack:
  manual creation end-to-end, single LLM generation + approval, and a small batch generation
  (quickstart.md US1–US3)
- [X] T042 Run every scenario in `specs/027-golden-dataset/quickstart.md` end-to-end against the
  running dev stack, including the re-chunk-preserves-entries and delete-document-cascades
  cross-cutting checks (FR-016/SC-006, FR-019)
- [X] T043 Run the backend (`pytest`) and frontend (`vitest run`, `playwright test`) suites once
  more to confirm no regressions across all three stories

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A for this feature (no new dependencies)
- **Foundational (Phase 2)**: Blocks Phases 3–5 (every endpoint in every story needs the two new
  tables; GET/PATCH/DELETE need the ownership lookup helper)
- **User Stories (Phase 3–5)**: US1 has no dependency on US2/US3 and is independently shippable as
  an MVP. US2 reuses US1's `GoldenEntryEditor` component and `goldenDatasetApi.ts` module (adding
  to both rather than duplicating), so its frontend tasks are sequenced after US1's frontend tasks
  land, even though US2's *backend* tasks (generate/get/patch) have no dependency on US1's backend
  tasks beyond the shared Foundational phase. US3 depends on US2's `generate` endpoint and API
  wrapper existing.
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on User Story 2 or 3 — deliverable as a standalone MVP
- **User Story 2 (P2)**: Backend (T027–T029) only depends on Foundational. Frontend (T030–T034)
  depends on US1's `GoldenEntryEditor`/`goldenDatasetApi.ts` existing, since it extends rather than
  duplicates them
- **User Story 3 (P3)**: Depends on US2's `generate` endpoint (T027, T029) and its
  `goldenDatasetApi.ts` wrapper (T031)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- US1: T004–T008 (tests) before T009–T014 (backend implementation); T015–T017 (tests) before
  T018–T023 (frontend implementation); schemas (T010) before anything that imports them
  (T011–T013); router (T013) before registration (T014); components build bottom-up
  (`EvidenceChunkPicker` → `GoldenEntryEditor` → `GoldenDatasetScreen` → `App.tsx` wiring)
- US2: T024–T026 (tests) before T027–T029 (backend); T030 (test) before T031–T034 (frontend);
  `GoldenEntryEditor`'s edit-mode (T032) before the review-queue component that opens it in that
  mode (T033)
- US3: T035 (test) before T036–T037 (implementation)
- Story complete before moving to the next priority (or to Polish)

### Parallel Opportunities

- Within Foundational: T001 and T003 touch different files and can run in parallel; T002 depends
  on T001 failing first
- Within US1: T004–T008 (5 distinct test files/concerns) can all be authored in parallel; T018
  (API client) can be built in parallel with the backend implementation tasks (T009–T014) since it
  only needs the *contract*, not the running backend, though it can't be exercised end-to-end
  until the backend lands; T022 (SidebarNav) is independent of the component-building chain and
  can run in parallel with it
- Within US2: T024–T026 (3 distinct contract-test concerns) can run in parallel
- Within Polish: T038 and T041 touch different files and can run in parallel; T040 depends on T039
- Because US1's and US2's frontend work converge on the same `GoldenEntryEditor.tsx` and
  `goldenDatasetApi.ts` files, their frontend implementation tasks are not safely parallel with
  each other even though their *backend* tasks are independent

---

## Parallel Example: User Story 1

```bash
# Author all User Story 1 tests together:
Task: "Unit test for RRF merge in backend/tests/unit/test_golden_dataset_rrf.py"
Task: "Contract test for POST /candidates in backend/tests/contract/test_golden_dataset_api.py"
Task: "Contract test for POST /draft-answer in backend/tests/contract/test_golden_dataset_api.py"
Task: "Contract test for POST /entries in backend/tests/contract/test_golden_dataset_api.py"
Task: "Contract test for GET /entries in backend/tests/contract/test_golden_dataset_api.py"
Task: "Unit test for EvidenceChunkPicker in frontend/tests/unit/EvidenceChunkPicker.test.tsx"
Task: "Unit test for GoldenEntryEditor in frontend/tests/unit/GoldenEntryEditor.test.tsx"
Task: "Integration test for GoldenDatasetScreen in frontend/tests/integration/GoldenDatasetScreen.test.tsx"

# Then implement the backend chain in order:
Task: "Implement the RRF merge function in backend/app/golden_dataset/service.py"
Task: "Create backend/app/golden_dataset/schemas.py"
Task: "Implement create_entry/list_entries in backend/app/golden_dataset/service.py"
Task: "Implement draft_answer in backend/app/golden_dataset/service.py"
Task: "Create backend/app/golden_dataset/router.py"
Task: "Register the router in backend/app/main.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T003)
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Confirm a manual entry can be created end-to-end and appears in the list
4. Deploy/demo if ready — a corpus owner can already build a hand-curated golden dataset, even
   without any LLM-assisted creation

### Incremental Delivery

1. Foundational → User Story 1 → test independently → deploy/demo (MVP!)
2. Add User Story 2 (single LLM generation + review) → test independently → deploy/demo
3. Add User Story 3 (batch generation) → test independently → deploy/demo
4. Each story adds value without breaking the previous ones

### Parallel Team Strategy

Once Phase 2 (Foundational) is done:
- Backend work for US1 and US2 has no cross-dependency beyond Foundational and could be split
  across two developers (US1's candidate-search/create/list vs. US2's generate/get/patch)
- Frontend work is more coupled — US2 and US3's frontend both extend files US1 creates
  (`GoldenEntryEditor.tsx`, `goldenDatasetApi.ts`), so one developer carrying frontend work
  US1 → US2 → US3 in order avoids merge conflicts; a second developer can work the backend side of
  US2 in parallel with US1's frontend work, landing ready for the frontend to pick up

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
