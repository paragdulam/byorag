# Implementation Plan: System Capacity Widget

**Branch**: `003-system-capacity-widget` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-system-capacity-widget/spec.md`

## Summary

Remove the placeholder "Vector Storage" widget from the top-right of the Data Sources screen and
replace it with a System Capacity widget in the same position. The new widget shows the host
machine's real processor, GPU status, and memory (sourced from a new backend endpoint, since
browsers can't reliably read this), plus a static, hardware-derived estimate of the maximum PDF
count and maximum total size the machine can reasonably handle for the full local RAG workflow
(chunking, embedding, vector semantic search). The estimate is an explicitly-labeled
approximation computed from a weighted RAM/CPU/GPU formula — see `research.md` §4 — not a live
meter tied to what's actually uploaded.

## Technical Context

**Language/Version**: Backend: Python 3.12 (unchanged from 002). Frontend: TypeScript 5.x on
React 19, Node.js 20 LTS (unchanged).

**Primary Dependencies**: Backend: adds `psutil` (cross-platform CPU core count + total memory)
to `backend/pyproject.toml`; GPU detection shells out to `nvidia-smi` when present (no new
dependency — see `research.md` §3). Frontend: unchanged (React, Vite, Tailwind CSS); adds a small
`fetch`-based API client following the existing `sourcesApi.ts` pattern, no new UI libraries.

**Storage**: N/A — hardware info and the capacity estimate are computed fresh on each request, not
persisted (matches the "static snapshot, not a live/tracked meter" clarification).

**Testing**: Backend: pytest + FastAPI `TestClient` (contract test for
`GET /api/system/capacity`; unit tests for the capacity-scoring formula across a range of
RAM/CPU/GPU inputs, and for GPU-absent/detection-failure fallback behavior). Frontend: Vitest +
React Testing Library (widget/hook tests covering loading, GPU-present, no-GPU, and
detection-unavailable-fallback states), Playwright (updated e2e assertion that the Vector Storage
widget is gone and the new widget renders) — required by constitution Principle II.

**Target Platform**: Backend: Linux server container (Docker) or local process (unchanged
deployment options from 002). Frontend: desktop web browsers (unchanged).

**Project Type**: Web application — extends the existing `backend/` and `frontend/` projects from
002 with one new backend module (`system`) and a frontend widget swap; no new top-level project.

**Performance Goals**: The widget's data (hardware info + estimate) is visible within the spec's
5-second budget (SC-002) after the Data Sources screen finishes loading; the `GET
/api/system/capacity` call itself is expected to return in well under 1 second (a few `psutil`
calls plus one short-timeout subprocess call), and is fetched asynchronously so it never blocks
the upload area or document list from becoming usable (FR-009).

**Constraints**: Detection failures must degrade to an explicit fallback message, never a blank
field or broken page (FR-008); GPU absence must degrade to an explicit "no dedicated GPU" state
that still produces a valid CPU/RAM-only estimate, never an error (FR-003, edge cases); the
estimate must be monotonic in its inputs so lower-resource hardware visibly yields a lower
estimate (FR-010).

**Scale/Scope**: Single local user, single machine, one widget, one new read-only endpoint. No
history, no per-user variation, no caching layer — consistent with constitution Principle III.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Pluggable RAG Architecture | N/A | This feature adds no ingestion/chunking/embedding/retrieval logic and defines no strategy interface — it only *estimates* capacity for a future pipeline. The estimate's constants are generic hardware heuristics, not tied to any specific chunking/embedding strategy, so they neither satisfy nor block future pluggability work. |
| II. Test-First, Test at Every Level | Pass (enforced in tasks) | Backend contract test (`GET /api/system/capacity`), unit tests (scoring formula across hardware inputs, GPU-absent fallback, detection-failure fallback), frontend widget/hook tests (loading, GPU-present, no-GPU, fallback states), and an updated Playwright e2e assertion. All required in `tasks.md` before implementation is considered done. |
| III. Single-User Simplicity (YAGNI) | Pass | One read-only endpoint, no auth, no persistence, no caching, one new lightweight dependency (`psutil`); GPU detection reuses an existing OS-level tool (`nvidia-smi`) via subprocess rather than adding a dependency. |
| IV. Fixed Technology Stack | Pass | Backend stays Python/FastAPI, frontend stays React — `psutil` is an additive introspection library (same category as `python-multipart` added in 002), not a stack change. No change to Qdrant (still not introduced) or the Docker/docker-compose deployment approach; the feature is designed to degrade gracefully (no dedicated GPU) in the project's default `docker-compose.yml`, which has no GPU passthrough configured. |
| V. Experiment Observability & Reproducibility | N/A | This is a pre-experiment advisory widget, not an experiment run — it records no configuration or results and has nothing to trace. |

No unjustified violations. No entries required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-system-capacity-widget/
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
│   ├── main.py                  # Updated: mounts the new system router
│   ├── sources/                 # Existing (002), unchanged
│   └── system/
│       ├── router.py            # GET /api/system/capacity
│       ├── service.py           # CPU/RAM/GPU detection + capacity-score formula (research.md §2-4)
│       └── schemas.py           # SystemCapacityResponse Pydantic model
├── tests/
│   ├── contract/
│   │   └── test_system_capacity.py     # Response shape, 200 status, field presence
│   └── unit/
│       ├── test_capacity_estimate.py   # Formula: monotonicity, MIN_SCORE floor, GPU on/off
│       └── test_hardware_detection.py  # psutil wrapping, nvidia-smi absent/failure fallback
└── pyproject.toml               # Adds `psutil` dependency

frontend/
├── src/
│   ├── types/
│   │   └── systemCapacity.ts    # SystemCapacity type; VectorStorageStat removed from sourceDocument.ts
│   ├── lib/
│   │   └── systemApi.ts         # fetch wrapper: getSystemCapacity(), mirrors sourcesApi.ts
│   ├── hooks/
│   │   └── useSystemCapacity.ts # Loading/data/fallback state for the widget
│   └── components/sources/
│       ├── SystemCapacityWidget.tsx  # New: replaces VectorStorageWidget.tsx
│       ├── VectorStorageWidget.tsx   # Deleted
│       └── DataSourcesScreen.tsx     # Updated: swaps widget import/usage (same top-right slot)
└── tests/
    ├── unit/
    │   ├── SystemCapacityWidget.test.tsx  # New: replaces VectorStorageWidget.test.tsx (deleted)
    │   └── useSystemCapacity.test.ts      # Loading/success/fallback states, mocked fetch
    ├── integration/
    │   └── DataSourcesScreen.test.tsx     # Updated: asserts no "VECTOR STORAGE" text, asserts new widget renders
    └── e2e/
        └── data-sources-screen.spec.ts    # Updated: adds assertion that Vector Storage is absent
```

**Structure Decision**: Extends the existing web application (backend/ + frontend/ from 002) with
one new backend module, `backend/app/system/`, following the exact `router.py` /
`service.py` / `schemas.py` split already established by `backend/app/sources/` — no new
top-level project, no new architectural pattern. On the frontend, `VectorStorageWidget.tsx` is
deleted outright (not deprecated in place) and replaced by `SystemCapacityWidget.tsx` mounted at
the identical call site in `DataSourcesScreen.tsx`, with a matching `systemApi.ts` / hook pair
mirroring the existing `sourcesApi.ts` / `useSourceDocuments.ts` pattern.

## Complexity Tracking

*No violations to justify — table intentionally omitted.*
