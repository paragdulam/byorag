# Contract: System Capacity API

Base path: `/api/system`. No authentication (single local user). All responses are
`application/json`.

---

## `GET /api/system/capacity`

Returns the detected hardware profile of the machine running the backend, plus a derived PDF
processing capacity estimate. Always returns `200 OK` — detection failure is expressed in the
response body (`detectionFailed: true`), not an HTTP error status, since a widget-render failure
is worse than a body that says "unknown" (FR-008).

**Response `200 OK` — hardware detected successfully, dedicated GPU present**:

```json
{
  "hardware": {
    "processorName": "x86_64",
    "cpuCores": 16,
    "totalMemoryGb": 32.0,
    "gpuDetected": true,
    "gpuName": "NVIDIA GeForce RTX 4090",
    "detectionFailed": false
  },
  "estimate": {
    "maxPdfCount": 300,
    "maxTotalSizeGb": 6.0,
    "basis": "full"
  }
}
```

**Response `200 OK` — hardware detected, no dedicated GPU (the expected majority case, including
the project's default `docker-compose.yml` with no GPU passthrough)**:

```json
{
  "hardware": {
    "processorName": "x86_64",
    "cpuCores": 4,
    "totalMemoryGb": 8.0,
    "gpuDetected": false,
    "gpuName": null,
    "detectionFailed": false
  },
  "estimate": {
    "maxPdfCount": 64,
    "maxTotalSizeGb": 1.3,
    "basis": "cpu-only"
  }
}
```

**Response `200 OK` — detection failed**:

```json
{
  "hardware": {
    "processorName": null,
    "cpuCores": null,
    "totalMemoryGb": null,
    "gpuDetected": false,
    "gpuName": null,
    "detectionFailed": true
  },
  "estimate": null
}
```

**Field semantics**:
- `hardware.processorName` — best-effort string; `null` if unavailable even when the rest of
  detection succeeds (e.g., an unrecognized platform string).
- `hardware.cpuCores` / `hardware.totalMemoryGb` — `null` only when `detectionFailed` is `true`.
- `hardware.gpuDetected` — `false` is a normal, non-error result (no dedicated GPU, or no GPU
  passthrough into the container). It is never `null`.
- `hardware.gpuName` — present only when `gpuDetected` is `true`; otherwise `null`.
- `hardware.detectionFailed` — `true` only when core CPU/memory introspection itself raised (not
  merely "no GPU", which is a normal `gpuDetected: false`). When `true`, `estimate` is `null` and
  the frontend renders the fallback message (FR-008) instead of a widget with a bogus number.
  This is the **only** condition under which `estimate` is `null`.
- `estimate.maxPdfCount` / `estimate.maxTotalSizeGb` — independent figures (clarification Q3); see
  `research.md` §4 and `data-model.md` for the derivation and monotonicity guarantee (FR-010).
- `estimate.basis` — `"cpu-only"` when `hardware.gpuDetected` is `false`, `"full"` otherwise; lets
  the frontend caption the figure without re-deriving it.

**Error responses**: None expected in normal operation — this endpoint takes no input and has no
failure mode that isn't already represented as `detectionFailed: true` in a `200` body. A `500`
would only occur on a genuine unhandled server bug, not a supported detection-failure path.
