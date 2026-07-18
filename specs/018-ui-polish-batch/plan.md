# Implementation Plan: RAG Workflow Screens — UI Polish Batch

**Branch**: `018-ui-polish-batch` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-ui-polish-batch/spec.md`

## Summary

Eight independent UI/UX fixes bundled as one feature across six existing screens. Two are the
real functional gap (P1): the Chunking and Embeddings screens' document selectors gain an "Entire
Corpus" option that runs today's per-document chunk/embed flow once for every document in the
active corpus, sequentially, showing one overall progress bar plus "Processing document X of N
(name)" — a purely **client-side orchestration** over the existing per-document streaming
endpoints (per `/speckit-clarify`); no new backend batch endpoints are introduced. Vector View
gains the same "Entire Corpus" selector value, but as a read-only combined chunk list (grouped by
document, with a header per document) built the same way — looping the existing per-document
saved-chunks endpoint client-side. The remaining five items are narrower: the Sources document
table wraps long names instead of scrolling horizontally; the Corpora list shows each corpus's
first 5 documents inline with a "Show more" toggle; clicking a corpus row no longer changes the
active corpus (only its "Make Active" button does); "Save Chunks" gets the same live progress
bar the Embeddings screen's "Save" already has — which requires converting
`POST /api/chunking/save` into a `GET /api/chunking/save/stream` SSE endpoint mirroring
`/api/embeddings/save/stream` exactly, since save re-runs the same page-by-page extraction work
`run/stream` already reports real progress for; and the Playground answer renders as Markdown via
`react-markdown` (new frontend dependency), never executing embedded HTML/scripts.

## Technical Context

**Language/Version**: Python 3.12 (backend, FastAPI); TypeScript 5 (frontend, React 19, Vite)

**Primary Dependencies**: FastAPI, SQLAlchemy, `pgvector`, `pypdf` (existing chunking text
extraction), the existing BERT embedding strategy (unchanged) — plus one new frontend dependency,
`react-markdown` (Playground answer rendering; chosen specifically because it renders Markdown to
React elements rather than injected HTML, so it satisfies FR-027 — no embedded HTML/script
execution — with no extra sanitization plugin needed)

**Storage**: PostgreSQL + `pgvector` — **no schema changes**. `Corpus`, `Document`,
`DocumentCorpus`, `Chunk`, and `Embedding` (`backend/app/db/models.py`) are all reused exactly as
they exist today; "Entire Corpus" chunking/embedding/viewing is a client-side loop over
per-document rows already reachable through existing endpoints, not a new persisted concept.

**Testing**: pytest (contract, unit, integration) for the backend — including a rewrite of
`tests/contract/test_chunking_save.py` for the new streaming save contract; Vitest + React
Testing Library for frontend components/hooks; Playwright for end-to-end coverage of all eight
user stories.

**Target Platform**: Existing byorag web app (local single-user, Docker Compose)

**Project Type**: Web application (existing `frontend/` + `backend/` split)

**Performance Goals**: "Entire Corpus" chunking/embedding runs process documents strictly one at a
time (sequential, not parallel) — identical per-document cost to today, just repeated N times —
so total wall time scales linearly with corpus size; the combined progress bar (overall % +
"document X of N") exists specifically so that linear scaling never reads as a hang. No new
latency SLA is introduced.

**Constraints**: No new backend batch/job endpoints or tables (per `/speckit-clarify`) — every
"Entire Corpus" feature is a frontend loop over today's existing per-document endpoints. The one
backend contract change is `POST /api/chunking/save` → `GET /api/chunking/save/stream` (SSE), a
direct mirror of `/api/embeddings/save/stream`'s shape, needed only because `EventSource` requires
GET and this project's streaming convention is GET+query-params (`run/stream`,
`generate/stream`, `save/stream`). Markdown rendering must never execute embedded HTML/scripts
(FR-027) — enforced by rendering through React elements only, no `rehype-raw`, no
`dangerouslySetInnerHTML`.

**Scale/Scope**: One new backend streaming endpoint (chunking save) plus a service-layer refactor
to share progress logic between preview and save, mirroring the existing embeddings pattern; two
new small frontend utility modules shared across screens (an "Entire Corpus" selector-value
constant, and a sequential batch-runner helper); six existing frontend screens modified; one new
frontend dependency (`react-markdown`); zero new database tables/columns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture (Experimentation-First)**: PASS. "Entire Corpus" chunking and
  embedding reuse the exact same `STRATEGIES` (`"fixed-size"`) and `EMBEDDING_MODELS` (`"bert"`)
  registries, once per document — no new pipeline stage, no hardcoded per-document branching
  beyond a client-side `for` loop over documents the corpus already lists. The chunking
  save-stream refactor reuses the identical registry lookup `stream_chunking` already does.
- **II. Test-First, Test at Every Level (NON-NEGOTIABLE)**: PASS (must remain true through
  tasks/implementation). Plan requires: a rewritten backend contract test for
  `GET /api/chunking/save/stream`; frontend unit tests for the new "Entire Corpus" selector value,
  the shared batch-runner helper, the Corpora per-row preview/show-more logic, the row-click-vs-
  button-click behavior, the Sources name-wrapping markup, and Markdown rendering (including a
  case asserting embedded HTML/script content renders inert); integration/e2e coverage of a full
  "Entire Corpus" chunk-then-save and generate-then-save run across a multi-document corpus, and
  of the Vector View combined/grouped chunk list.
- **III. Single-User Simplicity (YAGNI)**: PASS. Per `/speckit-clarify`, "Entire Corpus" runs are
  a client-side loop over existing single-document endpoints — no new job queue, batch table, or
  async task infrastructure is introduced, even though a corpus could in principle hold many
  documents. This is the smallest change that satisfies the spec's acceptance scenarios.
- **IV. Fixed Technology Stack**: PASS. No stack element changes: same React frontend, same Python
  FastAPI backend, same PostgreSQL+`pgvector` storage (the pre-existing Qdrant-vs-`pgvector`
  deviation from `013-bert-pgvector-embeddings` is inherited unchanged — this feature does not
  touch vector storage). `react-markdown` is a rendering utility within the already-fixed "React"
  frontend element, the same way `anthropic` (`017`) was a pluggable provider library within the
  already-fixed "Python" backend element — neither is itself a stack choice requiring an
  amendment.
- **V. Experiment Observability & Reproducibility**: PASS (unaffected). "Entire Corpus" runs
  persist each document's chunks/embeddings through the exact same `save_chunks`/`save_embeddings`
  paths as today's single-document flow, so every document's saved artifacts remain traceable to
  the chunking/embedding configuration that produced them, identically to before this feature.

No violations. Complexity Tracking is not needed.

**Post-Phase 1 re-check**: Design artifacts (`data-model.md`, `contracts/*.md`, `quickstart.md`)
introduce nothing beyond what this gate already covers — no new tables, no new backend batch
endpoints, no new pluggability gap, no new auth/multi-user surface. The one net-new backend
surface (`GET /api/chunking/save/stream`) is a same-shape sibling of an endpoint (`save/stream`)
already established in `013-bert-pgvector-embeddings`. Gate still PASSes after design.

## Project Structure

### Documentation (this feature)

```text
specs/018-ui-polish-batch/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── chunking-save-stream-api.md
│   ├── entire-corpus-batch-orchestration.md
│   └── vector-view-entire-corpus-listing.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── chunking/
│   │   ├── router.py    # MODIFIED — add GET /save/stream (SSE, mirrors embeddings'
│   │   │                #   save/stream); remove POST /save
│   │   ├── service.py   # MODIFIED — factor stream_chunking's extraction+chunking loop into
│   │   │                #   a shared generator; add save_chunks_stream() that reuses it and
│   │   │                #   then persists (mirrors embeddings' _stream_embed reuse pattern)
│   │   └── schemas.py   # MODIFIED — ChunkSaveRequest removed (save/stream takes query params,
│   │                    #   like run/stream and embeddings' generate/save streams, not a body)
│   └── (corpora/, sources/, embeddings/, retrieval/, playground/, db/ — unchanged)
└── tests/
    └── contract/
        └── test_chunking_save.py   # MODIFIED — rewritten against GET /save/stream's SSE
                                     #   contract instead of the old POST /save

frontend/
├── package.json                        # MODIFIED — add `react-markdown` dependency
├── src/
│   ├── lib/
│   │   ├── entireCorpusSelection.ts    # NEW — shared "Entire Corpus" sentinel value/guard,
│   │   │                               #   used by Chunking, Embeddings, Vector View selectors
│   │   ├── batchRunner.ts              # NEW — sequential per-document runner: given a document
│   │   │                               #   list and a per-document async step, drives it one
│   │   │                               #   document at a time and reports {index, total,
│   │   │                               #   documentName, percent} — shared by Chunking's and
│   │   │                               #   Embeddings' "Entire Corpus" run/save
│   │   └── chunkingApi.ts              # MODIFIED — saveChunks() (plain POST) replaced by
│   │                                    #   saveChunksStream() (SSE, mirrors
│   │                                    #   saveEmbeddingsStream())
│   ├── hooks/
│   │   ├── useFixedSizeChunking.ts     # MODIFIED — "Entire Corpus" run/save via batchRunner;
│   │   │                               #   saveProgressPercent + streamed save state
│   │   ├── useChunkEmbeddings.ts       # MODIFIED — "Entire Corpus" generate/save via
│   │   │                               #   batchRunner
│   │   └── useVectorView.ts            # MODIFIED — "Entire Corpus" mode loops
│   │                                    #   listSavedChunks() per document and groups the
│   │                                    #   results by document
│   └── components/
│       ├── sources/
│       │   └── DocumentList.tsx        # MODIFIED — name column wraps (table-fixed layout +
│       │                               #   break-words), no horizontal scroll
│       ├── corpora/
│       │   └── CorporaScreen.tsx       # MODIFIED — per-row document preview (5 + "Show more"),
│       │                               #   row click no longer selects the corpus (button-only)
│       ├── chunking/
│       │   └── FixedSizeChunkingScreen.tsx   # MODIFIED — "Entire Corpus" option, per-document
│       │                                     #   progress text, per-document result summary,
│       │                                     #   Save Chunks progress bar
│       ├── embeddings/
│       │   └── EmbeddingsScreen.tsx    # MODIFIED — "Entire Corpus" option, per-document
│       │                               #   progress text, per-document result summary
│       ├── vector-view/
│       │   └── VectorViewScreen.tsx    # MODIFIED — "Entire Corpus" option, grouped
│       │                               #   (per-document header) combined chunk list
│       └── playground/
│           └── TurnBubble.tsx          # MODIFIED — renders turn.answer through
│                                       #   <ReactMarkdown> instead of raw text
└── tests/
    ├── unit/
    │   ├── batchRunner.test.ts               # NEW
    │   ├── FixedSizeChunkingScreen.test.tsx  # MODIFIED
    │   ├── EmbeddingsScreen.test.tsx         # MODIFIED
    │   ├── VectorViewScreen.test.tsx         # MODIFIED
    │   ├── CorporaScreen.test.tsx            # MODIFIED
    │   ├── PlaygroundScreen.test.tsx         # MODIFIED
    │   ├── useFixedSizeChunking.test.ts      # MODIFIED
    │   ├── useChunkEmbeddings.test.ts        # MODIFIED
    │   └── useVectorView.test.ts             # MODIFIED
    ├── integration/
    │   ├── CorporaScreen.test.tsx            # MODIFIED
    │   └── DataSourcesScreen.test.tsx        # MODIFIED
    └── e2e/
        ├── fixed-size-chunking.spec.ts       # MODIFIED — entire-corpus + save-progress cases
        ├── embeddings.spec.ts                # MODIFIED — entire-corpus case
        ├── corpora-screen.spec.ts            # MODIFIED — preview/show-more + click-vs-button
        ├── data-sources-screen.spec.ts       # MODIFIED — long-name wrapping case
        ├── playground.spec.ts                # MODIFIED — markdown-rendering case
        └── vector-view.spec.ts               # NEW — no e2e spec exists yet for this screen;
                                               #   covers entire-corpus grouped chunk list
```

**Structure Decision**: Existing `frontend/` + `backend/` web-application layout, unchanged. Every
change lands inside screens/modules that already exist (`app/chunking/`, `app/embeddings/`,
`components/{sources,corpora,chunking,embeddings,vector-view,playground}/`) — no new top-level
module, package, or table. The only new backend surface, `GET /api/chunking/save/stream`, is a
same-shape sibling of `/api/embeddings/save/stream` (established in
`013-bert-pgvector-embeddings`), not a novel pattern. `entireCorpusSelection.ts` and
`batchRunner.ts` are the only new frontend modules, and both exist specifically to be shared by
two screens (Chunking, Embeddings) rather than duplicated.

## Complexity Tracking

*No violations — this section is not applicable.*
