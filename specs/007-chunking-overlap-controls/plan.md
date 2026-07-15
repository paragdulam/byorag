# Implementation Plan: Functional Chunk Overlap Controls

**Branch**: `007-chunking-overlap-controls` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-chunking-overlap-controls/spec.md`

## Summary

The Overlap slider on the Fixed Size Chunking screen is currently cosmetic: it holds local UI
state but is never sent to the backend, has no visible numeric value, and the fixed-size splitting
algorithm has no overlap concept at all (`backend/app/chunking/strategies/fixed_size.py` splits
with a fixed, non-overlapping `chunk_size` stride). This feature makes Overlap load-bearing end to
end: the slider gets a live numeric readout, a new below-slider element shows the most recent run's
total chunk count (right-aligned with Separators), and `overlap` is threaded from the screen
through the SSE streaming endpoint into `FixedSizeStrategy.chunk`, which changes its window stride
from `chunk_size` to `chunk_size - overlap` so consecutive chunks genuinely share trailing/leading
content. `overlap >= chunk_size` is rejected client-side (and defensively server-side) with the
same validation pattern already used for an invalid chunk size.

## Technical Context

**Language/Version**: Backend: Python 3.12 (unchanged). Frontend: TypeScript 5.x on React 19,
Node.js 20 LTS (unchanged).

**Primary Dependencies**: No new dependency on either side. Backend: same `fastapi` +
`StreamingResponse` SSE endpoint introduced in `006-chunking-embeddings-redesign` — only its query
parameters and response schema change. Frontend: same browser-native `EventSource` API
(`chunkingApi.ts`) — only the query string and the screen's rendering change.

**Storage**: N/A — unchanged. Chunking results remain computed fresh per run and are never
persisted; reads the same `PDFS_DIR` filesystem storage from `002-persist-pdf-sources`.

**Testing**: Backend: pytest, extending `test_fixed_size_strategy.py` (overlap stride behavior),
`test_chunking_service.py` (overlap validation + effect on `totalChunks`), and
`test_chunking_stream.py` (contract test for the new `overlap` query param and response field).
Frontend: Vitest + React Testing Library, extending `useFixedSizeChunking.test.ts` (overlap
forwarded to the stream URL) and `FixedSizeChunkingScreen.test.tsx` (live numeric readout,
below-slider chunk count, client-side overlap-vs-chunk-size validation); Playwright, extending
`fixed-size-chunking.spec.ts`. Required by constitution Principle II (NON-NEGOTIABLE).

**Target Platform**: Backend: Linux server container (Docker) or local process (unchanged).
Frontend: desktop web browsers (unchanged).

**Project Type**: Web application — modifies the existing `backend/app/chunking` module
(`strategies/base.py`, `strategies/fixed_size.py`, `service.py`, `schemas.py`, `router.py`) and the
existing `frontend/src/components/chunking/FixedSizeChunkingScreen.tsx` +
`frontend/src/hooks/useFixedSizeChunking.ts` + `frontend/src/lib/chunkingApi.ts` +
`frontend/src/types/chunking.ts`. No new top-level project, module, or screen.

**Performance Goals**: No new hard latency target. Overlap only changes the stride used to slice
already-extracted text in memory (an O(1) arithmetic change to an existing O(n) list
comprehension) — no measurable performance impact expected beyond producing more, smaller/shared
chunks when overlap is high, which the existing 200-chunk display cap already bounds.

**Constraints**: `overlap` MUST be strictly less than `chunk_size` so the stride
(`chunk_size - overlap`) stays positive — Python's `range()` requires a non-zero, non-negative
step, so this is also a technical necessity, not just a UX rule. The existing 200-chunk display cap
and `MAX_CHUNKS` behavior (`005-fixed-size-chunking` FR-007a) are unchanged and continue to apply
however many chunks a high-overlap run produces.

**Scale/Scope**: Single local user, one document per run (unchanged). Touches 5 backend files and
4 frontend files identified in research.md §3 — no new files except tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Pluggable RAG Architecture**: PASS. `overlap` is added to the shared `ChunkingStrategy`
  protocol as `overlap: int = 0`, so any future strategy may ignore it without breaking the
  interface; only the registered `"fixed-size"` strategy currently uses it. No hardcoded branching
  is introduced — the strategy registry lookup in `service.py` is unchanged.
- **II. Test-First, Test at Every Level**: PASS (see Testing above) — every touched layer
  (strategy unit, service unit, streaming contract, frontend hook, frontend screen, e2e) gets new
  or extended test coverage before/alongside implementation.
- **III. Single-User Simplicity (YAGNI)**: PASS. No persistence introduced; the below-slider chunk
  count reuses the existing `totalChunks` field rather than adding new state or storage
  (research.md §4).
- **IV. Fixed Technology Stack**: PASS. No new frameworks, libraries, or infrastructure — same
  FastAPI/SSE/React/EventSource stack as `005`/`006`.
- **V. Experiment Observability & Reproducibility**: PASS. `overlap` is echoed back in
  `ChunkingResult` (alongside the existing `chunkSize` echo) so a chunking run's configuration
  remains fully traceable from its result, consistent with how `chunkSize`/`strategy` are already
  echoed.

No violations identified — Complexity Tracking is not needed for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/007-chunking-overlap-controls/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── chunking-overlap-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   └── chunking/
│       ├── router.py               # + `overlap` query param on GET /run/stream
│       ├── service.py              # + overlap validation (resolve_run), + overlap threading (stream_chunking)
│       ├── schemas.py               # + `overlap: int` field on ChunkingResult
│       └── strategies/
│           ├── base.py              # ChunkingStrategy protocol: + overlap: int = 0
│           └── fixed_size.py        # FixedSizeStrategy.chunk: overlapping stride (research.md §1)
└── tests/
    ├── unit/
    │   ├── test_fixed_size_strategy.py   # + overlap stride cases
    │   └── test_chunking_service.py      # + overlap validation / totalChunks effect cases
    └── contract/
        └── test_chunking_stream.py       # + overlap query param + response field cases

frontend/
├── src/
│   ├── components/chunking/
│   │   └── FixedSizeChunkingScreen.tsx   # live overlap readout, below-slider chunk count, overlap validation
│   ├── hooks/
│   │   └── useFixedSizeChunking.ts       # run(documentId, chunkSize, overlap)
│   ├── lib/
│   │   └── chunkingApi.ts                # + overlap query param on the EventSource URL
│   └── types/
│       └── chunking.ts                   # + overlap: number on ChunkingResult
└── tests/
    ├── unit/
    │   ├── useFixedSizeChunking.test.ts       # + overlap forwarding case
    │   └── FixedSizeChunkingScreen.test.tsx   # + readout / count / validation cases
    └── e2e/
        └── fixed-size-chunking.spec.ts         # + overlap-driven chunk count change
```

**Structure Decision**: Existing web-application layout (`backend/` + `frontend/`, established by
`001`–`006`) is unchanged. This feature only edits files inside the existing
`backend/app/chunking` module and the existing chunking-related frontend components/hooks/lib/types
— no new directories, modules, or screens are introduced.

## Complexity Tracking

*No violations identified — table intentionally omitted.*
