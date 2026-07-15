# Tasks: Playground Similarity Search

**Input**: Design documents from `/specs/016-playground-similarity-search/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/playground-api.md,
quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, NON-NEGOTIABLE), tests are
mandatory and are included below at the contract, unit, component, and e2e level.

**Organization**: Tasks are grouped by user story (US1 = ask a question and see ranked results,
US2 = see search context before searching, US3 = see the generated query embedding), matching
spec.md's priority order (US1=P1 MVP, US2=P2, US3=P3). Unlike feature 015, these stories are
**not** file-disjoint — they share `PlaygroundScreen.tsx`, `usePlaygroundSearch.ts`,
`playgroundApi.ts`, and the backend `app/playground/` module, because they're layered additions
to one screen and one API surface. Tasks that touch a file another story's task already touched
are ordered sequentially (no `[P]`) rather than marked parallel.

**Key dependency to note**: US1's search call needs to know *which* embedding model to use — that
comes from the same context lookup that powers US2's on-screen display. This data-fetch is
therefore built once in Foundational and reused by both stories; US2 only adds its *visible*
rendering on top (see plan.md's Project Structure and research.md Decision 5).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Web app layout (existing repo): `backend/app/...`, `backend/tests/...`, `frontend/src/...`,
`frontend/tests/...`.

---

## Phase 1: Setup

**Purpose**: Scaffold the new backend package directories (no logic yet — mirrors
`app/chunking/` and `app/embeddings/`'s existing shape).

- [X] T001 Create `backend/app/playground/__init__.py` (empty)
- [X] T002 [P] Create `backend/app/retrieval/__init__.py` and
  `backend/app/retrieval/strategies/__init__.py` (empty)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The context lookup (`GET /api/playground/context`) and its frontend fetch, needed by
*both* user stories — US1 needs it to know which embedding model to search with; US2 needs it to
display document/chunking-strategy/embedding-model context. Building it once here avoids US1 and
US2 each re-deriving "which model" independently.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational (MANDATORY per constitution) ⚠️

> Write these tests FIRST; confirm they FAIL before implementing.

- [X] T003 [P] Contract test for `GET /api/playground/context` (unknown document → 404; document
  with no saved chunks → `chunkingStrategy: null, embeddingModel: null`; document with saved
  chunks but no saved embeddings → `chunkingStrategy` set, `embeddingModel: null`; document with
  saved embeddings from more than one save → `embeddingModel` is the most-recently-created one)
  in `backend/tests/contract/test_playground_search.py`, per contracts/playground-api.md.
- [X] T004 [P] Unit test for `usePlaygroundSearch`'s context-loading behavior — fetches context
  when `documentId` is set, clears/refetches when `documentId` changes (document-switch reset,
  FR-011) — in `frontend/tests/unit/usePlaygroundSearch.test.ts`.

### Implementation for Foundational

- [X] T005 Add `PlaygroundContextResponse` schema in `backend/app/playground/schemas.py`.
- [X] T006 Implement `get_context(db, document_id) -> PlaygroundContext` in
  `backend/app/playground/service.py`: `chunkingStrategy` from the document's saved chunks'
  `strategy` column (per data-model.md's "one strategy per current save" assumption);
  `embeddingModel` from the `model` of the most-recently-created `Embedding` joined across the
  document's chunks (`ORDER BY created_at DESC LIMIT 1`); both `null` when absent. Raises for an
  unknown document (mirrors `resolve_embedding_run`'s `FileNotFoundError` pattern in
  `backend/app/embeddings/service.py`).
- [X] T007 Implement `GET /api/playground/context` route in `backend/app/playground/router.py`,
  translating the unknown-document case to `404` (depends on T005, T006).
- [X] T008 Register the playground router (`prefix="/api/playground"`) in `backend/app/main.py`
  (depends on T007).
- [X] T009 [P] Add `PlaygroundContext` type in `frontend/src/types/playground.ts`.
- [X] T010 [P] Add `getPlaygroundContext(documentId)` API client function in
  `frontend/src/lib/playgroundApi.ts` (depends on T009).
- [X] T011 Create `usePlaygroundSearch(corpusId, documentId)` hook in
  `frontend/src/hooks/usePlaygroundSearch.ts`: loads `documents` (reuse `listSources`, mirroring
  `useVectorView`'s pattern) and `context` reactively keyed on `documentId`, clearing `context`
  when `documentId` changes before the new fetch resolves (depends on T010).

**Checkpoint**: Context loads correctly for any document and resets cleanly on document switch —
both user stories can now build on this.

---

## Phase 3: User Story 1 - Ask a question and see the most similar saved chunks (Priority: P1) 🎯 MVP

**Goal**: A user can submit a query and see up to 5 ranked, deduplicated similarity results, with
a loading indicator while searching and clear error states (including a distinct "query too long"
message) on failure.

**Independent Test**: Save chunks and embeddings for a document, open the Playground, enter a
query, click send, and confirm a ranked list of up to 5 matching chunks appears (quickstart.md
Scenario 2).

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> Write these tests FIRST; confirm they FAIL before implementing.

- [X] T012 [P] [US1] Unit test for the `cosine-similarity` retrieval strategy: results ordered by
  similarity descending; capped at the requested limit; a chunk with two saved embeddings for the
  same model appears once, using its best-scoring embedding (FR-008) — in
  `backend/tests/unit/test_cosine_similarity_strategy.py`.
- [X] T013 [P] [US1] Unit test for `BertEmbeddingStrategy.fits()`: accepts a short query, rejects
  a query whose tokenized length exceeds `model_max_length` (512) — in
  `backend/tests/unit/test_bert_fits.py`.
- [X] T014 [P] [US1] Unit test for the playground service's `search()` orchestration: unknown
  document raises the not-found case; unregistered model raises the bad-model case; document with
  no saved embeddings for the model raises the unavailable case; empty/whitespace query and a
  too-long query each raise their distinct validation cases — in
  `backend/tests/unit/test_playground_service.py`.
- [X] T015 [US1] Contract test for `POST /api/playground/search` covering the success shape and
  all documented error statuses (404 unknown document, 400 unregistered model, 400 no saved
  embeddings for model, 422 empty query, 422 query too long) in
  `backend/tests/contract/test_playground_search.py` (same file as T003 — append).
- [X] T016 [P] [US1] Component test for `PlaygroundScreen`'s query field, send button, loading
  indicator, results list, and error states (generic failure and the distinct "query too long"
  message), plus that an empty/whitespace query performs no search — in
  `frontend/tests/unit/PlaygroundScreen.test.tsx`.
- [X] T017 [US1] Extend `frontend/tests/e2e/playground.spec.ts` (new file): after saving chunks
  and embeddings (reuse the pattern from `embeddings.spec.ts`), navigate to Playground, submit a
  query, and assert a ranked results list appears without further manual interaction
  (quickstart.md Scenario 2).

### Implementation for User Story 1

- [X] T018 [US1] Add `RetrievalStrategy` Protocol and `RETRIEVAL_STRATEGIES` registry in
  `backend/app/retrieval/strategies/base.py`, mirroring `app/chunking/strategies/base.py`'s
  `STRATEGIES` pattern.
- [X] T019 [US1] Implement `CosineSimilarityStrategy` in
  `backend/app/retrieval/strategies/cosine_similarity.py` using the `DISTINCT ON (chunk_id)`
  query from research.md Decision 1–2 (`Embedding.vector.cosine_distance(...)`, deduped, ordered,
  limited); register it as `RETRIEVAL_STRATEGIES["cosine-similarity"]` (depends on T018).
- [X] T020 [US1] Add `fits(self, text: str) -> bool` to the `EmbeddingModelStrategy` Protocol in
  `backend/app/embeddings/models/base.py`.
- [X] T021 [US1] Implement `fits()` in `BertEmbeddingStrategy`
  (`backend/app/embeddings/models/bert.py`) per research.md Decision 4: tokenize without
  truncation, compare `len(input_ids)` to `tokenizer.model_max_length` (depends on T020).
- [X] T022 [US1] Add `PlaygroundSearchRequest`, `SimilarityResultOut`, `PlaygroundSearchResponse`
  schemas in `backend/app/playground/schemas.py` (depends on T005 — same file).
- [X] T023 [US1] Implement `search(db, document_id, model, query) -> PlaygroundSearchResponse` in
  `backend/app/playground/service.py`: validate document exists (404 case), model registered (400
  case), query non-empty and `EMBEDDING_MODELS[model].fits(query)` (422 cases), document has
  saved embeddings for `model` (400 case); embed the query via `EMBEDDING_MODELS[model].embed([query])`;
  call `RETRIEVAL_STRATEGIES["cosine-similarity"].search(...)`; return the response (depends on
  T006, T019, T021, T022 — same file as T006).
- [X] T024 [US1] Implement `POST /api/playground/search` route in
  `backend/app/playground/router.py`, mapping `service.search`'s distinct exception types to 404,
  400, and 422 per contracts/playground-api.md (depends on T007, T023 — same file as T007).
- [X] T025 [US1] Add `searchPlayground(request)` API client function and request/response types
  (including a way to distinguish the "query too long" `422` from other failures) in
  `frontend/src/lib/playgroundApi.ts` / `frontend/src/types/playground.ts` (depends on T010, T009
  — same files).
- [X] T026 [US1] Extend `usePlaygroundSearch` with `search(query)`, `searchStatus: 'idle' |
  'searching' | 'success' | 'error' | 'query-too-long'`, `results`, and `queryEmbedding` state,
  mirroring `useChunkEmbeddings`'s status-enum pattern (research.md Decision 6); clear `results`/
  `queryEmbedding`/query text on document switch (FR-011) — in
  `frontend/src/hooks/usePlaygroundSearch.ts` (depends on T011, T025 — same file as T011).
- [X] T027 [US1] Implement the query text field, send button (disabled/no-op for empty query,
  FR-009), loading indicator, error message states, and ranked results list (content + similarity
  ranking/score per result, FR-007) in
  `frontend/src/components/playground/PlaygroundScreen.tsx`, replacing the current placeholder
  (depends on T026).

**Checkpoint**: User Story 1 fully functional and independently testable — the MVP.

---

## Phase 4: User Story 2 - See the active search context before searching (Priority: P2)

**Goal**: The selected document, its chunking strategy, and the embedding model used for its
saved embeddings are visible above the query field before any query is submitted, and update
(clearing prior query/results) when the user switches documents.

**Independent Test**: Open the Playground with a document already containing saved chunks and
embeddings, and confirm the document name, chunking strategy, and embedding model are visible
above the query field without any interaction (quickstart.md Scenario 1).

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> Write this test FIRST; confirm it FAILS before implementing.

- [X] T028 [P] [US2] Component test asserting the selected document's name, chunking strategy, and
  embedding model render above the query field with no interaction; that they update when
  `context`/`documentId` changes (simulating a document switch); and that a document with no
  saved embeddings yet shows a clear "search unavailable" message instead of blank context — in
  `frontend/tests/unit/PlaygroundScreen.test.tsx` (same file as T016 — append).

### Implementation for User Story 2

- [X] T029 [US2] Render the document/chunking-strategy/embedding-model context block above the
  query field, and the "search unavailable" message when `context.embeddingModel` is `null`, in
  `frontend/src/components/playground/PlaygroundScreen.tsx` (depends on T011's context fetch and
  T027's query field already existing — same file as T027).

**Checkpoint**: User Stories 1 AND 2 both fully functional.

---

## Phase 5: User Story 3 - See the generated query embedding for transparency (Priority: P3)

**Goal**: After a query is submitted, its generated embedding is visible in the UI, updating with
each new search.

**Independent Test**: Submit a query and confirm the generated embedding values are visible on
screen (quickstart.md Scenario 3).

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> Write this test FIRST; confirm it FAILS before implementing.

- [X] T030 [P] [US3] Component test asserting the query embedding renders after a successful
  search and updates (replacing the prior values) after a second search — in
  `frontend/tests/unit/PlaygroundScreen.test.tsx` (same file as T016/T028 — append).

### Implementation for User Story 3

- [X] T031 [US3] Render the generated query embedding (from `usePlaygroundSearch`'s
  `queryEmbedding` state, already populated by T026's search response handling) in
  `frontend/src/components/playground/PlaygroundScreen.tsx` (depends on T026, T027 — same file).

**Checkpoint**: All three user stories functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T032 [P] Run quickstart.md's 5 scenarios manually against the running dev servers.
- [X] T033 Run the full backend suite (`pytest`) and frontend suite (`vitest` + `playwright`) to
  confirm no regressions in existing Chunking/Embeddings/Vector View coverage.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories** — both US1 and US2
  need the context lookup it builds.
- **User Story 1 (Phase 3)**: Depends on Foundational. Can proceed independently of US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational *and* on T027 (US1's query field) existing
  in `PlaygroundScreen.tsx`, since T029 adds a block above it in the same file — not parallel with
  US1 in practice, even though it has no *conceptual* dependency on search working.
- **User Story 3 (Phase 5)**: Depends on Foundational *and* on T026/T027 (US1's search-response
  handling and screen) — same-file/same-data reason as US2.
- **Polish (Phase 6)**: Depends on all three user stories.

### Within Each Phase

- Tests MUST be written and FAIL before their corresponding implementation task.
- Within US1: retrieval strategy (T018–T019) and `fits()` (T020–T021) are independent of each
  other (different files) but both must land before the service orchestration (T023) that uses
  them; schemas (T022) before the service (T023); service before the route (T024); backend route
  before the frontend can be meaningfully tested end-to-end (T017), though the frontend
  implementation tasks (T025–T027) can be written in parallel with backend work since they're
  different files, wiring together at T026/T027.

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T003 and T004 (Foundational tests) in parallel — different files (backend contract test vs.
  frontend hook test).
- T009 and T010 can proceed in parallel with T005–T008 (frontend types/client vs. backend
  schema/service/route/registration — different files).
- Within US1: T012, T013, T014, T016 are all independent test files and can be drafted together;
  T018–T019 (retrieval) and T020–T021 (`fits()`) are independent backend work; T025 (frontend
  API client) can proceed in parallel with T018–T024 (backend), converging at T026.
- US2's test (T028) and US3's test (T030) can be drafted in parallel with each other and with
  US1's tests, even though their *implementation* tasks (T029, T031) are sequenced after T027 by
  shared-file necessity.

---

## Parallel Example: Foundational

```bash
# Backend and frontend foundational tracks proceed independently:
Track A (backend): T003 -> T005 -> T006 -> T007 -> T008
Track B (frontend): T004 -> T009 -> T010 -> T011
# T011 needs T010's client, so Track B's last step waits on its own T010, not on Track A.
```

## Parallel Example: User Story 1

```bash
# Backend retrieval/validation work, independent files:
Task: "RetrievalStrategy protocol + registry in backend/app/retrieval/strategies/base.py (T018)"
Task: "fits() protocol addition in backend/app/embeddings/models/base.py (T020)"

# Once both land, each has its own implementation:
Task: "CosineSimilarityStrategy in backend/app/retrieval/strategies/cosine_similarity.py (T019)"
Task: "BertEmbeddingStrategy.fits() in backend/app/embeddings/models/bert.py (T021)"
```

---

## Implementation Strategy

### MVP First (Setup + Foundational + User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (context lookup, both backend and frontend).
3. Complete Phase 3: User Story 1 — write T012–T017, watch them fail, implement T018–T027, watch
   them pass.
4. **STOP and VALIDATE**: run quickstart.md Scenario 2 and Scenario 4 manually.
5. This alone delivers the core value: ask a question, get ranked results, with proper
   loading/error/query-too-long handling.

### Incremental Delivery

1. Setup + Foundational → context lookup ready.
2. US1 → validate → MVP: search works end-to-end.
3. US2 → validate → context is now visible, not just functionally used internally.
4. US3 → validate → query embedding visible for transparency.
5. Polish (T032–T033) → confirm no regressions anywhere else in the app.

### Parallel Team Strategy

Because US2 and US3 both add to `PlaygroundScreen.tsx` after US1's query field/results exist,
true multi-person parallelism is limited to: one track on Foundational's backend half, one on its
frontend half, then (within US1) one track on backend retrieval/validation, one on the frontend
API client/hook — converging before US2/US3 can start their same-file additions.

---

## Notes

- [P] tasks touch different files with no ordering dependency; tasks without `[P]` either share a
  file with an earlier task or have a genuine data dependency.
- Both new backend packages (`app/playground/`, `app/retrieval/`) intentionally mirror the
  existing `app/chunking/` and `app/embeddings/` package shapes — no new architectural pattern is
  introduced.
- Commit after each task or logical group, per repository convention observed in prior features.
- Verify tests fail before implementing — the constitution's Test-First gate, not optional here.
