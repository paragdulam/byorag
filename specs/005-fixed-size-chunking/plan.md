# Implementation Plan: Fixed Size Chunking Experiment

**Branch**: `005-fixed-size-chunking` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-fixed-size-chunking/spec.md`

## Summary

Add a new "Fixed Size Chunking" screen, reached via an expandable "Experiments" item in the left
sidebar (currently inert). The user picks one already-uploaded document, enters a chunk size, and
triggers chunking; the backend extracts the document's text (via `pypdf`) and splits it into
fixed-size (word-count-approximated "token") pieces, returning up to 200 chunks plus the true
total count so the frontend can show a "more exist" note when the result is larger. This is the
project's first real pipeline-stage implementation, so it's built behind a small pluggable
`ChunkingStrategy` registry (constitution Principle I) even though only `"fixed-size"` is
implemented today — the reference design's other algorithm choices, overlap, and separator
controls are shown but inert (User Story 3), and its "Comparison" section is dropped entirely.

## Technical Context

**Language/Version**: Backend: Python 3.12 (unchanged). Frontend: TypeScript 5.x on React 19,
Node.js 20 LTS (unchanged).

**Primary Dependencies**: Backend: adds `pypdf` (lightweight PDF text extraction — switched from
the originally suggested `docling` after measuring its ~100-transitive-package ML-stack footprint,
research.md §2) to `backend/pyproject.toml`; no tokenizer dependency (word-count approximation,
research.md §3). Frontend: no new dependencies — no routing library is introduced (research.md
§5); reuses the existing `fetch`-based API client pattern.

**Storage**: N/A for this feature's own data — chunking results are computed fresh per request and
never persisted (spec Assumptions, research.md §7). Reads the same `PDFS_DIR` filesystem storage
from `002-persist-pdf-sources` to locate the selected document's bytes.

**Testing**: Backend: pytest + FastAPI `TestClient` (contract test for `POST /api/chunking/run`;
unit tests for the fixed-size strategy's word-count splitting, the 200-chunk cap + total-count
reporting, chunk-size validation, and text-extraction-failure handling). Frontend: Vitest + React
Testing Library (`SidebarNav` expand/sub-item tests; a new screen's component tests covering
document selection, chunk-size validation, the resulting chunk list, the capped-result note, and
the inert extra controls from User Story 3), Playwright (e2e: upload a document, navigate to Fixed
Size Chunking, run it, see chunks) — required by constitution Principle II.

**Target Platform**: Backend: Linux server container (Docker) or local process (unchanged).
Frontend: desktop web browsers (unchanged).

**Project Type**: Web application — adds one new backend module (`chunking`) and one new frontend
screen/module (`experiments`) to the existing `backend/` and `frontend/` projects; no new
top-level project.

**Performance Goals**: No hard latency target is set in the spec (unlike prior features' ~2s
budgets). `pypdf` extraction is lightweight and typically fast for text-based PDFs, but exact
timing hasn't been measured yet in this codebase and can still vary with document size/page count;
the screen shows a clear in-progress state (matching the "Loading documents…" / "Detecting
hardware…" precedent from 002/003) for however long a run takes, rather than assuming a fixed
budget.

**Constraints**: The displayed chunk list MUST be capped at 200 chunks with an explicit "more
exist" note when the true total is larger (FR-007a, research.md §4); chunk size MUST be validated
before triggering a run (FR-010); the extra reference-design controls MUST remain visually present
but MUST NOT affect output (FR-008); the "Comparison" section MUST NOT be present at all (FR-009).

**Scale/Scope**: Single local user, one document selected at a time, one new backend endpoint, one
new frontend screen plus a small `SidebarNav` change. No caching or persistence layer — consistent
with constitution Principle III.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Pluggable RAG Architecture | Pass | This is the project's first pipeline-stage implementation (chunking). Built behind a `ChunkingStrategy` registry (research.md §1) with `"fixed-size"` as the only registered strategy today — the API contract already accepts a `strategy` field so Recursive Character / Semantic Chunking can be added later as new registrations, not hardcoded branches. Directly satisfies Principle I rather than deferring it. |
| II. Test-First, Test at Every Level | Pass (enforced in tasks) | Backend contract test (`POST /api/chunking/run`), unit tests (word-count splitting, 200-chunk cap + total count, validation, extraction-failure handling), frontend component tests (sidebar expansion, document/chunk-size flow, capped-result note, inert extra controls), and a Playwright e2e run. All required in `tasks.md` before implementation is considered done. |
| III. Single-User Simplicity (YAGNI) | Pass | No caching/persistence layer (research.md §7); no routing library for two screens (research.md §5); strategy registry is a plain dict, not a plugin-loading framework (research.md §1). |
| IV. Fixed Technology Stack | Pass | Backend stays Python/FastAPI, frontend stays React — `pypdf` is an additive, lightweight extraction library (same category as `psutil` in 003), not a stack change. No change to Qdrant (still not introduced — this feature produces chunks for display only, no embedding/vector storage yet) or the Docker/docker-compose deployment approach. |
| V. Experiment Observability & Reproducibility | N/A | Per spec Assumptions, chunking runs in this feature are ephemeral and not saved/tracked — there is no experiment configuration to record yet. This principle will become directly relevant once a feature adds run history/comparison (the reference design's dropped "Comparison" section), not this one. |

No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/005-fixed-size-chunking/
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
│   ├── main.py                  # Updated: mounts the new chunking router
│   ├── sources/                 # Existing (002/004), unchanged — chunking reads PDFS_DIR via it
│   └── chunking/
│       ├── router.py            # POST /api/chunking/run
│       ├── service.py           # extract_text() (pypdf) + orchestrates strategy lookup + 200-cap
│       ├── schemas.py           # ChunkRunRequest/Response, Chunk models
│       └── strategies/
│           ├── base.py          # ChunkingStrategy protocol + STRATEGIES registry
│           └── fixed_size.py    # "fixed-size": word-count-based splitting
├── tests/
│   ├── contract/
│   │   └── test_chunking_run.py        # Response shape, 200-cap + totalChunks, validation errors
│   └── unit/
│       ├── test_fixed_size_strategy.py # Word-count splitting behavior, chunk count math
│       └── test_chunking_service.py    # extraction-failure handling, cap enforcement, unknown strategy
├── pyproject.toml               # Adds `pypdf` dependency

frontend/
├── src/
│   ├── types/
│   │   └── chunking.ts          # Chunk, ChunkingResult types
│   ├── lib/
│   │   └── chunkingApi.ts       # fetch wrapper: runChunking(documentId, chunkSize)
│   ├── hooks/
│   │   └── useFixedSizeChunking.ts  # status/result/error state for the screen
│   ├── components/
│   │   ├── layout/
│   │   │   └── SidebarNav.tsx        # Updated: subItems support, Experiments expands
│   │   └── experiments/
│   │       └── FixedSizeChunkingScreen.tsx  # New screen (document picker, chunk size, inert extras, chunk list)
│   └── app/
│       └── App.tsx              # Updated: activeScreen state, renders Sources or the new screen
└── tests/
    ├── unit/
    │   ├── SidebarNav.test.tsx          # Updated: Experiments expands, sub-item navigates
    │   ├── FixedSizeChunkingScreen.test.tsx  # New: document picker, validation, chunk list, cap note, inert extras
    │   └── useFixedSizeChunking.test.ts # New: run success/failure/validation states
    ├── integration/
    │   └── (App-level navigation test, if warranted during /speckit-tasks)
    └── e2e/
        └── fixed-size-chunking.spec.ts  # New: upload → navigate → run → see chunks
```

**Structure Decision**: Adds one new backend module, `backend/app/chunking/`, following the same
`router.py`/`service.py`/`schemas.py` split already established by `backend/app/sources/` and
`backend/app/system/`, plus a small `strategies/` sub-package for the pluggable chunking interface
(research.md §1). On the frontend, adds a new `frontend/src/components/experiments/` directory
(mirroring the existing `components/sources/` pattern) and makes the smallest possible change to
`SidebarNav.tsx` and `App.tsx` to support a second screen (research.md §5, §6) — no routing
library, no restructuring of existing screens.

## Complexity Tracking

*No violations to justify — table intentionally omitted.*
