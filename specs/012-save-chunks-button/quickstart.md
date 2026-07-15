# Quickstart: Explicit Save Chunks to Database

Validates the feature end-to-end: "Re-Calculate Chunks" is a pure preview with no DB writes, "Save
Chunks" persists exactly what's on screen, and the UI clearly distinguishes saved vs. unsaved
state. See `contracts/chunking-save-api.md` for exact request/response shapes and `data-model.md`
for field definitions.

## Prerequisites

- Docker Compose stack running (frontend, backend, PostgreSQL, Qdrant) per the constitution's fixed
  stack, or the backend/frontend run locally against a local Postgres — no new dependency or schema
  migration is introduced by this feature.
- At least one already-uploaded PDF with extractable text, added to a corpus (Sources screen from
  `002-persist-pdf-sources` / `008-corpora-management`).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Sanity-check that preview no longer persists (replace `<documentId>` with a real uploaded
document's UUID from `GET /api/sources`):

```bash
# Preview: should NOT write to the database.
curl -N -s "http://localhost:8000/api/chunking/run/stream?documentId=<documentId>&chunkSize=50"
# Expected: terminal `result` event with chunks, same as before this feature.

# Inspect the DB directly — expect no rows for this document yet (assuming none saved previously).
docker compose exec postgres psql -U postgres -d byorag -c \
  "select count(*) from chunks where document_id = '<documentId>';"
# Expected: 0 (or whatever count already existed from a prior explicit save — not incremented by
# the preview call above).
```

Sanity-check the new save endpoint:

```bash
curl -s -X POST "http://localhost:8000/api/chunking/save" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "<documentId>", "chunkSize": 50, "overlap": 0}'
# Expected: 200 OK, ChunkRunResponse JSON body (contracts/chunking-save-api.md).

docker compose exec postgres psql -U postgres -d byorag -c \
  "select count(*), strategy, chunk_size, overlap from chunks where document_id = '<documentId>' group by strategy, chunk_size, overlap;"
# Expected: one row-group matching chunkSize=50, overlap=0, count equal to the response's
# min(totalChunks, 200).

# Save again with different params — expect a full replace, not accumulation.
curl -s -X POST "http://localhost:8000/api/chunking/save" \
  -H "Content-Type: application/json" \
  -d '{"documentId": "<documentId>", "chunkSize": 100, "overlap": 10}'

docker compose exec postgres psql -U postgres -d byorag -c \
  "select distinct chunk_size, overlap from chunks where document_id = '<documentId>';"
# Expected: only one row — chunk_size=100, overlap=10. The chunkSize=50 rows are gone.
```

## 2. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL and navigate to Chunking → Fixed Size Chunking.

## 3. Validate: preview does not persist (US1, FR-001, FR-006, SC-001)

1. Select a document, set a chunk size, click "Re-Calculate Chunks". **Expected**: the chunk list
   appears; the screen indicates the result is **unsaved**.
2. Change the chunk size and click "Re-Calculate Chunks" again, multiple times. **Expected**: each
   run replaces the on-screen list; at no point does the screen claim the result is saved.
3. Cross-check with the `psql` query from step 1 above (or the Sources/Chunks admin view, if any):
   no chunk rows exist for this document yet, no matter how many preview runs were done.

## 4. Validate: explicit save persists exactly what's shown (US2, FR-002, FR-003, SC-002)

1. With a preview displayed, click "Save Chunks". **Expected**: a success indication appears, and
   the screen now shows the result as **saved**.
2. Confirm via `psql` (or an equivalent check) that the persisted `strategy`/`chunk_size`/`overlap`
   and chunk count match exactly what was on screen when "Save Chunks" was clicked.
3. Before any preview has run for a document, load the screen fresh. **Expected**: "Save Chunks" is
   disabled (FR-004) since there is nothing to save yet.

## 5. Validate: re-save replaces, doesn't duplicate (US2, FR-005, FR-009, SC-004)

1. Save chunks once. Change chunk size, re-run preview, and save again.
2. Confirm via `psql` that only the second save's chunks exist for the document — no leftover rows
   from the first save, no duplicate `index` values.
3. Rapidly double-click "Save Chunks" (or trigger two saves back-to-back). **Expected**: no error
   from duplicate/corrupted state; the button is disabled while a save is in flight.

## 6. Validate: saved vs. unsaved indicator (US3, FR-008, SC-003)

1. Save chunks for a document. **Expected**: screen shows "saved".
2. Without changing anything, click "Re-Calculate Chunks" again with the *same* chunk size/overlap.
   **Expected**: screen shows "unsaved" immediately after the new preview completes, even though
   the result is identical in content — the state reflects "not yet confirmed saved," not content
   equality.
3. Click "Save Chunks" again. **Expected**: screen returns to "saved".

## 7. Validate: "Move to Embeddings" requires a save (research.md §6, spec Assumptions)

1. Load the screen fresh for a document with no saved chunks. Run a preview only (no save).
   **Expected**: "Move to Embeddings" remains disabled.
2. Click "Save Chunks". **Expected**: "Move to Embeddings" becomes enabled.

## 8. Validate: extraction failure doesn't touch prior saves (Edge Cases)

1. For a document that already has saved chunks, attempt a save on a document/setting combination
   that would fail extraction (if reproducible in your environment) — or simulate via a
   corrupt/empty PDF. **Expected**: `extractionFailed: true`, `result: null`, and prior saved
   chunks for that document are unchanged (`psql` check).

## 9. Run automated tests

```bash
# Backend: contract + unit + integration tests
cd backend && pytest

# Frontend: unit/component tests
cd frontend && npm test

# Frontend: end-to-end
cd frontend && npm run test:e2e
```
