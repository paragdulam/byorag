# Phase 1 Data Model: System Capacity Widget

No database is introduced (see `research.md` §5). The entities below are computed fresh on each
`GET /api/system/capacity` request from live host introspection; this document describes their
shape as exchanged between backend and frontend, not a storage schema.

## SystemHardwareProfile

Represents the detected hardware of the machine currently running the backend process.

| Field | Type | Source | Notes |
|---|---|---|---|
| `processorName` | string \| null | `platform.processor()` / `platform.uname()` (research.md §2) | Best-effort human-readable string (e.g., `"arm"`, `"x86_64"`); `null` if detection fails — frontend falls back to showing only core count. |
| `cpuCores` | integer \| null | `psutil.cpu_count(logical=True)` | Logical core count. `null` only if `psutil` itself raises (extremely rare) — triggers the widget's fallback state (FR-008). |
| `totalMemoryGb` | number \| null | `psutil.virtual_memory().total / 1024**3`, rounded to 1 decimal | `null` only on detection failure. |
| `gpuDetected` | boolean | `nvidia-smi` present + returns a name (research.md §3) | `false` is the expected, non-error majority case (no dedicated GPU, or running in a container without GPU passthrough). |
| `gpuName` | string \| null | `nvidia-smi --query-gpu=name` output | Present only when `gpuDetected` is `true`. |
| `detectionFailed` | boolean | `true` if CPU/memory detection itself raised (not merely "no GPU") | Drives the widget's explicit fallback message (FR-008); independent of `gpuDetected`, which has its own non-error "false" state. |

**Validation rules**: None — this is read-only, derived data with no user input. All numeric
fields, when present, are non-negative by construction (subprocess/`psutil` outputs).

**State transitions**: None. Computed and discarded per-request; nothing is persisted (matches the
"static snapshot, not a live/tracked meter" clarification in `spec.md`).

## PdfCapacityEstimate

Represents the derived, approximate processing ceiling for the detected hardware.

| Field | Type | Source | Notes |
|---|---|---|---|
| `maxPdfCount` | integer | `capacity_score` formula (research.md §4) | Floored at a small non-zero value via `MIN_SCORE` — never `0` or negative (spec edge case: low-resource machines still get a rendered, explained figure). |
| `maxTotalSizeGb` | number | Same formula, rounded to 1 decimal | Independent figure from `maxPdfCount` — presented as two separate limits, not one blended number (clarification Q3). |
| `basis` | `"full"` \| `"cpu-only"` | `"cpu-only"` when `gpuDetected` is `false` | Lets the frontend caption the estimate accurately (e.g., "CPU-only estimate") without re-deriving it from `gpuDetected` itself. |

**Validation rules**:
- `maxPdfCount >= 1` and `maxTotalSizeGb > 0` always (via `MIN_SCORE` floor — research.md §4);
  the widget never renders `0`/negative without explanation, per spec edge cases.
- Both figures MUST increase monotonically with each of `totalMemoryGb`, `cpuCores`, and
  `gpuDetected` individually, holding the others fixed (FR-010) — enforced by unit tests
  (`test_capacity_estimate.py`) parametrized across a range of hardware inputs, not by runtime
  validation.

**State transitions**: None — recomputed from `SystemHardwareProfile` on every request; not
tracked against uploaded document volume (FR-005a).

**Relationship**: `PdfCapacityEstimate` is derived entirely from `SystemHardwareProfile` within
the same request; when `SystemHardwareProfile.detectionFailed` is `true`, no `PdfCapacityEstimate`
is computed at all — the API omits it (see `contracts/`) and the frontend shows only the fallback
message, not a bogus estimate from partial/absent data.

## API response shape

Both entities are returned together in a single `GET /api/system/capacity` response — see
`contracts/system-capacity.md` for the full schema, including the `detectionFailed` case.

## Relationship to existing frontend types

`frontend/src/types/sourceDocument.ts` currently defines `VectorStorageStat` (the placeholder this
feature removes). This feature:
- Deletes `VectorStorageStat` from `sourceDocument.ts` (it has no other consumers — only
  `VectorStorageWidget.tsx`, which is also deleted).
- Adds a new `frontend/src/types/systemCapacity.ts` with `SystemHardwareProfile` and
  `PdfCapacityEstimate` TypeScript interfaces mirroring the table shapes above (`camelCase`
  fields, matching the existing `sourceDocument.ts` convention).

No other frontend-facing entity changes; the `SourceDocument` / `UploadRejection` types from 002
are untouched by this feature.
