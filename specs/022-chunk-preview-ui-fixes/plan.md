# Implementation Plan: Chunk Preview Structure & UI Fixes

**Branch**: `022-chunk-preview-ui-fixes` | **Date**: 2026-07-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/022-chunk-preview-ui-fixes/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Three independent fixes: (1) the Sources document list wraps long names and lets row height grow
with content, fixing a layout regression from the split-pane Sources screen; (2) Chunked Preview is
rebuilt from a stack of separate colored chunk cards into one continuous, structurally-classified
document (headings/lists detected via a lightweight text-cue heuristic) with chunk boundaries shown
purely via inline background-color changes — including exact mid-word transitions and a reserved
color for overlapping spans — backed by a new read-only backend endpoint that re-extracts a
document's structure-preserving text and computes each saved chunk's character-offset range on
demand (no schema change, no new persisted data); (3) the Embeddings screen's "Entire Corpus"
progress/already-done/results presentation is unified with Fixed Size Chunking's via three new
shared presentational components, with Chunking treated as the reference design.

## Technical Context

**Language/Version**: Python 3.12 (backend, `uv`-managed), TypeScript ~6.0.2 (frontend)

**Primary Dependencies**: Backend — existing `pypdf` (re-extraction), Python's built-in `re` module
(word tokenization with offsets); no new backend dependencies. Frontend — existing React 19,
`react-markdown` is dropped from `ChunkedMarkdownView` in favor of direct semantic-element
rendering (research.md §4); no new frontend dependencies.

**Storage**: PostgreSQL (existing) — no schema changes. The new structured-preview endpoint reads
existing `Chunk.chunk_size`/`Chunk.overlap`/`Chunk.strategy` columns and the document's stored PDF
file; nothing new is persisted (research.md §1).

**Testing**: Backend — pytest (`backend/tests/{unit,contract}`). Frontend — Vitest
(`frontend/tests/unit`).

**Target Platform**: Dockerized local web app (existing docker-compose stack); single local user,
no auth (Constitution Principle III).

**Project Type**: Web application (frontend + backend), existing structure.

**Performance Goals**: Structured-preview re-extraction is a one-time, on-demand read per Chunked
Preview open (not on every keystroke/interaction) — no new latency-sensitive path; bounded by the
existing 50MB PDF upload limit and 200-chunk cap, same as today's chunking preview.

**Constraints**: The structured-preview endpoint must derive everything from already-persisted
`Chunk` columns (`chunk_size`, `overlap`, `strategy`) plus a fresh PDF re-extraction — it must not
require re-chunking, re-saving, or any new database migration. The heading/list heuristic is
text-cue-only (no PDF layout/font analysis) per Clarifications.

**Scale/Scope**: 3 user stories touching 2 screens (Sources, Chunking/Embeddings via shared
components) and 1 component (Chunked Preview) plus 1 new backend endpoint.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture** — PASS. The structured-preview endpoint reads the existing
  `chunk_size`/`overlap`/`strategy` columns generically (it re-derives word-boundary math from
  whatever strategy/params were actually used, not a hardcoded "fixed-size" assumption baked into
  the endpoint's contract) — though today only `"fixed-size"` is registered, the offset-recompute
  approach doesn't foreclose future strategies from supplying their own boundary math later.
- **II. Test-First, Test at Every Level** — PASS (to be enforced in tasks.md). New backend contract
  tests for `GET /api/chunking/structured-preview` (including overlap-segment and missing-chunks
  cases); new frontend unit tests for `classifyBlocks`, `colorBlocks`, the rewritten
  `ChunkedMarkdownView`, `DocumentList` wrapping, and the three new shared Entire-Corpus components.
- **III. Single-User Simplicity (YAGNI)** — PASS. No new persisted data, no caching layer, no new
  auth — the structured-preview endpoint recomputes on every request, which is acceptable at this
  project's single-user, on-demand-open scale (research.md §1's explicit "recompute, don't store"
  choice).
- **IV. Fixed Technology Stack** — PASS. No new dependencies on either side; `react-markdown`'s
  removal from `ChunkedMarkdownView` is a reduction in usage, not a stack change (it remains used
  elsewhere, e.g. Playground's `TurnBubble.tsx`).
- **V. Experiment Observability & Reproducibility** — PASS. This feature only changes how already-
  recorded chunks are *displayed*; it introduces no new experiment configuration and doesn't change
  what's recorded or how chunks trace back to their source document.

## Project Structure

### Documentation (this feature)

```text
specs/022-chunk-preview-ui-fixes/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── chunking-structured-preview-api.md
│   └── ui-contracts.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Existing web application structure (frontend + backend), extended in place — no new top-level
directories:

```text
backend/
├── app/
│   └── chunking/
│       ├── router.py           # + GET /structured-preview (new)
│       └── service.py          # + re-extraction, word-offset tokenization, segment computation (new)
└── tests/
    └── contract/
        └── test_chunking_structured_preview.py   # new

frontend/
├── src/
│   ├── components/
│   │   ├── sources/
│   │   │   ├── DocumentList.tsx             # updated: wrap + row-height fix
│   │   │   └── ChunkedMarkdownView.tsx       # rewritten: continuous structured render
│   │   ├── chunking/
│   │   │   └── FixedSizeChunkingScreen.tsx  # updated: use shared Entire Corpus components
│   │   ├── embeddings/
│   │   │   └── EmbeddingsScreen.tsx         # updated: use shared Entire Corpus components
│   │   └── shared/                          # new directory
│   │       ├── BatchProgressBar.tsx          # new
│   │       ├── AlreadyDoneIndicator.tsx      # new
│   │       └── EntireCorpusSummaryList.tsx   # new
│   └── lib/
│       ├── chunkColorPalette.ts              # + OVERLAP_COLOR/OVERLAP_TEXT_COLOR, assignColorsByChunkIndex
│       ├── chunkStructure.ts                 # new: classifyBlocks, colorBlocks
│       └── chunkingApi.ts                    # + fetchStructuredPreview
└── tests/
    └── unit/
        ├── chunkStructure.test.ts            # new
        ├── ChunkedMarkdownView.test.tsx       # rewritten
        ├── DocumentList.test.tsx              # new (or added to an existing Sources test file)
        ├── BatchProgressBar.test.tsx          # new
        ├── AlreadyDoneIndicator.test.tsx      # new
        ├── EntireCorpusSummaryList.test.tsx   # new
        ├── FixedSizeChunkingScreen.test.tsx   # updated
        └── EmbeddingsScreen.test.tsx          # updated
```

**Structure Decision**: Extends the existing `backend/app/chunking` and `frontend/src/components/
{sources,chunking,embeddings}` feature-module layout in place. One new frontend directory,
`frontend/src/components/shared/`, holds the three cross-screen presentational components — the
first genuinely shared (non-screen-specific) component directory in the frontend, introduced
specifically to stop the two screens' "Entire Corpus" presentations from drifting apart again
(research.md §6).

## Complexity Tracking

*No constitution violations requiring justification — all gates in the Constitution Check above
pass without exception. This section is intentionally left without entries.*
