# Quickstart: Persist Uploaded PDFs to Filesystem

Validates the feature end-to-end: uploading a PDF saves it to disk, and it
reappears after a reload. See `contracts/sources-api.md` for exact request/
response shapes and `data-model.md` for field definitions.

## Prerequisites

- Python 3.12 and the backend's dependencies installed (`cd backend && uv sync`
  or `pip install -e .`, per whatever tool `backend/pyproject.toml` ends up
  using).
- Node.js 20 LTS and frontend dependencies installed (`cd frontend && npm install`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Expected: server starts on `http://localhost:8000`; `./pdfs` is created
automatically on first request if it doesn't exist (FR-002).

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL in a browser and navigate to the Data Sources
screen.

## 3. Validate: upload persists across refresh (User Story 1)

1. Drag a valid PDF onto the upload area (or browse to one).
2. Confirm it appears in the document list within ~2 seconds.
3. Confirm the file now exists on disk: `ls backend/pdfs/` (or wherever
   `PDFS_DIR` points) shows the uploaded file.
4. Reload the browser page.
5. **Expected**: the same document is still listed, with status
   `"processed"` immediately (no processing delay) — FR-007.

## 4. Validate: invalid uploads never reach disk (User Story 2)

1. Upload a non-PDF file. **Expected**: visible rejection message, no new
   file in `backend/pdfs/`, no new list entry.
2. Upload a PDF larger than 50MB. **Expected**: same as above with the
   size-specific message.
3. Upload one valid PDF and one invalid file together. **Expected**: only
   the valid one is saved and listed; the invalid one is reported
   individually.

## 5. Validate: same-name re-upload never overwrites (User Story 3)

1. Upload a PDF named `report.pdf`.
2. Upload a different PDF, also named `report.pdf`.
3. **Expected**: `backend/pdfs/` now contains both `report.pdf` and
   `report (1).pdf`; the document list shows two distinct entries.

## 6. Run automated tests

```bash
# Backend: contract + unit + integration tests
cd backend && pytest

# Frontend: unit/component/integration tests
cd frontend && npm test

# Frontend: end-to-end (includes the reload-persists scenario)
cd frontend && npm run test:e2e
```

## 7. (Optional) Validate Docker persistence

```bash
docker compose up --build
# upload a PDF via the browser at the compose-exposed frontend URL
docker compose restart backend
# reload the page — the document should still be listed, proving the
# named volume (not just the container's writable layer) is what's storing PDFs
```
