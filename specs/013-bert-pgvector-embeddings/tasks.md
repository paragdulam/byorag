---

description: "Task list template for feature implementation"
---

# Tasks: Generate and Save Chunk Embeddings

**Input**: Design documents from `/specs/013-bert-pgvector-embeddings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/embeddings-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included below for every user story, at unit, contract, integration, and
component levels as appropriate.

**Organization**: Tasks are grouped by user story (US1, US2, US3 from spec.md) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in every task description

## Path Conventions

Existing web-application layout (unchanged from `001`–`012`): `backend/app/...` +
`backend/tests/...`, `frontend/src/...` + `frontend/tests/...`. This feature adds a new
`backend/app/embeddings/` and `frontend/src/components/embeddings/` vertical slice, mirroring the
existing `chunking` slice's shape (plan.md Project Structure).

---

## Phase 1: Setup

**Purpose**: Add the new dependencies and infrastructure this feature needs before any code change.

- [X] T001 [P] Add `transformers`, `torch`, and `pgvector` to `backend/pyproject.toml` dependencies; run `cd backend && uv sync`
- [X] T002 [P] Update `docker-compose.yml`'s `postgres` service image from `postgres:16` to `pgvector/pgvector:pg16` (plan.md — the plain image doesn't ship the `vector` extension)
- [X] T003 Verify the backend still starts and the existing test suite passes after the dependency additions: `cd backend && uv sync && pytest` (baseline green before any feature code). Note: this machine's local (non-Docker) Postgres is a shared homebrew instance where the `byorag` app role isn't superuser, so `CREATE EXTENSION vector` had to be bootstrapped once manually as a superuser role in both the `byorag` and `byorag_e2e` databases — confirmed `CREATE EXTENSION IF NOT EXISTS vector` then succeeds when re-run as the low-privilege `byorag` role once the extension already exists (Postgres short-circuits the privilege check). In Docker Compose, `POSTGRES_USER=byorag` is the initdb-created superuser, so no such bootstrap is needed there.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and registry infrastructure every user story depends on — the `vector`
extension, the `embeddings` table, and the pluggable embedding-model registry with its one
registered model (BERT).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Add `CREATE EXTENSION IF NOT EXISTS vector` execution to the backend startup lifespan in `backend/app/main.py`, running before `Base.metadata.create_all(engine)` so the `vector` column type is available when the schema is created. Implemented as `ensure_vector_extension()` in `backend/app/db/base.py`, reused by T005.
- [X] T005 Add the same `CREATE EXTENSION IF NOT EXISTS vector` call to the `_db_schema` test fixture in `backend/tests/conftest.py`, before its own `Base.metadata.create_all(engine)` call, so tests can create the `embeddings` table too
- [X] T006 Add an `Embedding` model to `backend/app/db/models.py` (`id` UUID pk, `chunk_id` UUID FK → `chunks.id` `ondelete="CASCADE"` indexed, `model` string, `vector` `pgvector.sqlalchemy.Vector(768)`, `created_at` timestamptz) and add `Chunk.embeddings: Mapped[list["Embedding"]]` relationship with `cascade="all, delete-orphan"` (data-model.md)
- [X] T007 [P] Add `EmbeddingModelStrategy` protocol (`embed(texts: list[str]) -> Iterator[tuple[int, list[float]]]`) and an `EMBEDDING_MODELS: dict[str, EmbeddingModelStrategy]` registry in `backend/app/embeddings/models/base.py`, mirroring `backend/app/chunking/strategies/base.py`; also create `backend/app/embeddings/__init__.py` and `backend/app/embeddings/models/__init__.py`. Also added `EMBEDDING_MODEL_LABELS` dict alongside the registry for the picker's human-readable labels (needed by T016).
- [X] T008 [P] Add a unit test asserting `BertEmbeddingStrategy().embed(["short text", "another"])` yields one `(index, vector)` pair per input text, each `vector` has exactly 768 floats, and calling it twice with the same text produces the same vector (determinism) — `backend/tests/unit/test_bert_embedding_strategy.py` (write first; fails until T009)
- [X] T009 Implement `BertEmbeddingStrategy` in `backend/app/embeddings/models/bert.py` (research.md §1): lazily loads and caches `bert-base-uncased`'s tokenizer + model as instance state on first use; `embed()` tokenizes (with truncation), runs a forward pass, mean-pools the last hidden state over non-padding tokens per text, and yields `(index, vector)` incrementally; registers `EMBEDDING_MODELS["bert"] = BertEmbeddingStrategy()` (depends on T007; makes T008 pass)

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - View a document's saved chunks and choose an embedding model (Priority: P1) 🎯 MVP start

**Goal**: Open the Embeddings screen, pick a document from a dropdown, see its saved chunks, and
pick an embedding model from a dropdown pre-selecting BERT.

**Independent Test**: Open the Embeddings screen, switch the document dropdown between two
documents that both have saved chunks, and confirm the displayed chunk list and model dropdown are
correct for the currently selected document — no generation or saving required.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T010 [P] [US1] Contract tests for `GET /api/chunking/saved-chunks`: returns a document's saved chunks in `index` order (upload + save via the existing `012` flow), returns `{"chunks": []}` for a document with none, `404` for an unknown `documentId` — `backend/tests/contract/test_chunking_saved_chunks.py` (new)
- [X] T011 [P] [US1] Contract test for `GET /api/embeddings/models`: returns `{"models": [{"id": "bert", "label": "BERT (bert-base-uncased)"}]}` — `backend/tests/contract/test_embeddings_models.py` (new)
- [X] T012 [P] [US1] Frontend hook tests for `useChunkEmbeddings`: loads the document list (reusing the existing sources list for the active corpus), loads model options and pre-selects the first, and loads saved chunks whenever the selected document changes — `frontend/tests/unit/useChunkEmbeddings.test.ts` (new)
- [X] T013 [US1] Frontend component tests for `EmbeddingsScreen`: renders a document dropdown, a model dropdown (BERT pre-selected), the selected document's saved chunks with content and position, and a clear "no saved chunks" message (not a broken/empty list) when the selected document has none — `frontend/tests/unit/EmbeddingsScreen.test.tsx` (rewritten in place — this file previously tested the old "coming soon" placeholder screen, now fully superseded)

### Implementation for User Story 1

- [X] T014 [US1] Add `list_saved_chunks(db: Session, document_id: str) -> list[ChunkRow]` to `backend/app/chunking/service.py`, ordered by `index`
- [X] T015 [US1] Add `GET /api/chunking/saved-chunks` route to `backend/app/chunking/router.py`: `404` for an unknown `documentId` (via the existing `get_document_or_none`), else `{"chunks": [...]}` (empty list is a normal response, not an error) (depends on T014; makes T010 pass)
- [X] T016 [US1] Add response schemas to a new `backend/app/embeddings/schemas.py` — `EmbeddingModelOption`, `ListModelsResponse`, `EmbeddingVectorOut`, `EmbeddingGenerateResult`, `EmbeddingSaveResult` (data-model.md; defining all of them now, even though generate/save aren't wired until US2/US3, avoids repeatedly editing this file across stories) — and add a new `backend/app/embeddings/router.py` with `GET /api/embeddings/models`, returning `EMBEDDING_MODELS`' registered keys with a human label map (depends on T007; makes T011 pass)
- [X] T017 [US1] Register the new embeddings router in `backend/app/main.py` (`app.include_router(embeddings_router)`)
- [X] T018 [P] [US1] Add `frontend/src/types/embeddings.ts` (`EmbeddingModelOption`, `SavedChunk`, `EmbeddingVector`, `EmbeddingGenerateResult`, `EmbeddingSaveResult` — data-model.md)
- [X] T019 [US1] Add `listSavedChunks(documentId)` to `frontend/src/lib/chunkingApi.ts` (calls the new `/api/chunking/saved-chunks`) and `listEmbeddingModels()` to a new `frontend/src/lib/embeddingsApi.ts` (calls `/api/embeddings/models`) (depends on T018; makes part of T012 pass)
- [X] T020 [US1] Implement `useChunkEmbeddings(corpusId, documentId)` in `frontend/src/hooks/useChunkEmbeddings.ts`: loads documents via the existing `listSources`, loads model options via `listEmbeddingModels` (pre-selecting the first), and loads saved chunks via `listSavedChunks` whenever `documentId` changes (depends on T019; makes T012 pass). Note: `documentId` is a reactive hook parameter (mirrors `useFixedSizeChunking(corpusId)`'s pattern) — document/model *selection* state itself still lives in the screen component, consistent with how chunk size/overlap selection lives in `FixedSizeChunkingScreen`, not its hook.
- [X] T021 [US1] Move `frontend/src/components/chunking/EmbeddingsScreen.tsx` to `frontend/src/components/embeddings/EmbeddingsScreen.tsx` and implement: document dropdown (mirrors `FixedSizeChunkingScreen`'s pattern), model dropdown, saved-chunk list display (content + position), and a clear empty-state message when the selected document has no saved chunks; update the import path in `frontend/src/app/App.tsx` (depends on T020; makes T013 pass). Also fixed a gap this exposed: `frontend/tests/setup.ts`'s global default `fetch` mock (used by integration tests that don't stub the hook directly) didn't know about `/api/embeddings/models` or `/api/chunking/saved-chunks`, so it fell through to an unrelated fallback response and crashed `EmbeddingsScreen` in `tests/integration/App.test.tsx`; added proper default responses for both, and updated that test's stale "coming soon" placeholder assertion to match the real screen.

**Checkpoint**: User Story 1 is fully functional and independently testable — the screen shows the
right chunks and model options for whichever document is selected, with no generation or saving.

---

## Phase 4: User Story 2 - Generate an embeddings preview with visible progress (Priority: P1)

**Goal**: Click "Generate Embeddings" to compute (not persist) embeddings for the displayed
chunks, with a visible per-chunk progress indicator.

**Independent Test**: Click "Generate Embeddings" for a document's saved chunks and confirm a
progress indicator appears while it runs, a completed preview is shown afterward, and nothing is
persisted to the `embeddings` table as a result of generating alone.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T022 [P] [US2] Contract tests for `GET /api/embeddings/generate/stream`: `progress` events with non-decreasing `percent` then a terminal `result` event with one 768-value vector per saved chunk; `400` for an unregistered `model`; `400` for a document with zero saved chunks; `404` for an unknown `documentId` — `backend/tests/contract/test_embeddings_generate.py` (new)
- [X] T023 [P] [US2] Unit tests for `resolve_embedding_run` and `stream_generate` in `backend/tests/unit/test_embeddings_service.py` (new): validates the model/document/no-saved-chunks error cases, and confirms a full `stream_generate` run writes zero rows to the `embeddings` table
- [X] T024 [US2] Frontend hook tests for `useChunkEmbeddings`'s `generate()`: `generateStatus`/progress updates as events arrive, terminal preview populates `vectors` (one per saved chunk), a second `generate()` call replaces the previous unsaved preview, and `generate()` is unavailable when there are no saved chunks — `frontend/tests/unit/useChunkEmbeddings.test.ts` (same file as T012, sequenced after)
- [X] T025 [US2] Frontend component tests for `EmbeddingsScreen`: "Generate Embeddings" is disabled when the selected document has no saved chunks, shows a progress indicator while generating, and shows a completed-but-unsaved state after a successful generate — `frontend/tests/unit/EmbeddingsScreen.test.tsx` (same file as T013, sequenced after)

### Implementation for User Story 2

- [X] T026 [US2] Add `resolve_embedding_run(db: Session, document_id: str, model: str) -> tuple[Document, list[ChunkRow]]` to a new `backend/app/embeddings/service.py`: raises `ValueError` for an unregistered `model`, `FileNotFoundError` for an unknown document, `ValueError` for a document with zero saved chunks (reuses `list_saved_chunks` from T014)
- [X] T027 [US2] Add `stream_generate(chunks: list[ChunkRow], model: str) -> Iterator[StreamEvent]` to `backend/app/embeddings/service.py`: calls `EMBEDDING_MODELS[model].embed([c.content for c in chunks])`, yields a `progress` event per chunk embedded (`percent = round(embedded / total * 100)`), then a terminal `result` event with the full vector list — no persistence (depends on T009, T026; makes T022/T023 pass)
- [X] T028 [US2] Add `GET /api/embeddings/generate/stream` route to `backend/app/embeddings/router.py`: pre-stream validation mapping `resolve_embedding_run`'s exceptions to `400`/`404` (contracts/embeddings-api.md), then SSE via `stream_generate` (depends on T027; makes T022 pass)
- [X] T029 [P] [US2] Add `generateEmbeddingsStream(documentId, model, handlers)` to `frontend/src/lib/embeddingsApi.ts` (`EventSource`-based, mirrors `runChunkingStream`) (depends on T018)
- [X] T030 [US2] Add `generate()`, `generateStatus`, `progressPercent`, and `preview` state to `useChunkEmbeddings` (depends on T029, T020; makes T024 pass)
- [X] T031 [US2] Wire a "Generate Embeddings" button, progress bar, and preview display into `EmbeddingsScreen.tsx`'s bottom action bar (mirrors `FixedSizeChunkingScreen`'s "Re-Calculate Chunks" bar) (depends on T030, T021; makes T025 pass)

**Checkpoint**: User Stories 1 AND 2 both work independently — the right chunks/models are shown,
and generating a preview is a safe, repeatable, non-persisting action with visible progress.

---

## Phase 5: User Story 3 - Save generated embeddings, keeping history per chunk (Priority: P2)

**Goal**: Click "Save" to persist the generated preview, with its own visible progress, and have
saves accumulate per chunk rather than overwrite — a chunk can end up with several saved
embeddings over time.

**Independent Test**: Generate and save embeddings for a document with one model, then generate
and save again (same or different model), and confirm both saved batches are still retrievable for
those chunks afterward — not just the most recent one.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T032 [P] [US3] Contract tests for `GET /api/embeddings/save/stream`: `progress` events then a terminal `result` event with `savedCount` equal to the saved-chunk count; persisted rows are queryable via a fresh `db_session`; a second save with the same model produces **double** the row count (accumulate, not replace); the same `400`/`404` validation cases as generate — `backend/tests/contract/test_embeddings_save.py` (new)
- [X] T033 [P] [US3] Unit tests for `save_embeddings` in `backend/tests/unit/test_embeddings_service.py` (same file as T023, sequenced after): persists exactly one `Embedding` row per chunk tagged with the given model, a second call adds more rows rather than replacing existing ones
- [X] T034 [US3] Integration test proving saved embeddings are readable from a brand-new `SessionLocal()` session, independent of the request session that created them (mirrors `012-save-chunks-button`'s `test_restart_persistence.py`) — `backend/tests/integration/test_embeddings_persistence.py` (new)
- [X] T035 [US3] Frontend hook tests for `useChunkEmbeddings`'s `save()`: a no-op before any successful `generate()`, `saveStatus` transitions `idle → saving → success`/`error`, and saving embeddings never touches any Chunking-screen state (no shared hook/state with `useFixedSizeChunking`) — `frontend/tests/unit/useChunkEmbeddings.test.ts` (same file as T012/T024, sequenced after)
- [X] T036 [US3] Frontend component tests for `EmbeddingsScreen`: "Save" is disabled with no generated preview, shows its own progress indicator while saving, shows a clear error message on failure, and its progress/state is entirely independent of anything the Chunking screen renders (spec FR-008, User Story 3 Acceptance Scenario 4) — `frontend/tests/unit/EmbeddingsScreen.test.tsx` (same file as T013/T025, sequenced after)

### Implementation for User Story 3

- [X] T037 [US3] Add `save_embeddings(db: Session, chunks: list[ChunkRow], model: str) -> Iterator[StreamEvent]` to `backend/app/embeddings/service.py`: factored a shared `_stream_embed()` helper reused by both `stream_generate` and `save_embeddings` (research.md §6 — reuse, don't duplicate, the embedding loop), then inserts one new `Embedding` row per chunk (never deletes or updates any existing row for that chunk/model), commits, and yields a terminal `result` event with `savedCount` (depends on T027, T006)
- [X] T038 [US3] Add `GET /api/embeddings/save/stream` route to `backend/app/embeddings/router.py`: same pre-stream validation as generate, SSE via `save_embeddings`, mid-stream `error` event on a persistence failure (depends on T037, T028; makes T032 pass)
- [X] T039 [US3] Add `saveEmbeddingsStream(documentId, model, handlers)` to `frontend/src/lib/embeddingsApi.ts` (depends on T029)
- [X] T040 [US3] Add `save()`, `saveStatus`, and `saveProgressPercent` to `useChunkEmbeddings`, kept entirely independent of `useFixedSizeChunking`'s state (no shared store/context between the two screens); `save()` persists the current `preview` (its own `documentId`/`model`), so it takes no arguments (depends on T039, T030; makes T035 pass)
- [X] T041 [US3] Wire a "Save" button, its own progress indicator, and error messaging into `EmbeddingsScreen.tsx`'s bottom action bar, alongside "Generate Embeddings" (depends on T040, T031; makes T036 pass)

**Checkpoint**: All three user stories are independently functional — correct chunks/models shown
(US1), safe repeatable preview generation with progress (US2), and durable, accumulating,
independently-progressed saves (US3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across all three stories together.

- [X] T042 [P] Add `frontend/tests/e2e/embeddings.spec.ts`: upload a PDF → save chunks (existing `012` flow) → navigate to Embeddings → select the document → generate (see progress) → save (see its own progress) → confirm no cross-contamination with the Chunking screen's own save state when navigating between the two screens. Also fixed a stale assertion in `fixed-size-chunking.spec.ts` that still expected the old "coming soon" placeholder text after clicking "Move to Embeddings".
- [X] T043 Walk through `specs/013-bert-pgvector-embeddings/quickstart.md` end-to-end (backend `curl`/`psql` checks in §1–§3, UI checks in §5–§7) and confirm every "Expected" outcome holds. Ran §1–§3 manually against the live dev backend with fresh unique documents: `/api/embeddings/models` returns BERT, generate produces 768-dim vectors per chunk with 0 DB rows written, save persists exactly one row per chunk, a second save doubles the row count (accumulate, not replace), and the 400/400/404 validation paths (bad model, no saved chunks, unknown document) all match the contract. §5–§7 (UI checks) are covered by the passing e2e spec (T042) and component/hook tests (T010–T041).
- [X] T044 [P] Run the full suites and confirm no regressions: `cd backend && pytest` and `cd frontend && npm test && npm run test:e2e`. Results: backend 172/172 passed (baseline 149, +23 new), frontend unit 169/169 passed (baseline 129, +40 new), e2e 14/14 passed (one `corpora-management.spec.ts` failure on the first run was a pre-existing parallel-worker timing flake unrelated to this feature — confirmed by re-running it alone (green) and re-running the full suite again (green)). Along the way, discovered and worked around a second instance of the same environment issue from `012`: the e2e webServer's per-run `DROP SCHEMA public CASCADE` also drops the `pgvector` extension, and this machine's shared local Postgres `byorag` role isn't superuser (unlike Docker Compose, where `POSTGRES_USER=byorag` is the initdb superuser and this never arises) — worked around by manually running the reset+extension-bootstrap+uvicorn-start sequence as a superuser role before letting Playwright reuse that already-running server, rather than editing the shared `playwright.config.ts` for a machine-specific quirk.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs the new Python packages installed) — BLOCKS
  all user stories, since the `embeddings` table and the model registry are shared by all three.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational; its backend service (`resolve_embedding_run`,
  `stream_generate`) and its frontend pieces (`embeddingsApi.ts`, `useChunkEmbeddings`,
  `EmbeddingsScreen.tsx`) are additive to files US1 already created, so US1 should land first to
  avoid two people editing the same new files at once — not a functional dependency (US2's own
  backend logic doesn't need US1's UI to exist to be correct).
- **User Story 3 (Phase 5)**: Depends on US2's `stream_generate`/embed-loop existing to reuse
  (research.md §6 — "reuse, don't duplicate, the embedding loop") and, like US2, is additive to the
  same shared files (`embeddings/service.py`, `embeddings/router.py`, `embeddingsApi.ts`,
  `useChunkEmbeddings.ts`, `EmbeddingsScreen.tsx`) — sequence US1 → US2 → US3 if worked by one
  person/session (as ordered here).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No functional dependency on US2/US3 — reading saved chunks and listing
  models are independent of generation/saving.
- **User Story 2 (P1)**: Functionally independent of US1's UI (its backend logic stands alone) but
  shares new files with it, so sequenced after in this single-session plan.
- **User Story 3 (P2)**: Reuses US2's embed-loop and shares files with both US1 and US2 — sequenced
  last.

### Within Each User Story

- Tests are written first and must fail before their corresponding implementation task.
- Backend layers proceed bottom-up: service (`list_saved_chunks` / `resolve_embedding_run` /
  `stream_generate` / `save_embeddings`) → router.
- Frontend layers proceed bottom-up: types → api client → hook → screen.

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T007 and T008 (Foundational, different files) in parallel.
- T010, T011, T012 (US1 tests, different files) in parallel.
- T018 (frontend types) can proceed in parallel with the entire US1 backend chain (T014–T017),
  since it only depends on the already-agreed contract/data-model shapes.
- T022 and T023 (US2 backend tests, different files) in parallel; T029 (frontend api client
  addition) in parallel with the US2 backend implementation chain (T026–T028).
- T032 and T033 (US3 backend tests, different files) in parallel.
- T042 and T044 (Polish) in parallel; T043 is a manual walkthrough best done once T042/T044 are
  green.

---

## Parallel Example: User Story 1 tests

```bash
# Launch independent US1 test-writing tasks together:
Task: "Contract tests for GET /api/chunking/saved-chunks in backend/tests/contract/test_chunking_saved_chunks.py"
Task: "Contract test for GET /api/embeddings/models in backend/tests/contract/test_embeddings_models.py"
Task: "Hook tests for useChunkEmbeddings's document/model/chunk loading in frontend/tests/unit/useChunkEmbeddings.test.ts"
```

---

## Implementation Strategy

### MVP Scope

Unlike `012-save-chunks-button` (where a pure preview still had value on its own, since chunking
already displayed results), **User Story 1 alone and User Story 1+2 together have limited lasting
value here** — nothing survives a page reload until US3 exists, since there is no pre-existing
persistence to fall back on for embeddings. Recommended MVP = **US1 + US2 + US3 together**: view
chunks and pick a model, generate a preview with progress, save it durably with its own progress.
All three are still independently *implementable and testable* per the phases above; they just
aren't independently *valuable to ship alone* the way `012`'s stories were.

### Incremental Delivery

1. Complete Setup (Phase 1) — new dependencies installed, Postgres image updated.
2. Complete Foundational (Phase 2) — `vector` extension, `embeddings` table, BERT strategy in place.
3. Add User Story 1 (Phase 3) → validate independently → chunks/models are viewable.
4. Add User Story 2 (Phase 4) → validate independently → generation preview works with progress.
5. Add User Story 3 (Phase 5) → validate independently → this + US1 + US2 together are the
   shippable MVP (durable, comparable, progress-visible embeddings).
6. Polish (Phase 6) → full regression + quickstart walkthrough.

### Parallel Team Strategy

With multiple developers: one person takes Setup + Foundational first since everything else blocks
on it; once that lands, a second person can take US1's backend half (T014–T017) while a third preps
US1's frontend half (T018–T021) against the agreed contract; US2 and US3's backend work
(`embeddings/service.py`, `embeddings/router.py`) is best kept with one person since each story
builds directly on the previous story's functions in the same file.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- `backend/app/embeddings/service.py`, `backend/app/embeddings/router.py`,
  `frontend/src/lib/embeddingsApi.ts`, `frontend/src/hooks/useChunkEmbeddings.ts`, and
  `frontend/src/components/embeddings/EmbeddingsScreen.tsx` are each touched by all three user
  stories in sequence (US1 creates/opens the file, US2 and US3 add to it) — never marked `[P]`
  against each other across stories.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
