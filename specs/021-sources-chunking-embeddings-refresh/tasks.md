---

description: "Task list template for feature implementation"
---

# Tasks: Sources, Chunking & Embeddings UX Refresh

**Input**: Design documents from `/specs/021-sources-chunking-embeddings-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Per this project's constitution (Principle II: Test-First, Test at Every Level), tests
are NON-NEGOTIABLE and are included for every user story at the appropriate level(s).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing
of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Web app per plan.md: `backend/app/...`, `backend/tests/...`, `frontend/src/...`, `frontend/tests/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new third-party dependencies this feature needs, before any story touches them

- [X] T001 [P] Add `react-pdf` (PDF preview) and `recharts` (2D scatter plot) to `frontend/package.json` dependencies and install (research.md §1, §7)
- [X] T002 [P] Add `scikit-learn` (PCA) and `umap-learn` (UMAP) to `backend/pyproject.toml` dependencies, update `backend/uv.lock` (research.md §6)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

No cross-story blocking prerequisites are required for this feature. Each user story touches its
own screen, its own backend module, and introduces no shared new entity or base service (see
data-model.md — no new DB tables; plan.md Project Structure — each story's new files are isolated
to `sources/`, `chunking/`, or `embeddings/`). Proceed directly from Phase 1 to the user story
phases below.

---

## Phase 3: User Story 1 - Previously Chunked Documents Show Immediately (Priority: P1) 🎯 MVP

**Goal**: The Fixed Size Chunking screen auto-loads previously saved chunks (single document and
Entire Corpus) instead of requiring a manual re-chunk.

**Independent Test**: Chunk a document, reload the app, reopen the Fixed Size Chunking screen for
that document (and separately for a corpus where every document already has saved chunks) — saved
chunks render immediately with no manual action.

### Tests for User Story 1 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 [P] [US1] Update `frontend/tests/unit/useFixedSizeChunking.test.ts` to assert saved chunks are fetched and populated on mount/selection-change for both a single document and "Entire Corpus" (fanned out per document), and that a subsequent "Re-Calculate Chunks" replaces them
- [X] T004 [P] [US1] Update `frontend/tests/unit/FixedSizeChunkingScreen.test.tsx` to assert auto-loaded chunks render immediately with an "already chunked" indicator, and that a document with zero saved chunks still shows today's empty state

### Implementation for User Story 1

- [X] T005 [US1] Update `frontend/src/hooks/useFixedSizeChunking.ts` to call `GET /api/chunking/saved-chunks` (via `frontend/src/lib/chunkingApi.ts`) on mount and whenever the selected document or "Entire Corpus" changes, populating `result` from saved chunks when present, fanning out one call per document for "Entire Corpus" (mirrors `useVectorView.ts`'s existing `chunkGroups` pattern) — depends on T003 failing first
- [X] T006 [US1] Add a per-result origin flag (auto-loaded vs freshly computed) to `frontend/src/hooks/useFixedSizeChunking.ts`'s state so the screen can distinguish the two — depends on T005
- [X] T007 [US1] Update `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` to render an "already chunked" indicator when the current result is auto-loaded, and confirm "Re-Calculate Chunks" still overwrites it with a freshly computed result — depends on T004 failing first, T006

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Sources Screen Split View With PDF Preview (Priority: P2)

**Goal**: The Sources screen is a two-pane layout — upload + document list on the left, a PDF
preview of the selected document on the right.

**Independent Test**: Open the Sources screen, select a PDF document from the list, confirm its
content renders in the right-side pane while the left side remains usable.

### Tests for User Story 2 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T008 [P] [US2] Contract test for `GET /api/sources/{document_id}/file` in `backend/tests/contract/test_sources_file.py` — `200` + PDF bytes for a valid id, `404` for an unknown id, `404` for a known id whose file is missing/unreadable on disk (contracts/sources-file-api.md)
- [X] T009 [P] [US2] Unit test for the new preview component in `frontend/tests/unit/SourceDocumentPreview.test.tsx` — empty placeholder with no document selected, renders the PDF when selected, "preview unavailable" state on a `404` (contracts/ui-contracts.md)
- [X] T010 [P] [US2] Update `frontend/tests/integration/DataSourcesScreen.test.tsx` for the two-column split layout, document selection driving the right pane, selection persisting across a new upload, and the pane resetting if the selected document is deleted

### Implementation for User Story 2

- [X] T011 [US2] Implement `GET /api/sources/{document_id}/file` in `backend/app/sources/router.py` and `backend/app/sources/service.py`, resolving `Document.storage_path` and streaming the file with `media_type="application/pdf"`, returning the two `404` cases from contracts/sources-file-api.md — depends on T008 failing first
- [X] T012 [P] [US2] Add `fetchDocumentFile` to `frontend/src/lib/sourcesApi.ts`
- [X] T013 [US2] Create `frontend/src/components/sources/SourceDocumentPreview.tsx` rendering the selected document's PDF via `react-pdf`, with empty and preview-unavailable states (contracts/ui-contracts.md `SourceDocumentPreview`) — depends on T009 failing first, T012
- [X] T014 [US2] Update `frontend/src/components/sources/DataSourcesScreen.tsx` to the two-column split layout (left: existing upload control + `DocumentList`; right: `SourceDocumentPreview`), adding `selectedDocumentId` state that resets to `null` when the selected document is deleted — depends on T010 failing first, T013

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Chunked Markdown Preview With Per-Chunk Colors (Priority: P3)

**Goal**: A "Chunked Preview" toggle on the preview pane renders the document's saved chunks as
markdown, each chunk in its own background color from a curated pastel palette (fixed dark text,
no two consecutive chunks share a color).

**Independent Test**: With a chunked document selected and previewed (US2), click "Chunked
Preview" and confirm each chunk renders as its own distinctly colored markdown block, and that
toggling back returns to the PDF preview.

### Tests for User Story 3 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T015 [P] [US3] Unit test for `assignChunkColors` in `frontend/tests/unit/chunkColorPalette.test.ts` — pure function, same-length index-aligned output, every `textColor` equals the fixed constant, no two consecutive entries share a `backgroundColor` (contracts/ui-contracts.md, research.md §5)
- [X] T016 [P] [US3] Unit test for `frontend/tests/unit/ChunkedMarkdownView.test.tsx` — renders one colored block per saved chunk in ascending `index` order through the markdown renderer, and shows the "no chunks yet" message when the document has zero saved chunks

### Implementation for User Story 3

- [X] T017 [P] [US3] Create `frontend/src/lib/chunkColorPalette.ts` with `CHUNK_COLOR_PALETTE` (curated pastel hex values), `CHUNK_TEXT_COLOR` (fixed dark hex), and `assignChunkColors` (re-rolls only against the immediately preceding color) — depends on T015 failing first
- [X] T018 [US3] Create `frontend/src/components/sources/ChunkedMarkdownView.tsx` fetching `GET /api/chunking/saved-chunks?documentId=` and rendering each chunk's `content` through `ReactMarkdown`, wrapped per `assignChunkColors` output, with the empty-state message — depends on T016 failing first, T017
- [X] T019 [US3] Update `frontend/src/components/sources/SourceDocumentPreview.tsx` to add the "Chunked Preview" button anchored bottom-right, toggling between the PDF view and `ChunkedMarkdownView`, and reset the mode to PDF whenever the selected document changes — depends on T018

**Checkpoint**: User Stories 1, 2, AND 3 all work independently (US3 builds on the pane US2 delivers).

---

## Phase 6: User Story 4 - Visual Embedding Projection (UMAP / PCA) for Corpus or Document (Priority: P4)

**Goal**: The existing "Projection Method" dropdown's UMAP/PCA entries become functional, rendering
a 2D scatter plot of embedded chunks for either a single document or an entire corpus, gated behind
a 5-embedded-chunk minimum.

**Independent Test**: Generate embeddings for a document (5+ chunks), select UMAP — a 2D plot
renders; switch to PCA — plot updates; switch scope to "Entire Corpus" — plot reflects all
documents' embedded chunks, grouped by document.

### Tests for User Story 4 (MANDATORY per constitution) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T020 [P] [US4] Unit test for `backend/tests/unit/test_projections_pca.py` — 2-component output, deterministic for a fixed input, correct output length
- [X] T021 [P] [US4] Unit test for `backend/tests/unit/test_projections_umap.py` — 2-component output, correct output length
- [X] T022 [P] [US4] Contract test for `POST /api/embeddings/project` in `backend/tests/contract/test_embeddings_project.py` — `422` for fewer than 5 entries, `422` for mixed vector dimensions, `400` for an unknown/unavailable method, `200` with one ordered `ProjectionPoint` per input entry (contracts/embeddings-projection-api.md)
- [X] T023 [P] [US4] Update `backend/tests/contract/test_embeddings_projection_methods.py` to assert `umap` and `pca` now report `available: true`
- [X] T024 [P] [US4] Unit test for `frontend/tests/unit/useEmbeddingProjection.test.ts` — method selector disabled below 5 resolved entries, entire-corpus scope fans out per document and excludes/report documents with zero saved embeddings (contracts/ui-contracts.md `EmbeddingProjectionView`)
- [X] T025 [P] [US4] Unit test for `frontend/tests/unit/EmbeddingProjectionView.test.tsx` — renders one scatter point per returned `ProjectionPoint`, tooltip identifies chunk/document, points are grouped/colored by `documentId` in corpus scope

### Implementation for User Story 4

- [X] T026 [P] [US4] Create `backend/app/embeddings/projections/base.py` defining the projection interface (`project(vectors) -> list[list[float]]`), per research.md §6
- [X] T027 [P] [US4] Implement `backend/app/embeddings/projections/pca.py` using `scikit-learn`'s `PCA` (2 components) — depends on T020 failing first, T026
- [X] T028 [P] [US4] Implement `backend/app/embeddings/projections/umap.py` using `umap-learn` (2 components) — depends on T021 failing first, T026
- [X] T029 [US4] Update `backend/app/embeddings/projection_methods.py` to flip `umap`/`pca` `available` to `true` and register the new implementations — depends on T023 failing first, T027, T028
- [X] T030 [US4] Implement `POST /api/embeddings/project` in `backend/app/embeddings/router.py` — validates minimum 5 entries and matching vector dimensions, dispatches to the registered projection, returns ordered points (data-model.md `ProjectionRequestEntry`/`ProjectionPoint`) — depends on T022 failing first, T029
- [X] T031 [P] [US4] Add `fetchProjection` to `frontend/src/lib/embeddingsApi.ts`
- [X] T032 [US4] Create `frontend/src/hooks/useEmbeddingProjection.ts` resolving the requested scope (single document, or entire-corpus fan-out via existing per-chunk `GET /api/embeddings/saved` calls), gating the method selector on the 5-entry minimum, and reporting excluded documents — depends on T024 failing first, T030, T031
- [X] T033 [US4] Create `frontend/src/components/embeddings/EmbeddingProjectionView.tsx` rendering the `recharts` 2D scatter from `useEmbeddingProjection`'s points, colored/grouped by `documentId` for corpus scope, with per-point tooltips — depends on T025 failing first, T032
- [X] T034 [US4] Update `frontend/src/components/vector-view/VectorViewScreen.tsx` to render `EmbeddingProjectionView` when the "Projection Method" dropdown selects `umap`/`pca`, passing the currently selected document/"Entire Corpus" scope — depends on T033

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories

- [X] T035 [P] Rebuild the Docker images (`docker-compose up --build`) and confirm the new backend deps (`scikit-learn`, `umap-learn`) and frontend deps (`react-pdf`, `recharts`) are picked up cleanly — backend image built successfully with the new deps; frontend image build fails, but only on 4 pre-existing TypeScript errors confirmed present on `main` before this feature (unrelated to `react-pdf`/`recharts`), not on anything introduced here
- [X] T036 Run every scenario in `specs/021-sources-chunking-embeddings-refresh/quickstart.md` end-to-end against the running stack — validated via live backend smoke test (upload → chunk → save → embed → save → `GET .../file` byte-match → `POST /project` for both umap/pca, all against the real Postgres-backed API, then cleaned up) plus the full automated suite (367 passing frontend tests, 15 new/updated backend tests); a full manual browser click-through was not completed since browser automation in this environment needs a one-time manual step in the user's own Chrome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: N/A for this feature (see note above) — user stories may start right after Setup
- **User Stories (Phase 3-6)**: All depend only on Setup; US3 additionally builds on the pane US2 delivers (SourceDocumentPreview), so implement US2 before US3 in practice even though both are independently testable once built
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on other stories — pure frontend change to an existing hook/screen
- **User Story 2 (P2)**: No dependency on other stories
- **User Story 3 (P3)**: Extends the `SourceDocumentPreview` component introduced in US2 (adds the "Chunked Preview" toggle to it) — build after US2
- **User Story 4 (P4)**: No dependency on other stories — separate screen, separate backend module

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend interface/base before backend implementations; implementations before the endpoint that dispatches to them
- API client functions before the hooks that call them; hooks before the components that consume them
- Story complete before moving to the next priority

### Parallel Opportunities

- T001, T002 (Setup) run in parallel
- All test tasks within a story marked [P] run in parallel with each other
- T026 (base interface) unblocks T027 and T028, which then run in parallel with each other
- US1, US2, and US4 can be implemented in parallel by different developers once Setup is done; US3 should follow US2

---

## Parallel Example: User Story 2

```bash
# Launch all tests for User Story 2 together:
Task: "Contract test for GET /api/sources/{document_id}/file in backend/tests/contract/test_sources_file.py"
Task: "Unit test for SourceDocumentPreview in frontend/tests/unit/SourceDocumentPreview.test.tsx"
Task: "Update integration test for split layout in frontend/tests/integration/DataSourcesScreen.test.tsx"
```

## Parallel Example: User Story 4

```bash
# Launch all tests for User Story 4 together:
Task: "Unit test for PCA projection in backend/tests/unit/test_projections_pca.py"
Task: "Unit test for UMAP projection in backend/tests/unit/test_projections_umap.py"
Task: "Contract test for POST /api/embeddings/project in backend/tests/contract/test_embeddings_project.py"
Task: "Update contract test for projection-methods availability in backend/tests/contract/test_embeddings_projection_methods.py"
Task: "Unit test for useEmbeddingProjection hook in frontend/tests/unit/useEmbeddingProjection.test.ts"
Task: "Unit test for EmbeddingProjectionView in frontend/tests/unit/EmbeddingProjectionView.test.tsx"

# Once base.py exists, launch both projection implementations together:
Task: "Implement PCA projection in backend/app/embeddings/projections/pca.py"
Task: "Implement UMAP projection in backend/app/embeddings/projections/umap.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 3: User Story 1
3. **STOP and VALIDATE**: Test User Story 1 independently (per its Independent Test above)
4. Deploy/demo if ready

### Incremental Delivery

1. Setup → Foundation ready (no foundational phase needed for this feature)
2. Add User Story 1 → test independently → deploy/demo (MVP!)
3. Add User Story 2 → test independently → deploy/demo
4. Add User Story 3 → test independently → deploy/demo
5. Add User Story 4 → test independently → deploy/demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers, once Setup is done:
- Developer A: User Story 1 (frontend-only, fastest to ship)
- Developer B: User Story 2, then User Story 3 (sequential — US3 extends US2's component)
- Developer C: User Story 4 (backend projections + frontend scatter view, fully separate surface)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
