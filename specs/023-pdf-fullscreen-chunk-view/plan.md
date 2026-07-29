# Implementation Plan: PDF Fullscreen Reading & In-Context Chunk Preview

**Branch**: `023-pdf-fullscreen-chunk-view` | **Date**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-pdf-fullscreen-chunk-view/spec.md`

## Summary

Two changes to how users read and inspect source PDFs:

1. **Sources screen**: remove the "Chunked Preview" toggle from the PDF preview pane; add a
   fullscreen/restore toggle so the PDF preview pane can expand to 100% of the content area for
   comfortable reading, and collapse back to its normal ~50% split — resetting on document change
   or screen re-entry.
2. **Fixed Size Chunking screen**: add a right-hand "in-context" preview pane next to the existing
   chunk list. Selecting a chunk shows that chunk plus its one preceding/following neighbor
   rendered directly on their original PDF page(s) (every touched page stacked, in page order),
   with headers/footers/paragraph/list structure preserved and the existing chunk/overlap
   background-color annotation applied — reusing the structural-preview and coloring logic
   introduced in 022-chunk-preview-ui-fixes rather than rebuilding it.

Technical approach: extend the existing `GET /api/chunking/structured-preview` response (no new
endpoint, no DB schema change) with two new fields — per-page character offsets and per-chunk
character ranges — computed from data already gathered inside `compute_structured_preview`. The
frontend fetches this once per document, then purely client-side: looks up the selected chunk's
(and neighbors') ranges, finds which pages they touch, slices the already-fetched text/segments
down to just those pages, and renders each page through the existing `classifyBlocks`/`colorBlocks`
pipeline — unchanged except for a shared color-map so a chunk keeps the same color across pages.

## Technical Context

**Language/Version**: Python 3.12 (backend, `uv`-managed), TypeScript ~6.0.2 / React 19.2.7 (frontend, Vite)

**Primary Dependencies**: FastAPI, pypdf (backend, both already in use); react-pdf/pdfjs-dist (frontend, already in use for PDF rendering) — no new dependencies

**Storage**: N/A — reuses existing `Document`/`Chunk` PostgreSQL rows and locally stored PDF files; no schema change, no migration

**Testing**: pytest (`backend/tests/contract`, `backend/tests/unit`), Vitest (`frontend/tests/unit`, `frontend/tests/integration`) — matches existing project conventions

**Target Platform**: Browser frontend + local Docker-composed backend (per constitution's fixed stack)

**Project Type**: Web application (existing `backend/` + `frontend/` split)

**Performance Goals**: Switching the selected chunk on Fixed Size Chunking must feel instant — achieved by fetching a document's full structured-preview payload once and doing all chunk/page slicing client-side, with zero network round-trips per chunk selection (SC-004)

**Constraints**: No new backend endpoint (extend the existing structured-preview response); no DB schema change; the existing `classifyBlocks`/`colorBlocks` functions and color palette must be reused unmodified in their per-block behavior — only how they're invoked (per page, with a shared color map) changes; PDF preview must remain scrollable in both normal and fullscreen states

**Scale/Scope**: Two screens touched (Sources, Fixed Size Chunking); one existing endpoint extended; bounded by the existing `MAX_CHUNKS = 200` saved-chunk cap, so a document's structured-preview payload and page count stay small

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. This feature is presentation-only (how existing saved chunks are displayed against PDF pages); it does not add, change, or hardcode a chunking/embedding/retrieval strategy. The existing fixed-size-only scope of the Chunking screen (established in 021) is unchanged.
- **II. Test-First, Test at Every Level**: PASS (commitment carried into tasks.md). Backend: contract tests for the extended `/structured-preview` response (`pages`, `chunkRanges` fields, including the page-boundary/strip-offset math). Frontend: unit tests for the new page-slicing utility and updated components (`SourceDocumentPreview` fullscreen behavior, the new in-context preview component, updated `FixedSizeChunkingScreen` chunk selection).
- **III. Single-User Simplicity (YAGNI)**: PASS. No multi-user, auth, or permission concepts introduced. The neighbor count (one before/one after) and page-stacking behavior are fixed, simple rules — no configurability added beyond what was asked for.
- **IV. Fixed Technology Stack**: PASS. No new libraries, frameworks, or infrastructure — reuses pypdf, FastAPI, React, and the already-integrated react-pdf/pdfjs-dist.
- **V. Experiment Observability & Reproducibility**: PASS. This feature does not change how chunk configuration (chunk_size/overlap/strategy) is recorded or reproduced — it is a read-only inspection view over already-saved chunks and their source PDF pages.

No violations. Complexity Tracking is not needed.

**Post-Phase 1 re-check**: Design artifacts (research.md, data-model.md, contracts/) introduce no
new dependencies, no schema changes, and no new endpoints — only an extension of the existing
`/structured-preview` response and new frontend-only components/utilities. All five gates remain
PASS with no changes to the assessment above.

## Project Structure

### Documentation (this feature)

```text
specs/023-pdf-fullscreen-chunk-view/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   └── chunking/
│       ├── schemas.py      # + PagePosition, ChunkRange; StructuredPreviewResponse gains pages/chunkRanges
│       ├── service.py      # compute_structured_preview extended to also compute page boundaries
│       │                   # (strip-offset-adjusted) and per-chunk character ranges
│       └── router.py       # /structured-preview response includes the new fields (no new route)
└── tests/
    ├── contract/
    │   └── test_chunking_structured_preview.py   # extended: pages/chunkRanges assertions
    └── unit/
        └── test_structured_preview_page_mapping.py  # new: strip-offset math, page boundary edge cases

frontend/
├── src/
│   ├── components/
│   │   ├── sources/
│   │   │   ├── SourceDocumentPreview.tsx   # fullscreen/restore toggle replaces Chunked Preview toggle;
│   │   │   │                               # ChunkedMarkdownView import/usage removed
│   │   │   └── DataSourcesScreen.tsx       # owns isFullscreen state; conditionally hides left pane
│   │   ├── chunking/
│   │   │   ├── FixedSizeChunkingScreen.tsx # adds selectedChunkIndex state; splits chunk-list area
│   │   │   │                               # into left (clickable chunk cards) + right (new preview)
│   │   │   └── ChunkInContextPreview.tsx   # NEW — renders selected chunk + neighbors on their page(s)
│   │   └── shared/
│   │       └── ColoredBlockGroups.tsx      # NEW — extracted from the old ChunkedMarkdownView
│   │                                       # (groupForRendering + ColoredSpans), reused per page
│   └── lib/
│       ├── chunkingApi.ts        # StructuredPreview type gains pages/chunkRanges
│       ├── chunkStructure.ts     # colorBlocks gains an optional pre-computed color-map parameter
│       └── chunkContextView.ts   # NEW — pure function: selected chunk + neighbors → touched pages
│                                 # → sliced per-page {blocks, spans} ready to render
└── tests/
    └── unit/
        ├── SourceDocumentPreview.test.tsx    # updated: fullscreen/restore, no Chunked Preview button
        ├── DataSourcesScreen.test.tsx        # updated: layout width toggling, reset on doc change
        ├── chunkContextView.test.ts          # new: neighbor selection, page union, slicing, color sharing
        ├── ChunkInContextPreview.test.tsx    # new
        └── FixedSizeChunkingScreen.test.tsx  # updated: chunk selection, two-column layout

# ChunkedMarkdownView.tsx and its dedicated test file are removed — its rendering logic moves into
# ColoredBlockGroups.tsx (shared) and ChunkInContextPreview.tsx (new host component); Sources no
# longer references it at all.
```

**Structure Decision**: Existing `backend/` + `frontend/` web-application split, unchanged. This
feature adds one new backend unit test file and one new frontend component + one new frontend
lib module, extends three existing backend files (schemas/service/router) and several existing
frontend files, and removes one frontend component (`ChunkedMarkdownView.tsx`) whose logic is
absorbed into a new shared renderer plus the new in-context preview component.

## Complexity Tracking

*No violations — table not needed.*
