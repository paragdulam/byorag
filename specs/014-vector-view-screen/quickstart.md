# Quickstart: Vector View Screen

Validates the feature end-to-end: reaching Vector View from Embeddings, browsing chunks, viewing
a real persisted vector as a grid, picking among multiple saved embeddings for the same chunk, the
projection-method dropdown's placeholder behavior, and moving on to Playground. See
`contracts/vector-view-api.md` for exact request/response shapes and `data-model.md` for field
definitions.

## Prerequisites

- Backend and frontend running (same as `013`'s quickstart) — no new dependency, no schema change.
- At least one document with **saved chunks** (`012`) and **saved embeddings** (`013`) already —
  ideally with one chunk saved twice (or with a re-generate + re-save) so User Story 2's
  multi-embedding picker has something real to exercise.

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Sanity-check the two new read endpoints (replace `<chunkId>` with a chunk id from
`GET /api/chunking/saved-chunks?documentId=<documentId>`):

```bash
curl -s http://localhost:8000/api/embeddings/projection-methods | python3 -m json.tool
# Expected: "vector" first with "available": true; "umap"/"pca" present with "available": false.

curl -s "http://localhost:8000/api/embeddings/saved?chunkId=<chunkId>" | python3 -m json.tool
# Expected: {"embeddings": [...]}, newest first, each with a full 768-value "vector".
# For a chunk saved more than once: multiple entries, distinct "id"/"createdAt" (and possibly
# "model").

curl -s "http://localhost:8000/api/embeddings/saved?chunkId=<a chunk with nothing saved>" \
  | python3 -m json.tool
# Expected: {"embeddings": []} — not an error.

curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8000/api/embeddings/saved?chunkId=00000000-0000-0000-0000-000000000000"
# Expected: 404
```

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL, navigate to Embeddings, generate and save embeddings for a document if
you haven't already (see `013`'s quickstart §5–§7).

## 3. Validate: Move to Vector View gating and navigation (US1)

1. On the Embeddings screen before any save this session, look at the bottom bar. **Expected**:
   "Move to Vector View" is present, next to "Save", and disabled.
2. Save embeddings successfully. **Expected**: "Move to Vector View" becomes enabled.
3. Click it. **Expected**: the Vector View screen opens.

## 4. Validate: browse chunks and inspect a saved vector (US2)

1. On Vector View, look at the left side. **Expected**: the document's saved chunks are listed
   with content and position, same as on the Embeddings screen.
2. Select a chunk with exactly one saved embedding. **Expected**: the right side shows a grid of
   numbers (not one long list), matching the `vector` values from the `curl` check in step 1.
3. Select a chunk with more than one saved embedding. **Expected**: a picker appears letting you
   choose which saved embedding to view; the right side shows only the chosen one; switching the
   picker's selection updates the grid.
4. Select a chunk with zero saved embeddings. **Expected**: a clear message indicates nothing is
   saved for that chunk — no blank or broken area.

## 5. Validate: projection-method dropdown (US3)

1. Look above the vector grid. **Expected**: a dropdown with "Vector" pre-selected.
2. Open it. **Expected**: other entries (e.g. UMAP, PCA) are visible but distinguishable as not
   yet available.
3. Select one of them. **Expected**: a clear "not available yet" indication appears — no crash, no
   silent no-op that looks broken.
4. Select "Vector" again. **Expected**: the raw-grid display from step 4 returns.

## 6. Validate: Move to Playground (US4)

1. On Vector View, look at its own bottom bar. **Expected**: "Move to Playground" is present.
2. Click it. **Expected**: the Playground screen opens.

## 7. Run automated tests

```bash
# Backend: contract + unit tests
cd backend && pytest

# Frontend: unit/component tests
cd frontend && npm test

# Frontend: end-to-end
cd frontend && npm run test:e2e
```
