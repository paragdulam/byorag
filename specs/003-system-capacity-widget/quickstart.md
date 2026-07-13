# Quickstart: System Capacity Widget

Validates the feature end-to-end: the Vector Storage widget is gone, and the Data Sources screen's
top-right now shows real host hardware plus a hardware-derived PDF capacity estimate. See
`contracts/system-capacity-api.md` for exact request/response shapes and `data-model.md` for field
definitions.

## Prerequisites

- Python 3.12 and the backend's dependencies installed (`cd backend && uv sync`), including the
  new `psutil` dependency added by this feature.
- Node.js 20 LTS and frontend dependencies installed (`cd frontend && npm install`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Expected: server starts on `http://localhost:8000` as before (unchanged from 002); the new
`GET /api/system/capacity` endpoint is available immediately (no setup step required — it reads
live host state on each call, nothing to initialize).

Sanity-check it directly:

```bash
curl -s http://localhost:8000/api/system/capacity | python3 -m json.tool
```

**Expected**: a `200` JSON body with `hardware` and `estimate` objects matching
`contracts/system-capacity-api.md`. On a typical dev machine without an NVIDIA GPU, expect
`hardware.gpuDetected: false` and `estimate.basis: "cpu-only"` — this is the normal case, not a
bug (research.md §3).

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL and navigate to the Data Sources screen.

## 3. Validate: Vector Storage is gone (User Story 1)

1. Load the Data Sources screen.
2. **Expected**: no "VECTOR STORAGE" label, GB figure, or "% of capacity" text anywhere on the
   page (SC-001).

## 4. Validate: hardware is shown top-right (User Story 2)

1. Look at the top-right of the Data Sources screen, in the position the Vector Storage widget
   used to occupy.
2. **Expected**: processor info (name and/or core count) and a GPU status line — either the
   detected GPU's name, or an explicit "no dedicated GPU detected" statement matching your
   machine.
3. Reload the page and watch the widget on first paint. **Expected**: a brief loading state
   appears before the values settle — no flash of blank/zeroed fields (FR-009).

## 5. Validate: capacity estimate is shown and scales with hardware (User Story 3)

1. On the same widget, confirm two distinct figures are shown: a maximum PDF count and a maximum
   total size (e.g., "~64 PDFs" and "~1.3 GB"), each visibly labeled as an estimate (FR-007).
2. Compare the estimate across two different machines (or simulate by adjusting detected inputs in
   a unit test — see step 6) — a lower-RAM/lower-core machine must show a visibly smaller estimate
   than a higher-spec one (FR-010, SC-003).
3. Temporarily rename/hide `nvidia-smi` from `PATH` (or run on a machine without one) and reload —
   **expected**: `gpuDetected: false`, the widget states no dedicated GPU, and the estimate is
   still a valid, non-zero figure computed CPU/RAM-only (edge case: GPU absence never breaks
   rendering).

## 6. Run automated tests

```bash
# Backend: contract + unit tests (formula monotonicity, GPU-absent and detection-failure fallback)
cd backend && pytest

# Frontend: unit/component tests (loading, GPU-present, no-GPU, fallback states)
cd frontend && npm test

# Frontend: end-to-end (includes the Vector-Storage-is-absent assertion)
cd frontend && npm run test:e2e
```

## 7. (Optional) Validate the Docker default (no GPU passthrough)

```bash
docker compose up --build
# open the compose-exposed frontend URL, load the Data Sources screen
```

**Expected**: since the project's default `docker-compose.yml` has no GPU passthrough configured,
the widget correctly shows "no dedicated GPU detected" and a CPU/RAM-only estimate inside the
container — proving the feature degrades gracefully in the project's own default deployment, not
just in ad-hoc local runs.
