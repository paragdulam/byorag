# Tasks: Playground Split-Screen Chat Interface

**Input**: Design documents from `/specs/017-playground-chat-interface/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/playground-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level —
NON-NEGOTIABLE), tests are mandatory for every story at the appropriate level(s) and MUST be
written before the implementation they cover.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3) — omitted for Setup,
  Foundational, and Polish tasks
- File paths are exact and relative to the repository root

---

## Phase 1: Setup

**Purpose**: Backend dependency and configuration groundwork for LLM generation.

- [X] T001 Add the `anthropic` SDK as a dependency in `backend/pyproject.toml`
- [X] T002 [P] Add `generation_provider` (env `GENERATION_PROVIDER`, default `"anthropic"`),
  `anthropic_api_key` (env `ANTHROPIC_API_KEY`, default `""`), and `anthropic_model` (env
  `ANTHROPIC_MODEL`, default a current Claude model id) to `Settings` in `backend/app/config.py`
  (research.md Decision 4)
- [X] T003 [P] Add `ANTHROPIC_API_KEY`, `GENERATION_PROVIDER`, and `ANTHROPIC_MODEL` to the
  `backend` service's `environment` block in `docker-compose.yml`
- [X] T004 [P] Delete `backend/tests/contract/test_playground_search.py` (superseded by
  research.md Decision 2 — replaced by `test_playground_turns.py` in Phase 3/5 below)

**Checkpoint**: Backend is configured to reach Anthropic's API; obsolete 016 contract test removed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence model, the pluggable generation layer, and the split-screen shell that
every user story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 [P] Add `ConversationTurn` and `ConversationTurnChunk` SQLAlchemy models to
  `backend/app/db/models.py`, per data-model.md (snapshot fields `chunk_index`/`content` on
  `ConversationTurnChunk`, nullable best-effort `chunk_id`/`embedding_id` FKs with
  `ondelete=SET NULL`, `ConversationTurn.document_id` FK with `ondelete=CASCADE`, indices on
  `(document_id, created_at)` and `(turn_id, rank)`)
- [X] T006 [P] Unit test for `AnthropicProvider` (mocked Anthropic client — no real network calls)
  covering prompt/response handling and a `GenerationError` on API failure, in
  `backend/tests/unit/test_anthropic_provider.py` — write first; it will fail until T007–T009 exist
- [X] T007 Create the `GenerationProvider` Protocol, `GenerationResult` NamedTuple,
  `GENERATION_PROVIDERS` registry, and `GenerationError` in
  `backend/app/generation/providers/base.py` (research.md Decision 3)
- [X] T008 [P] Create `backend/app/generation/__init__.py` (empty package init)
- [X] T009 Implement `AnthropicProvider` (builds on the `anthropic` SDK, reads
  `settings.anthropic_api_key`/`anthropic_model`) in
  `backend/app/generation/providers/anthropic_provider.py`, satisfying T006's test (depends on
  T001, T002, T007)
- [X] T010 Create `backend/app/generation/providers/__init__.py` registering `"anthropic"` into
  `GENERATION_PROVIDERS` on import, mirroring `app/embeddings/models/__init__.py`'s
  registration-on-import pattern (depends on T009)
- [X] T011 [P] Rewrite `backend/app/playground/schemas.py`: `TurnChunkOut`, `TurnOut`,
  `CreateTurnRequest`, `ListTurnsResponse` (contracts/playground-api.md); keep
  `PlaygroundContextResponse` unchanged
- [X] T012 [P] Add `Turn` and `TurnChunk` types (mirroring `TurnOut`/`TurnChunkOut`) to
  `frontend/src/types/playground.ts`, alongside the existing `PlaygroundContext` type
- [X] T013 Build the two-panel split-screen shell — a left container for the conversation and a
  right container for retrieval details, both initially empty — in
  `frontend/src/components/playground/PlaygroundScreen.tsx`, removing the prior single-column 016
  layout (FR-001; depends on T012)

**Checkpoint**: DB schema, generation provider registry, shared schemas/types, and the split-screen
shell are ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Ask a question and get an answer grounded in retrieved context (Priority: P1) 🎯 MVP

**Goal**: Typing a question and clicking Send retrieves and persists a turn (question + chunks +
query embedding); clicking Generate sends that turn to the LLM and displays the answer directly
below the question in the left panel.

**Independent Test**: Open the Playground, type a question, click Send, wait for chunks to be
retrieved, click Generate, and confirm an answer appears in the left panel attached to that
specific question.

### Tests for User Story 1 (write first — MUST fail before implementation) ⚠️

- [X] T014 [P] [US1] Contract test for `POST /api/playground/turns` (success + all documented
  error statuses: 404, 400 ×2, 422 ×2) in `backend/tests/contract/test_playground_turns.py`
  (contracts/playground-api.md)
- [X] T015 [P] [US1] Contract test for `POST /api/playground/turns/{turnId}/generate` (success,
  404 unknown turn, 400 zero-chunk turn, 502 provider failure) in
  `backend/tests/contract/test_playground_generate.py`
- [X] T016 [P] [US1] Unit tests for `service.create_turn` (persists the correct turn + chunk
  snapshots) and `service.generate_answer` (persists prompt/answer on success, prompt/error on
  failure, using a mocked `GenerationProvider`) in `backend/tests/unit/test_playground_service.py`
- [X] T017 [P] [US1] Hook test for send/generate/retry status transitions and the busy-lock
  (FR-013: Send and Generate disabled while a request is in flight) in
  `frontend/tests/unit/usePlaygroundConversation.test.ts`
- [X] T018 [P] [US1] Component test for the ask → retrieve → Generate → answer flow, including the
  loading indicator and single-block (non-streamed) answer reveal, in
  `frontend/tests/unit/PlaygroundScreen.test.tsx`
- [X] T019 [P] [US1] Extend `frontend/tests/e2e/playground.spec.ts`: ask a question, click
  Generate, confirm the answer appears attached to that question

### Implementation for User Story 1

- [X] T020 [US1] Implement `service.create_turn` in `backend/app/playground/service.py`: validate
  (reusing 016's document/model/empty-query/query-too-long checks), embed the query via
  `EMBEDDING_MODELS`, retrieve via `RETRIEVAL_STRATEGIES["cosine-similarity"]`, persist a new
  `ConversationTurn` plus its `ConversationTurnChunk` snapshots (depends on T005, T011)
- [X] T021 [US1] Implement `service.generate_answer` in `backend/app/playground/service.py`: build
  the deterministic prompt from the turn's question + chunk snapshots (research.md Decision 5),
  call `GENERATION_PROVIDERS[settings.generation_provider]`, persist `llm_provider`/`llm_model`/
  `prompt`/`answer`/`answered_at` on success or `prompt`/`error` on failure, reject turns with zero
  chunks (depends on T007, T010, T020)
- [X] T022 [US1] Add `POST /api/playground/turns` and `POST /api/playground/turns/{turnId}/generate`
  endpoints (and remove the retired `POST /search` route) in `backend/app/playground/router.py`
  (depends on T020, T021)
- [X] T023 [US1] Implement `createTurn()` and `generateAnswer()` in
  `frontend/src/lib/playgroundApi.ts`, removing the retired `searchPlayground()` (depends on T012)
- [X] T024 [US1] Implement `usePlaygroundConversation` (replacing and deleting
  `frontend/src/hooks/usePlaygroundSearch.ts` and
  `frontend/tests/unit/usePlaygroundSearch.test.ts`): manages the turn list, send, generate,
  retry-on-failure, and the screen-level busy-lock (FR-013) in
  `frontend/src/hooks/usePlaygroundConversation.ts` (depends on T023)
- [X] T025 [US1] Build `ConversationPanel.tsx`: the question textfield and send button pinned to
  the bottom of the left panel, rendering the turn list in order, in
  `frontend/src/components/playground/ConversationPanel.tsx` (depends on T024)
- [X] T026 [US1] Build `TurnBubble.tsx`: renders one turn's question, its loading/answer/error
  state, and a retry control on failure, in
  `frontend/src/components/playground/TurnBubble.tsx` (depends on T024)
- [X] T027 [US1] Build a minimal `RetrievalPanel.tsx` (Generate control wired to the active turn,
  disabled when the turn has zero retrieved chunks — FR-015) and wire `ConversationPanel` +
  `RetrievalPanel` into the `PlaygroundScreen` split layout in
  `frontend/src/components/playground/RetrievalPanel.tsx` and
  `frontend/src/components/playground/PlaygroundScreen.tsx` (depends on T013, T024, T025, T026)

**Checkpoint**: User Story 1 is fully functional and independently testable — ask a question, get
a generated answer.

---

## Phase 4: User Story 2 - Inspect retrieved chunks and the query embedding before generating an answer (Priority: P2)

**Goal**: The right panel shows retrieved chunks as chunk IDs (each with its own "Show more") and
a 2-row query-embedding preview (with its own "Show more"), in the order Generate → chunks →
embedding; clicking any past answer re-populates the right panel with that turn's own retrieval
data.

**Independent Test**: Send a question and confirm the right side shows chunk IDs with individual
"Show more" controls and a query-embedding preview limited to 2 rows with its own "Show more," all
without clicking Generate; then click an earlier generated answer and confirm the right panel
switches to that turn's data.

### Tests for User Story 2 (write first — MUST fail before implementation) ⚠️

- [X] T028 [P] [US2] Component tests for `RetrievalPanel`: chunk list shows chunk ID only by
  default with a per-chunk "Show more" revealing full content, query-embedding preview shows at
  most 2 rows by default with a "Show more" revealing the rest, and the top-to-bottom layout order
  is Generate → chunks → embedding, in `frontend/tests/unit/PlaygroundScreen.test.tsx`
- [X] T029 [P] [US2] Hook test for turn selection — clicking a past answer updates the
  selected/displayed turn using already-loaded data, with no new network call — in
  `frontend/tests/unit/usePlaygroundConversation.test.ts`
- [X] T030 [P] [US2] Extend `frontend/tests/e2e/playground.spec.ts`: ask two questions, click the
  first (older) generated answer, and confirm the right panel shows that turn's chunks/embedding
  rather than the newest turn's

### Implementation for User Story 2

- [X] T031 [US2] Implement the chunk list (chunk ID default, per-chunk "Show more" reveals
  content) and the query-embedding preview (2-row default, "Show more" reveals the rest) in
  `frontend/src/components/playground/RetrievalPanel.tsx` (depends on T027)
- [X] T032 [US2] Add `selectedTurnId` state to `usePlaygroundConversation`, defaulting to the
  newest turn and updatable by turn selection, in
  `frontend/src/hooks/usePlaygroundConversation.ts` (depends on T024)
- [X] T033 [US2] Make each answered `TurnBubble` clickable/tappable to select its turn (FR-018) in
  `frontend/src/components/playground/TurnBubble.tsx` (depends on T026, T032)
- [X] T034 [US2] Wire `RetrievalPanel` to render the currently selected turn's chunks, query
  embedding, LLM used, and prompt sent in
  `frontend/src/components/playground/PlaygroundScreen.tsx` (depends on T031, T032)

**Checkpoint**: User Stories 1 and 2 both work independently — retrieval is fully inspectable, and
any past turn's process can be revisited.

---

## Phase 5: User Story 3 - Continue an ongoing, persisted conversation (Priority: P3)

**Goal**: Conversations survive navigation and reloads; opening the Playground for a document
automatically loads its full prior conversation, and switching documents shows that document's own
conversation.

**Independent Test**: Complete one question/answer cycle, send a second question, reload the
Playground, and confirm the same conversation reappears automatically for that document.

### Tests for User Story 3 (write first — MUST fail before implementation) ⚠️

- [X] T035 [P] [US3] Contract test for `GET /api/playground/turns` (chronological ordering, empty
  conversation, 404 unknown document) appended to
  `backend/tests/contract/test_playground_turns.py`
- [X] T036 [P] [US3] Unit test for `service.list_turns` ordering and response shape in
  `backend/tests/unit/test_playground_service.py`
- [X] T037 [P] [US3] Integration test for the full cycle — create turn → generate → list turns →
  confirm the reloaded turn matches what was persisted, including after the turn's original
  `Chunk` rows are deleted by a re-chunk (research.md Decision 1's snapshot guarantee) — in
  `backend/tests/integration/test_playground_conversation_persistence.py`
- [X] T038 [P] [US3] Hook test for auto-loading a document's persisted turns on mount and on
  document switch (and resetting to an empty conversation for a document with none) in
  `frontend/tests/unit/usePlaygroundConversation.test.ts`
- [X] T039 [P] [US3] Extend `frontend/tests/e2e/playground.spec.ts`: ask two questions with
  generated answers, reload the page, confirm both persist automatically; switch to a different
  document and confirm its own (empty or separate) conversation is shown

### Implementation for User Story 3

- [X] T040 [US3] Implement `service.list_turns` in `backend/app/playground/service.py`: return a
  document's turns ordered by `created_at` ascending, each with its chunk snapshots ordered by
  `rank` (depends on T005, T011)
- [X] T041 [US3] Add `GET /api/playground/turns` endpoint in `backend/app/playground/router.py`
  (depends on T040)
- [X] T042 [US3] Implement `listTurns()` in `frontend/src/lib/playgroundApi.ts` (depends on T012)
- [X] T043 [US3] Load a document's persisted conversation automatically on mount and on document
  switch (clearing the right panel and resetting `selectedTurnId` appropriately) in
  `frontend/src/hooks/usePlaygroundConversation.ts` (depends on T032, T042)

**Checkpoint**: All three user stories are independently functional — the full split-screen chat
experience persists across sessions.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup once all three stories are complete.

- [X] T044 [P] Run all five quickstart.md validation scenarios end-to-end — via the dev-mode
  backend/frontend servers (Docker was unavailable in this environment) with a deliberately
  unconfigured `ANTHROPIC_API_KEY` for Scenario 4
- [X] T045 [P] Final cleanup pass: confirm no remaining references to the retired
  `POST /api/playground/search` contract, `searchPlayground()`, or `usePlaygroundSearch` anywhere
  in backend/frontend source or tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational completion
  - US1 has no dependency on US2/US3
  - US2 depends on US1's turn data existing to select from (RetrievalPanel skeleton, hook, turn
    bubbles) — built on top of US1's files, not independently deployable before US1
  - US3 depends on US1's `create_turn`/turn shape existing, but its own list/reload behavior is
    additive and doesn't modify US1/US2's send/generate/select logic
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Start after Foundational — no dependency on US2/US3
- **User Story 2 (P2)**: Start after US1 — extends `RetrievalPanel`/`TurnBubble`/the hook that US1
  creates; not independently meaningful without a turn already existing to inspect
- **User Story 3 (P3)**: Start after US1 — extends the hook/API client with list/reload; can be
  built in parallel with US2 by a different developer since it touches a largely disjoint set of
  functions (`list_turns`/`listTurns`/mount-time loading vs. US2's selection/display logic), though
  both ultimately touch `usePlaygroundConversation.ts`

### Within Each User Story

- Tests MUST be written and FAIL before implementation (constitution Principle II)
- Backend service before backend router before frontend API client before frontend hook before
  frontend components
- Story complete and checkpoint-verified before moving to the next priority

### Parallel Opportunities

- Setup: T002, T003, T004 in parallel (T001 first, since T002/T009 depend on the dependency being
  declared)
- Foundational: T005, T006, T008, T011, T012 in parallel; T007/T009/T010 are sequential (registry
  → provider → registration); T013 depends on T012
- Once Foundational completes, all Phase 3 (US1) test tasks (T014-T019) can run in parallel
- US2 and US3 implementation can proceed in parallel by different developers once US1's checkpoint
  is reached (see User Story Dependencies above)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for POST /api/playground/turns in backend/tests/contract/test_playground_turns.py"
Task: "Contract test for POST /api/playground/turns/{turnId}/generate in backend/tests/contract/test_playground_generate.py"
Task: "Unit tests for service.create_turn and service.generate_answer in backend/tests/unit/test_playground_service.py"
Task: "Hook test for send/generate/retry/busy-lock in frontend/tests/unit/usePlaygroundConversation.test.ts"
Task: "Component test for ask -> generate -> answer flow in frontend/tests/unit/PlaygroundScreen.test.tsx"
Task: "Extend e2e playground.spec.ts for ask -> generate -> answer"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Ask a question, click Generate, confirm the answer appears — Scenario 1
   of quickstart.md (steps 1-7)
5. Deploy/demo if ready — this alone already delivers the core "ask a question, get a grounded
   answer" value

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate independently → MVP demo
3. Add US2 → validate independently (chunk/embedding inspection, revisit past turns) → demo
4. Add US3 → validate independently (persistence/reload) → demo
5. Each story adds value without breaking the previous stories' behavior

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once US1's checkpoint is reached:
   - Developer A: User Story 2 (RetrievalPanel depth + turn selection)
   - Developer B: User Story 3 (list/reload persistence)
3. Both integrate into the same `usePlaygroundConversation.ts`/`PlaygroundScreen.tsx` — coordinate
   on that file to avoid conflicting edits, or sequence US2 then US3 if working solo

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task
- [Story] label maps each task to its user story for traceability
- Verify each test fails before writing the implementation that makes it pass
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
- `backend/tests/contract/test_playground_turns.py`,
  `frontend/tests/unit/usePlaygroundConversation.test.ts`, and
  `frontend/tests/unit/PlaygroundScreen.test.tsx` are each extended across multiple phases (US1
  then US2/US3) — this is expected; phases run sequentially, so there's no concurrent-edit conflict
