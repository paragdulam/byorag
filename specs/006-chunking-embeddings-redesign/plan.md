# Implementation Plan: Chunking Section Redesign & Embeddings Entry Point

**Branch**: `006-chunking-embeddings-redesign` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-chunking-embeddings-redesign/spec.md`

## Summary

Redesign the existing Fixed Size Chunking screen (005) and its navigation entry: rename the
"Experiments" sidebar section to "Chunking," delete the inert Recursive Character / Semantic
Chunking / Fixed Size algorithm-picker control (Fixed Size is now the screen's implicit, only
strategy), and add a sibling "Embeddings" nav item that leads to a minimal "coming soon"
placeholder screen. The screen itself becomes: a single horizontal control bar (Select Document,
Chunk Size, Overlap, Separators) below the existing sub-header, a real 0→100% progress bar driven
by actual backend page-extraction progress (clarified requirement — not a simulated timer), an
internally-scrollable chunk list, and a bottom action bar with "Re-calculate Chunks" and "Move to
Embeddings" (disabled until a chunk run has succeeded at least once this session). Real progress
requires converting the backend's single-shot `POST /api/chunking/run` into a Server-Sent-Events
`GET /api/chunking/run/stream` endpoint — the only structural backend change; the fixed-size
chunking logic itself (`strategies/fixed_size.py`, the 200-chunk cap) is untouched.

## Technical Context

**Language/Version**: Backend: Python 3.12 (unchanged). Frontend: TypeScript 5.x on React 19,
Node.js 20 LTS (unchanged).

**Primary Dependencies**: No new dependency on either side. Backend: reuses `fastapi`'s built-in
`StreamingResponse` for Server-Sent Events (research.md §1) — no SSE library added. Frontend:
reuses the browser-native `EventSource` API (research.md §4) — no new frontend dependency; no
routing library and no list-virtualization library are introduced (research.md §5, unchanged
stance from 005).

**Storage**: N/A — unchanged from 005. Chunking results remain computed fresh per run, never
persisted. Reads the same `PDFS_DIR` filesystem storage from `002-persist-pdf-sources`.

**Testing**: Backend: pytest + FastAPI `TestClient`, consuming the new endpoint's streamed body
directly (contract test for `GET /api/chunking/run/stream`: progress-then-result event ordering,
pre-stream 400/404 validation unchanged from 005, extraction-failure still surfaced via the
terminal event); unit tests for per-page progress calculation. Frontend: Vitest + React Testing
Library (`SidebarNav` rename + two-subitem test, the redesigned screen's layout/gating/progress
tests, a new `EmbeddingsScreen` test, an updated `useFixedSizeChunking` hook test against a mocked
`EventSource`), Playwright (e2e: upload → navigate → configure via the horizontal bar → run → see
progress and chunks → Move to Embeddings once enabled → see the placeholder) — required by
constitution Principle II.

**Target Platform**: Backend: Linux server container (Docker) or local process (unchanged).
Frontend: desktop web browsers (unchanged) — `EventSource` is natively supported.

**Project Type**: Web application — modifies the existing `backend/app/chunking` module and
renames/extends the existing `frontend/src/components/experiments` screen; adds one new frontend
placeholder screen (`EmbeddingsScreen`). No new top-level project.

**Performance Goals**: No hard latency target set in the spec (unchanged from 005). The streaming
endpoint reports progress as pages are actually extracted; there is no artificial delay or target
duration.

**Constraints**: The 200-chunk display cap and its "more chunks exist" note are unchanged from 005
(FR-011/SC-005 here reuse that behavior). The progress bar MUST reflect real backend progress, not
a client-side simulation (clarified requirement, research.md §1). "Move to Embeddings" MUST stay
disabled until a chunk run has completed successfully at least once this session (research.md §7).
The screen MUST fit the viewport without page-level scrolling; only the chunk list scrolls
(FR-016, research.md §6).

**Scale/Scope**: Single local user, one document selected at a time; one backend endpoint replaced
(not added net-new) with a streaming variant; one frontend screen redesigned in place plus one new
placeholder screen and a small `SidebarNav` update. No caching or persistence layer — consistent
with constitution Principle III.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Pluggable RAG Architecture | Pass | The `ChunkingStrategy` registry from 005 (`strategies/base.py`) is untouched — `"fixed-size"` remains a registered strategy, not a hardcoded branch, so future strategies can still be added by registration. Removing the *inert* UI picker (which never actually switched strategies — 005 research.md §"reference-design controls") does not reduce pluggability; the server-side registry is what Principle I protects. |
| II. Test-First, Test at Every Level | Pass (enforced in tasks) | New/updated backend contract test for the streaming endpoint, unit tests for per-page progress math, updated frontend component tests (control bar layout, progress states, button gating, no-algorithm-picker), a new `EmbeddingsScreen` test, an updated hook test, and an updated Playwright e2e flow. All required in `tasks.md` before implementation is considered done. |
| III. Single-User Simplicity (YAGNI) | Pass | Progress reporting uses a single streamed HTTP response (research.md §1) instead of a job queue, WebSocket server, or persisted job-state polling endpoint. "Move to Embeddings" gating is a one-way in-memory latch (research.md §7), not a persisted flag. No list-virtualization library added for a 200-item cap (research.md §5). |
| IV. Fixed Technology Stack | Pass | Backend stays Python/FastAPI (using its existing `StreamingResponse` capability, not a new framework); frontend stays React, using the browser-native `EventSource` (no new dependency). No change to Qdrant or the Docker/docker-compose deployment approach. |
| V. Experiment Observability & Reproducibility | N/A | Unchanged from 005 — per spec Assumptions, chunking runs in this feature remain ephemeral and not saved/tracked. This principle becomes relevant once a future feature adds run history — not this redesign. |

No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/006-chunking-embeddings-redesign/
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
│       ├── router.py            # Updated: GET /api/chunking/run/stream (SSE) replaces POST /run
│       ├── service.py           # Updated: stream_chunking() generator yields per-page progress,
│       │                        #   then the terminal ChunkRunResponse; extract_text() reworked
│       │                        #   into a page-by-page generator it wraps
│       ├── schemas.py           # Updated: ChunkRunRequest removed; Chunk/ChunkingResult/
│       │                        #   ChunkRunResponse unchanged
│       └── strategies/          # Unchanged (base.py registry, fixed_size.py)
├── tests/
│   ├── contract/
│   │   └── test_chunking_stream.py     # New: replaces test_chunking_run.py — SSE event order,
│   │                                   #   pre-stream 400/404, extraction-failed terminal event
│   └── unit/
│       ├── test_fixed_size_strategy.py # Unchanged
│       └── test_chunking_service.py    # Updated: per-page progress percent calculation,
│                                        #   cap enforcement, unknown strategy/validation errors

frontend/
├── src/
│   ├── types/
│   │   └── chunking.ts          # Updated: adds ChunkProgressEvent type
│   ├── lib/
│   │   └── chunkingApi.ts       # Updated: runChunkingStream() via EventSource, replaces the
│   │                            #   old fetch-based runChunking()
│   ├── hooks/
│   │   └── useFixedSizeChunking.ts  # Updated: adds progressPercent, hasSucceededOnce
│   ├── components/
│   │   ├── layout/
│   │   │   └── SidebarNav.tsx        # Updated: "Experiments" → "Chunking"; ScreenId/NAV_ITEMS
│   │   │                             #   gain the "Embeddings" sub-item
│   │   └── chunking/                 # Renamed from components/experiments/
│   │       ├── FixedSizeChunkingScreen.tsx  # Rewritten: horizontal control bar, progress bar,
│   │       │                                #   scrollable chunk list, bottom action bar;
│   │       │                                #   algorithm-picker UI removed
│   │       └── EmbeddingsScreen.tsx          # New: "coming soon" placeholder screen
│   └── app/
│       └── App.tsx              # Updated: renders EmbeddingsScreen for the 'embeddings' screen id
└── tests/
    ├── unit/
    │   ├── SidebarNav.test.tsx          # Updated: "Chunking" label, two sub-items
    │   ├── FixedSizeChunkingScreen.test.tsx  # Updated: control-bar layout, progress states,
    │   │                                      #   button gating, no algorithm picker present
    │   ├── EmbeddingsScreen.test.tsx     # New
    │   └── useFixedSizeChunking.test.ts # Updated: progress/result/error via a mocked EventSource
    └── e2e/
        └── fixed-size-chunking.spec.ts  # Updated: upload → navigate → configure → run → see
                                          #   progress + chunks → Move to Embeddings → placeholder
```

**Structure Decision**: This is a redesign in place, not a new module: the backend keeps its
existing `backend/app/chunking/` module (only `router.py`/`service.py`/`schemas.py` change; the
`strategies/` sub-package is untouched). On the frontend, `components/experiments/` is renamed to
`components/chunking/` to match the renamed nav section (FR-001), `FixedSizeChunkingScreen.tsx` is
rewritten in place rather than replaced, and one new sibling component (`EmbeddingsScreen.tsx`) is
added for the new nav destination — mirroring the existing `AppShell`-wrapped screen pattern used
by `DataSourcesScreen` and the current chunking screen. No routing library, no new top-level
directory.

## Complexity Tracking

*No violations to justify — table intentionally omitted.*
