# Quickstart: Delete Source Documents

Validates the feature end-to-end: deleting a document (single or bulk) removes it permanently from
the corpus. See `contracts/delete-sources-api.md` for exact request/response shapes and
`data-model.md` for field definitions.

## Prerequisites

- Python 3.12 and the backend's dependencies installed (`cd backend && uv sync`) — no new
  dependencies added by this feature.
- Node.js 20 LTS and frontend dependencies installed (`cd frontend && npm install`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Sanity-check the new endpoint directly:

```bash
curl -s -X POST http://localhost:8000/api/sources/delete \
  -H 'Content-Type: application/json' \
  -d '{"ids": ["does-not-exist.pdf"]}' | python3 -m json.tool
```

**Expected**: `200` with `{"results": [{"id": "does-not-exist.pdf", "status": "deleted", "reason": null}]}` —
an already-absent id is reported as success (FR-006), not a `404`.

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL and navigate to the Data Sources screen.

## 3. Validate: delete a single document (User Story 1)

1. Upload a PDF; confirm it appears in the Document List.
2. Trigger the row's delete action; confirm the confirmation prompt names the document.
3. Confirm the action. **Expected**: the row disappears from the list, and `ls backend/pdfs/` (or
   wherever `PDFS_DIR` points) no longer shows the file.
4. Reload the page. **Expected**: the deleted document does not reappear (FR-004, SC-002).
5. Repeat steps 1–2 but cancel the confirmation prompt. **Expected**: the document remains in the
   list and on disk (Acceptance Scenario 2).

## 4. Validate: bulk delete (User Story 2)

1. Upload 3 PDFs.
2. Select 2 of them via their row checkboxes; trigger "Delete Selected".
3. Confirm once. **Expected**: both selected documents disappear from the list and from disk; the
   third, unselected document remains untouched (FR-010, SC-003).

## 5. Validate: partial failure is reported per-document (Acceptance Scenario 2, US2)

1. Upload a PDF, note its filename.
2. Manually delete the underlying file from `backend/pdfs/` directly (simulating external removal)
   while it's still selected for a bulk delete alongside another, still-present document.
3. Trigger bulk delete on both. **Expected**: the externally-removed one is silently treated as
   already deleted (FR-006); if you instead simulate a genuine failure (e.g., `chmod` the pdfs
   directory read-only before triggering delete on a document that does still exist on disk), that
   one shows a specific error message and remains in the list, while any other selected document
   still deletes successfully (FR-009).

## 6. Run automated tests

```bash
# Backend: contract + unit tests (delete success, already-absent, OS error, path-traversal id)
cd backend && pytest

# Frontend: unit/component tests (confirm flow, partial-failure handling)
cd frontend && npm test

# Frontend: end-to-end (includes the upload → delete → reload-confirms-gone scenario)
cd frontend && npm run test:e2e
```
