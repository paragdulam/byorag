# Quickstart: Functional Chunk Overlap Controls

Validates the feature end-to-end: the live numeric Overlap readout, the below-slider chunk count
(right-aligned with Separators), and chunks genuinely overlapping by the configured amount. See
`contracts/chunking-overlap-api.md` for exact request/event shapes and `data-model.md` for field
definitions.

## Prerequisites

- Python 3.12 and the backend's dependencies installed (`cd backend && uv sync`) — no new backend
  dependency is added by this feature.
- Node.js 20 LTS and frontend dependencies installed (`cd frontend && npm install`) — no new
  frontend dependency is added.
- At least one already-uploaded PDF with enough extractable text to produce multiple chunks at a
  small chunk size (e.g., a multi-page document) via the Sources screen (`002-persist-pdf-sources`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Sanity-check the streaming endpoint directly (replace `report.pdf` with a real uploaded filename):

```bash
# Baseline: no overlap (defaults to 0, identical to pre-feature behavior)
curl -N -s "http://localhost:8000/api/chunking/run/stream?documentId=report.pdf&chunkSize=50"
# Expected: terminal `result` event includes "overlap": 0; note its "totalChunks" value.

# With overlap
curl -N -s "http://localhost:8000/api/chunking/run/stream?documentId=report.pdf&chunkSize=50&overlap=20"
# Expected: terminal `result` event includes "overlap": 20; "totalChunks" is higher than the
# overlap=0 run above, and consecutive chunks in "chunks" share trailing/leading words.

# Invalid: overlap equal to chunkSize
curl -s "http://localhost:8000/api/chunking/run/stream?documentId=report.pdf&chunkSize=50&overlap=50"
# Expected: 400 with a detail message (not a stream)

# Invalid: overlap greater than chunkSize
curl -s "http://localhost:8000/api/chunking/run/stream?documentId=report.pdf&chunkSize=50&overlap=75"
# Expected: 400 with a detail message
```

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL and navigate to Chunking → Fixed Size Chunking.

## 3. Validate: live numeric Overlap readout (US1, FR-001, FR-002, SC-001)

1. Select a document and look at the Overlap control. **Expected**: a numeric value is visible
   alongside the slider.
2. Drag the slider to a new position. **Expected**: the displayed number updates immediately, even
   before clicking "Re-Calculate Chunks".

## 4. Validate: chunk count below the Overlap slider (US2, FR-003, FR-004, FR-005, SC-004)

1. Before running chunking at all in this visit, look below the Overlap slider. **Expected**: no
   chunk count is shown yet.
2. Set a chunk size, leave Overlap at `0`, and click "Re-Calculate Chunks". **Expected**: once the
   run completes, a total chunk count appears below the Overlap slider, right-aligned with the
   Separators control above it, matching the count implied by the chunk list.
3. Raise Overlap and click "Re-Calculate Chunks" again. **Expected**: the count updates to the new
   run's total.

## 5. Validate: chunks genuinely overlap (US3, FR-006, FR-007, FR-008, SC-002, SC-003)

1. With Overlap at `0`, run chunking and note the chunk count and the boundary text between the
   first two chunks (no shared words).
2. Raise Overlap to a positive value below the current Chunk Size and re-run. **Expected**: the
   chunk count is now higher than in step 1, and the trailing words of each chunk reappear at the
   start of the next chunk, by roughly the Overlap amount.
3. Set Overlap to a value greater than or equal to the current Chunk Size and attempt to run.
   **Expected**: a clear validation message appears (e.g., "Overlap must be smaller than Chunk
   Size") and chunking does not run — the previous chunk list/count remain displayed unchanged.
4. Lower Overlap back to `0` and re-run. **Expected**: the chunk count returns to the step-1 value.

## 6. Run automated tests

```bash
# Backend: contract + unit tests
cd backend && pytest

# Frontend: unit/component tests
cd frontend && npm test

# Frontend: end-to-end
cd frontend && npm run test:e2e
```
