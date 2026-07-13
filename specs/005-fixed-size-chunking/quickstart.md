# Quickstart: Fixed Size Chunking Experiment

Validates the feature end-to-end: reaching the screen via the sidebar, running fixed-size chunking
on a real document, and seeing the results (including the capped-list behavior). See
`contracts/chunking-api.md` for exact request/response shapes and `data-model.md` for field
definitions.

## Prerequisites

- Python 3.12 and the backend's dependencies installed (`cd backend && uv sync`), including the
  new `pypdf` dependency added by this feature (lightweight — research.md §2).
- Node.js 20 LTS and frontend dependencies installed (`cd frontend && npm install`).
- At least one PDF already uploaded via the Sources screen (`002-persist-pdf-sources`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Sanity-check the new endpoint directly (replace `report.pdf` with a real uploaded filename):

```bash
curl -s -X POST http://localhost:8000/api/chunking/run \
  -H 'Content-Type: application/json' \
  -d '{"documentId": "report.pdf", "chunkSize": 50, "strategy": "fixed-size"}' \
  | python3 -m json.tool
```

**Expected**: a `200` JSON body with `extractionFailed: false` and a `result` containing `chunks`,
`totalChunks`, `strategy`, and `chunkSize`, matching `contracts/chunking-api.md`.

```bash
# Invalid chunk size
curl -s -X POST http://localhost:8000/api/chunking/run \
  -H 'Content-Type: application/json' \
  -d '{"documentId": "report.pdf", "chunkSize": 0, "strategy": "fixed-size"}'
# Expected: 400 with a detail message

# Unknown document
curl -s -X POST http://localhost:8000/api/chunking/run \
  -H 'Content-Type: application/json' \
  -d '{"documentId": "does-not-exist.pdf", "chunkSize": 50, "strategy": "fixed-size"}'
# Expected: 404 with a detail message
```

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL.

## 3. Validate: reach the screen via the sidebar (User Story 1)

1. On any screen, select "Experiments" in the left sidebar.
2. **Expected**: sub-options appear, with "Fixed Size Chunking" listed first (FR-001).
3. Select "Fixed Size Chunking". **Expected**: the Fixed Size Chunking screen opens (FR-002).

## 4. Validate: run chunking and see results (User Story 2)

1. Select an already-uploaded document from the picker.
2. Enter a chunk size (e.g., `50`) and trigger chunking.
3. **Expected**: a list of chunks appears, each showing its content and position (FR-007).
4. Change the chunk size to a larger value (e.g., `200`) and re-run.
   **Expected**: visibly fewer, larger chunks (SC-003).
5. Enter `0` or leave the chunk size empty and attempt to trigger chunking.
   **Expected**: a validation message is shown; no request is made (FR-010).
6. (If you have a scanned/image-only PDF available) select it and trigger chunking.
   **Expected**: a clear "text could not be extracted" message, no chunk list (FR-012).

## 5. Validate: the 200-chunk cap (SC-005)

1. Select a large document with a very small chunk size (e.g., `chunkSize: 2` on a long PDF) so the
   run produces more than 200 chunks — or use the `curl` command from step 1 directly to confirm
   `result.totalChunks > result.chunks.length` (`result.chunks.length` should be exactly `200`).
2. In the browser, confirm the screen shows only 200 chunks plus a note that more chunks exist
   beyond what's displayed.

## 6. Validate: the reference design's extra controls are visible but inert (User Story 3)

1. On the Fixed Size Chunking screen, confirm the alternate algorithm options, overlap control, and
   separator options are visible.
2. Interact with them (select a different algorithm option, adjust overlap).
   **Expected**: no change to the chunk size input, the extraction, or any displayed chunk results.
3. Confirm no "Comparison" section is present anywhere on the screen (FR-009).

## 7. Run automated tests

```bash
# Backend: contract + unit tests
cd backend && pytest

# Frontend: unit/component tests
cd frontend && npm test

# Frontend: end-to-end (includes the upload → navigate → run → see-chunks scenario)
cd frontend && npm run test:e2e
```
