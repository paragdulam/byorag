---

description: "Task list template for feature implementation"
---

# Tasks: Vector View Screen

**Input**: Design documents from `/specs/014-vector-view-screen/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/vector-view-api.md, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included below for every user story, at unit, contract, and component
levels as appropriate.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths are included in every task description

## Path Conventions

Existing web-application layout (unchanged from `001`–`013`): `backend/app/...` +
`backend/tests/...`, `frontend/src/...` + `frontend/tests/...`. This feature extends the existing
`backend/app/embeddings/` slice (no new backend module) and adds two new frontend screen
directories, `frontend/src/components/vector-view/` and `frontend/src/components/playground/`.

---

## Phase 1: Setup

**Purpose**: Confirm the existing environment runs before making changes. No new dependency or
schema change is introduced by this feature (plan.md Technical Context).

- [X] T001 Verify both suites pass before any change: `cd backend && pytest` and `cd frontend && npm test` (baseline green — backend 172/172, frontend 169/169)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**None required.** This feature only extends the already-scaffolded `embeddings` vertical slice
(`013`) and the sidebar/routing scaffolding that already has inert "Vector View"/"Playground"
labels waiting to be wired up. Each user story below builds incrementally on the previous one's
files within this feature (US1 creates a minimal `VectorViewScreen`, US2/US3/US4 extend it) —
proceed directly to User Story 1.

**Checkpoint**: Foundation ready (already true) — user story implementation can begin.

---

## Phase 3: User Story 1 - Move from Embeddings to Vector View (Priority: P1) 🎯 MVP start

**Goal**: A gated "Move to Vector View" button in the Embeddings bottom bar, next to "Save",
navigates to a (for now minimal) Vector View screen once at least one save has succeeded.

**Independent Test**: Generate and save embeddings on the Embeddings screen, confirm "Move to
Vector View" becomes enabled, click it, and confirm the Vector View screen opens.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **Write these tests FIRST, ensure they FAIL before implementation**

- [X] T002 [P] [US1] Add hook tests to `frontend/tests/unit/useChunkEmbeddings.test.ts`: `hasSavedOnce` is `false` before any save, becomes `true` only after a successful `save()` (not merely a successful `generate()`), and stays `true` even if a later generate or save fails (one-way latch, same shape as `012`'s `hasSavedOnce`)
- [X] T003 [P] [US1] Add component tests to `frontend/tests/unit/EmbeddingsScreen.test.tsx`: a "Move to Vector View" button is present next to "Save" in the bottom bar, disabled when `hasSavedOnce` is `false`, enabled when `true`, and calls `onNavigate('vector-view')` when clicked while enabled
- [X] T004 [US1] Add `frontend/tests/unit/VectorViewScreen.test.tsx` (new): renders within the standard `AppShell` navigation chrome (mirrors the existing placeholder-screen test pattern) with a "Vector View" heading visible
- [X] T005 [P] [US1] Add a test to `frontend/tests/integration/App.test.tsx`: navigating to "VECTOR VIEW" from the sidebar renders the Vector View screen's heading. (Also added the equivalent "PLAYGROUND" sidebar-nav test in the same pass since it's the same file — it stays red until US4 wires that screen up.)

### Implementation for User Story 1

- [X] T006 [US1] Add `hasSavedOnce: boolean` to `useChunkEmbeddings` in `frontend/src/hooks/useChunkEmbeddings.ts`: a one-way latch set `true` inside `save()`'s success path, never reset (research.md §5; depends on nothing new — reuses existing `save()`/`saveStatus`; makes T002 pass)
- [X] T007 [US1] Add `'vector-view'` to the `ScreenId` union in `frontend/src/components/layout/SidebarNav.tsx` and set `screen: 'vector-view'` on the existing "Vector View" `NAV_ITEMS` entry (currently label-only)
- [X] T008 [US1] Create `frontend/src/components/vector-view/VectorViewScreen.tsx` (new): a minimal screen wrapped in `AppShell` with `activeScreen="vector-view"` and a "Vector View" heading — no chunk list or vector display yet (added in US2) (depends on T007; makes T004/T005 pass)
- [X] T009 [US1] Route `'vector-view'` to `VectorViewScreen` in `frontend/src/app/App.tsx` (depends on T008)
- [X] T010 [US1] Add a "Move to Vector View" button to `frontend/src/components/embeddings/EmbeddingsScreen.tsx`'s bottom action bar, next to "Save", disabled unless `hasSavedOnce`, calling `onNavigate('vector-view')` (depends on T006, T009; makes T003 pass)

**Checkpoint**: User Story 1 is fully functional and independently testable — the gated button
reliably opens a (still-minimal) Vector View screen.

---

## Phase 4: User Story 2 - Browse chunks and inspect a saved vector (Priority: P1)

**Goal**: Vector View's two-pane layout — a chunk list on the left, and on the right the exact
persisted vector values (as a grid) for the selected chunk's chosen saved embedding, with a
secondary picker when a chunk has more than one saved embedding.

**Independent Test**: Select a chunk with exactly one saved embedding and confirm its real stored
vector values appear on the right in a grid, matching what's in the database for that chunk.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

- [X] T011 [P] [US2] Add `backend/tests/contract/test_embeddings_saved.py` (new): `GET /api/embeddings/saved?chunkId=` returns a chunk's saved embeddings ordered newest-first with full 768-value vectors, returns `{"embeddings": []}` for a chunk with none, and `404` for an unknown `chunkId`
- [X] T012 [P] [US2] Add unit tests for `list_saved_embeddings` to `backend/tests/unit/test_embeddings_service.py`: returns rows ordered by `created_at` descending for a chunk with multiple saved embeddings, and an empty list for a chunk with none
- [X] T013 [US2] Add hook tests to `frontend/tests/unit/useVectorView.test.ts` (new): loads documents (reusing the sources list), loads saved chunks reactive to the selected document, and loads saved embeddings reactive to the selected chunk (including the empty-list case, not an error)
- [X] T014 [US2] Add component tests to `frontend/tests/unit/VectorViewScreen.test.tsx` (same file as T004, sequenced after): renders a chunk list on the left with content/position, shows a vector grid on the right for a chunk with exactly one saved embedding, offers a picker (defaulting to the newest) and shows only the chosen one when a chunk has multiple, and shows a clear "nothing saved yet" message for a chunk with none

### Implementation for User Story 2

- [X] T015 [US2] Add `get_chunk_or_none(db: Session, chunk_id: str) -> Chunk | None` to `backend/app/db/lookups.py`, mirroring `get_document_or_none`/`get_corpus_or_none`
- [X] T016 [US2] Add `SavedEmbeddingOut` and `ListSavedEmbeddingsResponse` schemas to `backend/app/embeddings/schemas.py` (data-model.md: `id`, `model`, `createdAt`, `dims`, `vector`)
- [X] T017 [US2] Add `list_saved_embeddings(db: Session, chunk_id: str) -> list[EmbeddingRow]` to `backend/app/embeddings/service.py`, ordered by `created_at` descending (depends on nothing new; makes T012 pass)
- [X] T018 [US2] Add `GET /api/embeddings/saved` route to `backend/app/embeddings/router.py`: `404` for an unknown `chunkId` (via T015), else `{"embeddings": [...]}` (empty list is a normal response) (depends on T015, T016, T017; makes T011 pass)
- [X] T019 [P] [US2] Add `SavedEmbedding` type to `frontend/src/types/embeddings.ts` (data-model.md)
- [X] T020 [US2] Add `listSavedEmbeddings(chunkId: string)` to `frontend/src/lib/embeddingsApi.ts` (calls `GET /api/embeddings/saved`) (depends on T019; makes part of T013 pass)
- [X] T021 [US2] Implement `useVectorView(corpusId, documentId, chunkId)` in `frontend/src/hooks/useVectorView.ts` (new): `documents` via existing `listSources`, `savedChunks` via existing `listSavedChunks` reactive to `documentId`, `savedEmbeddings`/`isLoadingSavedEmbeddings` via `listSavedEmbeddings` reactive to `chunkId` (depends on T020; makes T013 pass)
- [X] T022 [US2] Implement the two-pane layout in `VectorViewScreen.tsx`: a document dropdown (mirrors `EmbeddingsScreen`'s), a selectable chunk list on the left, and on the right a vector grid for the selected chunk's chosen saved embedding, a secondary picker (pre-selecting the newest per research.md §3) when more than one saved embedding exists, and a clear empty-state message when none exist (depends on T021, T008; makes T014 pass). Implementation detail beyond the plan: rather than an explicit reset effect when the chunk changes, `activeEmbedding` derives from `savedEmbeddings.find(id match) ?? savedEmbeddings[0]`, so a stale `selectedEmbeddingId` from a previously-viewed chunk automatically falls back to the new chunk's newest embedding.

**Checkpoint**: User Stories 1 AND 2 both work independently — the screen is reachable, and it
shows real, persisted vector data for whichever chunk (and saved embedding) is selected.

---

## Phase 5: User Story 3 - Choose a projection method for future 3D visualization (Priority: P3)

**Goal**: A dropdown above the vector display offers "Vector" (functional, default) plus
visibly-not-yet-available placeholder entries (e.g. UMAP, PCA), server-driven so adding real
support later doesn't require a picker redesign.

**Independent Test**: Open the dropdown, confirm "Vector" is present and pre-selected and produces
the raw-grid display from User Story 2; confirm selecting another listed technique clearly
indicates it isn't available yet, without crashing.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

- [X] T023 [P] [US3] Add `backend/tests/contract/test_embeddings_projection_methods.py` (new): `GET /api/embeddings/projection-methods` returns `"vector"` first with `"available": true`, and `"umap"`/`"pca"` with `"available": false`
- [X] T024 [US3] Add hook tests to `frontend/tests/unit/useVectorView.test.ts` (same file as T013, sequenced after): loads `projectionMethods`, with `"vector"` present and `available: true`
- [X] T025 [US3] Add component tests to `frontend/tests/unit/VectorViewScreen.test.tsx` (same file as T004/T014, sequenced after): a dropdown above the vector display shows "Vector" pre-selected; selecting an unavailable method (e.g. UMAP) shows a clear "not available yet" message instead of the grid; selecting "Vector" again restores the grid

### Implementation for User Story 3

- [X] T026 [US3] Add `backend/app/embeddings/projection_methods.py` (new): `PROJECTION_METHODS: dict[str, ProjectionMethodInfo]` registry mirroring `embeddings/models/base.py`'s shape, registering `"vector"` (`available=True`), `"umap"`, and `"pca"` (`available=False`) (research.md §2)
- [X] T027 [US3] Add `ProjectionMethodOption` and `ListProjectionMethodsResponse` schemas to `backend/app/embeddings/schemas.py`
- [X] T028 [US3] Add `GET /api/embeddings/projection-methods` route to `backend/app/embeddings/router.py`, returning `PROJECTION_METHODS`' entries (depends on T026, T027; makes T023 pass)
- [X] T029 [P] [US3] Add `ProjectionMethodOption` type to `frontend/src/types/embeddings.ts`
- [X] T030 [US3] Add `listProjectionMethods()` to `frontend/src/lib/embeddingsApi.ts` (calls `GET /api/embeddings/projection-methods`) (depends on T029; makes part of T024 pass)
- [X] T031 [US3] Add `projectionMethods: ProjectionMethodOption[]` (loaded once, independent of selection) to `useVectorView` (depends on T030; makes T024 pass)
- [X] T032 [US3] Wire the projection-method dropdown into `VectorViewScreen.tsx`, positioned above the vector display, defaulting to `"vector"`; selecting an entry with `available: false` shows a "not available yet" message in place of the grid instead of attempting to render anything (depends on T031, T022; makes T025 pass). Also fixed the same class of gap found in `013`: `frontend/tests/setup.ts`'s global default fetch mock didn't know about `/api/embeddings/projection-methods` or `/api/embeddings/saved`, crashing the unmocked `useVectorView` hook in `App.test.tsx`'s sidebar-nav test — added default responses for both. Also renamed the dropdown's own "(not available yet)" option-label suffix to "(coming soon)" since it collided with the status-message text used to assert on the unavailable-method state.

**Checkpoint**: User Stories 1–3 are independently functional — the picker's shape is in place for
future dimensionality-reduction work, with only "Vector" doing anything today.

---

## Phase 6: User Story 4 - Move on to the Playground (Priority: P2)

**Goal**: A "Move to Playground" button in Vector View's own bottom bar navigates to a new,
minimal Playground screen; the sidebar's existing inert "Playground" label becomes clickable too.

**Independent Test**: Open Vector View, click "Move to Playground", and confirm it navigates to
the Playground screen.

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

- [X] T033 [P] [US4] Add `frontend/tests/unit/PlaygroundScreen.test.tsx` (new): renders within the standard `AppShell` navigation chrome with a "Playground" heading and a short placeholder message, no functional controls in the main content area (mirrors the pre-`013` Embeddings placeholder test)
- [X] T034 [US4] Add component tests to `frontend/tests/unit/VectorViewScreen.test.tsx` (same file as T004/T014/T025, sequenced after): a "Move to Playground" button is present in Vector View's bottom bar and calls `onNavigate('playground')` when clicked
- [X] T035 [P] [US4] Add a test to `frontend/tests/integration/App.test.tsx` (same file as T005): navigating to "PLAYGROUND" from the sidebar renders the Playground screen's heading. (Written together with T005 in the US1 pass since it's the same file; stayed red until this story's implementation landed.)

### Implementation for User Story 4

- [X] T036 [US4] Create `frontend/src/components/playground/PlaygroundScreen.tsx` (new): a minimal placeholder screen wrapped in `AppShell` with `activeScreen="playground"`, a "Playground" heading, and a short "coming soon" message — no functional controls (research.md §6; makes T033 pass)
- [X] T037 [US4] Add `'playground'` to the `ScreenId` union in `SidebarNav.tsx`, set `screen: 'playground'` on the existing "Playground" `NAV_ITEMS` entry, and route `'playground'` to `PlaygroundScreen` in `App.tsx` (depends on T036; makes T035 pass)
- [X] T038 [US4] Add a "Move to Playground" button to `VectorViewScreen.tsx`'s bottom bar, calling `onNavigate('playground')` (depends on T037, T032; makes T034 pass). Placed the bottom bar outside the "no documents" conditional so it's always reachable, unlike the gated "Move to Vector View" button on Embeddings.

**Checkpoint**: All four user stories are independently functional — Embeddings → Vector View →
Playground is a complete, navigable chain, with real persisted vector inspection in the middle.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end validation across all four stories together.

- [X] T039 [P] Extend `frontend/tests/e2e/embeddings.spec.ts`: after saving embeddings, click "Move to Vector View", select a chunk and confirm its vector grid appears, save embeddings for that document a second time to create a multi-embedding chunk and confirm the picker lets you switch between them, select an unavailable projection method and confirm the "not available yet" message, then click "Move to Playground" and confirm it lands there
- [X] T040 Walk through `specs/014-vector-view-screen/quickstart.md` end-to-end (backend `curl` checks in §1, UI checks in §3–§6) and confirm every "Expected" outcome holds. Ran §1 manually against the live dev backend with a fresh unique document: empty list before any save, save persists, a second save adds a distinct second saved embedding (not a replace) ordered newest-first, both report `dims: 768`, and the `404` unknown-chunk case matches the contract. §3–§6 (UI checks) are covered by the passing e2e spec (T039) and component/hook tests (T002–T038).
- [X] T041 [P] Run the full suites and confirm no regressions: `cd backend && pytest` and `cd frontend && npm test && npm run test:e2e`. Final results: backend 178/178 passed (baseline 172, +6 new), frontend unit 194/194 passed (baseline 169, +25 new), e2e 14/14 passed (confirmed during T039's extended embeddings.spec.ts run, no code changes since). Same environment quirk as `012`/`013` encountered again for e2e (local Postgres `byorag` role lacking `CREATE EXTENSION` privilege after the webServer's per-run schema reset) — worked around the same way, without editing `playwright.config.ts`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: None — empty, see above.
- **User Story 1 (Phase 3)**: Depends on Setup only. Creates `VectorViewScreen.tsx` as a minimal
  skeleton that later stories extend.
- **User Story 2 (Phase 4)**: Its backend work (`get_chunk_or_none`, `list_saved_embeddings`, the
  `/saved` route) is independent of US1, but its frontend work extends `VectorViewScreen.tsx` and
  needs it to exist — sequenced after US1 to avoid two people editing a not-yet-created file.
- **User Story 3 (Phase 5)**: Its backend work (`projection_methods.py`, the `/projection-methods`
  route) is independent of US1/US2, but its frontend work extends the same `VectorViewScreen.tsx`
  and `useVectorView.ts` files US2 creates — sequenced after US2.
- **User Story 4 (Phase 6)**: `PlaygroundScreen.tsx` itself is independent of everything else, but
  wiring "Move to Playground" into `VectorViewScreen.tsx`'s bottom bar needs that file to already
  have its layout (US2) and dropdown (US3) in place — sequenced last.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No functional dependency on US2/US3/US4.
- **User Story 2 (P1)**: Backend independent of US1; frontend shares `VectorViewScreen.tsx` with
  US1, sequenced not parallel.
- **User Story 3 (P3)**: Backend independent of US1/US2; frontend shares `VectorViewScreen.tsx`/
  `useVectorView.ts` with US2, sequenced not parallel.
- **User Story 4 (P2)**: `PlaygroundScreen.tsx` independent of all other stories; the "Move to
  Playground" button placement depends on US2/US3's layout already existing in
  `VectorViewScreen.tsx`.

### Within Each User Story

- Tests are written first and must fail before their corresponding implementation task.
- Backend layers proceed bottom-up: lookup/schema → service → router.
- Frontend layers proceed bottom-up: types → api client → hook → screen.

### Parallel Opportunities

- T002, T003 (US1 tests, different files) in parallel; T005 (App.test.tsx) in parallel with those.
- T011, T012 (US2 backend tests, different files) in parallel; T019 (frontend type) in parallel
  with the entire US2 backend chain (T015–T018), since it only depends on the agreed contract shape.
- T023 (US3 backend test) in parallel with T029 (frontend type), and both in parallel with US2's
  remaining frontend work if staffed separately.
- T033, T035 (US4 tests, different files) in parallel.
- T039 and T041 (Polish) in parallel; T040 is a manual walkthrough best done once T039/T041 are
  green.

---

## Parallel Example: User Story 2 tests

```bash
# Launch independent US2 test-writing tasks together:
Task: "Contract tests for GET /api/embeddings/saved in backend/tests/contract/test_embeddings_saved.py"
Task: "Unit tests for list_saved_embeddings in backend/tests/unit/test_embeddings_service.py"
```

---

## Implementation Strategy

### MVP Scope

**User Story 1 + User Story 2** together are the meaningful MVP: reaching Vector View and actually
seeing real persisted vector data (including the multi-embedding picker, since that's the resolved
clarification this feature exists partly to deliver). **User Story 3** (projection dropdown shell)
and **User Story 4** (Playground hop) are both real, explicit asks from the spec, but deliver no
new *data* — recommend shipping US1+US2 first, then US3 and US4 as fast-follow increments in
either order.

### Incremental Delivery

1. Complete Setup (Phase 1) — confirm baseline green.
2. Foundational (Phase 2) — none; proceed directly.
3. Add User Story 1 (Phase 3) → validate independently → gated navigation works.
4. Add User Story 2 (Phase 4) → validate independently → this + US1 together are the shippable MVP.
5. Add User Story 3 (Phase 5) → validate independently → projection picker shell in place.
6. Add User Story 4 (Phase 6) → validate independently → full Embeddings→Vector View→Playground chain.
7. Polish (Phase 7) → full regression + quickstart walkthrough.

### Parallel Team Strategy

With multiple developers: one person takes US1 first (small, self-contained) since US2/US3/US4 all
build on the file it creates; once that lands, a second person can take US2's backend half
(T015–T018) while a third preps US2's frontend half (T019–T021) against the agreed contract; US3's
backend (T026–T028) can proceed in parallel with US2's frontend work since they touch different
backend files, but US3's frontend wiring (T032) and US4 (T036–T038) both wait on US2's screen
layout landing first.

---

## Notes

- [P] tasks touch different files with no dependency on an incomplete task.
- `frontend/src/components/vector-view/VectorViewScreen.tsx`, `frontend/src/hooks/useVectorView.ts`,
  `frontend/tests/unit/VectorViewScreen.test.tsx`, and `backend/app/embeddings/schemas.py` are each
  touched by more than one user story in sequence (US1 creates, US2/US3/US4 extend) — never marked
  `[P]` against each other across stories.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
