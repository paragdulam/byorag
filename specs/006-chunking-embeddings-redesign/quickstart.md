# Quickstart: Chunking Section Redesign & Embeddings Entry Point

Validates the feature end-to-end: the renamed "Chunking" nav section, the horizontal control bar,
real backend-driven progress, the internally-scrollable chunk list, the gated "Move to Embeddings"
button, and the new Embeddings placeholder screen. See `contracts/chunking-stream-api.md` for
exact request/event shapes and `data-model.md` for field definitions.

## Prerequisites

- Python 3.12 and the backend's dependencies installed (`cd backend && uv sync`) — no new backend
  dependency is added by this feature (research.md §1).
- Node.js 20 LTS and frontend dependencies installed (`cd frontend && npm install`) — no new
  frontend dependency is added (research.md §4, §5).
- At least one PDF already uploaded via the Sources screen (`002-persist-pdf-sources`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Sanity-check the new streaming endpoint directly (replace `report.pdf` with a real uploaded
filename; `curl -N` disables buffering so events print as they arrive):

```bash
curl -N -s "http://localhost:8000/api/chunking/run/stream?documentId=report.pdf&chunkSize=50"
```

**Expected**: one or more `event: progress` frames with increasing `percent` values (0–90),
followed by exactly one `event: result` frame whose `data` matches
`contracts/chunking-stream-api.md` (`extractionFailed: false`, `result.chunks`,
`result.totalChunks`, `result.strategy: "fixed-size"`, `result.chunkSize`).

```bash
# Invalid chunk size — still a plain HTTP error, not a stream (research.md §3)
curl -s "http://localhost:8000/api/chunking/run/stream?documentId=report.pdf&chunkSize=0"
# Expected: 400 with a detail message

# Unknown document — still a plain HTTP error
curl -s "http://localhost:8000/api/chunking/run/stream?documentId=does-not-exist.pdf&chunkSize=50"
# Expected: 404 with a detail message
```

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL.

## 3. Validate: the renamed "Chunking" section and the new "Embeddings" item (FR-001, FR-003)

1. On any screen, open the left sidebar. **Expected**: the section previously labeled
   "Experiments" now reads "Chunking"; no "Experiments" label remains anywhere.
2. Expand "Chunking". **Expected**: two sub-items are listed — "Fixed Size Chunking" and
   "Embeddings".
3. Select "Fixed Size Chunking". **Expected**: the screen opens with the "Configure how documents
   are partitioned" sub-header, and no algorithm-selection control ("Recursive Character",
   "Semantic Chunking", "Fixed Size" radio options) is present anywhere (FR-002).

## 4. Validate: the horizontal control bar and layout fits on screen (FR-005, FR-016)

1. Confirm a single horizontal bar sits directly below the sub-header containing, in order: Select
   Document, Chunk Size, Overlap, Separators.
2. Resize the browser window to a short height. **Expected**: the control bar and the bottom
   action bar stay visible; only the chunk list area shrinks (no page-level scrollbar appears).

## 5. Validate: real progress and the chunk list (FR-010, FR-011, FR-012, SC-003)

1. Select an already-uploaded document, set a chunk size (e.g., `50`), and click
   "Re-calculate Chunks".
2. **Expected**: a progress bar appears and advances from 0% toward 100% while the request is in
   flight, then the chunk list renders below the control bar.
3. Repeat with a larger, multi-page document if available. **Expected**: the progress bar visibly
   passes through intermediate percentages (not an instant 0→100 jump), reflecting real
   page-by-page extraction progress (research.md §1).
4. If a chunk list longer than the visible area is produced, confirm it scrolls independently
   (mouse wheel over the list) while the control bar and bottom bar remain fixed in place (FR-012,
   SC-005).
5. (If you have a scanned/image-only PDF available) select it and trigger chunking. **Expected**: a
   clear "text could not be extracted" message, no chunk list (unchanged from 005).

## 6. Validate: "Move to Embeddings" gating and the placeholder screen (FR-015, FR-015a)

1. Reload the Fixed Size Chunking screen fresh (or open it before ever running chunking this
   session). **Expected**: the "Move to Embeddings" button in the bottom bar is disabled.
2. Click "Re-calculate Chunks" and wait for it to complete successfully. **Expected**: "Move to
   Embeddings" becomes enabled.
3. Click "Move to Embeddings". **Expected**: the app navigates to the Embeddings screen, which
   shows the standard navigation shell plus a short "coming soon" message and no functional
   controls.
4. Navigate back to "Fixed Size Chunking" via the sidebar and separately confirm clicking the
   "Embeddings" sidebar sub-item also reaches the same placeholder screen, regardless of whether a
   chunk run has completed in this visit.

## 7. Run automated tests

```bash
# Backend: contract + unit tests
cd backend && pytest

# Frontend: unit/component tests
cd frontend && npm test

# Frontend: end-to-end (upload → navigate → configure → run → see progress and chunks →
# move to Embeddings)
cd frontend && npm run test:e2e
```
