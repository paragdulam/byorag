# Quickstart: Generate and Save Chunk Embeddings

Validates the feature end-to-end: viewing saved chunks, generating a non-persisted embeddings
preview with progress, saving it (also with progress), and confirming saves accumulate rather than
replace. See `contracts/embeddings-api.md` for exact request/response shapes and `data-model.md`
for field definitions.

## Prerequisites

- Docker Compose stack running with the updated Postgres image
  (`pgvector/pgvector:pg16` — plan.md), or a local Postgres with the `vector` extension installed,
  since this feature depends on `CREATE EXTENSION vector` succeeding at backend startup.
- Backend dependencies installed including the new `transformers`/`torch`/`pgvector` packages
  (`cd backend && uv sync`) — first run will download `bert-base-uncased`'s weights (one-time,
  cached locally afterward; expect the first `/generate/stream` or `/save/stream` call to be
  noticeably slower than subsequent ones).
- At least one document with **saved chunks** already (via the Chunking screen's "Save Chunks"
  button — `012-save-chunks-button`). Embeddings cannot be generated for a document with no saved
  chunks (spec FR-012).

## 1. Run the backend

```bash
cd backend
PDFS_DIR=./pdfs uvicorn app.main:app --reload --port 8000
```

Confirm the model registry and the new saved-chunks read endpoint (replace `<documentId>` with a
document that already has saved chunks):

```bash
curl -s http://localhost:8000/api/embeddings/models | python3 -m json.tool
# Expected: {"models": [{"id": "bert", "label": "BERT (bert-base-uncased)"}]}

curl -s "http://localhost:8000/api/chunking/saved-chunks?documentId=<documentId>" | python3 -m json.tool
# Expected: {"chunks": [...]} matching whatever was last saved via the Chunking screen.
```

## 2. Validate: generate does not persist (US2, FR-004, FR-005, SC-002)

```bash
curl -N -s "http://localhost:8000/api/embeddings/generate/stream?documentId=<documentId>&model=bert"
# Expected: one or more `progress` events with increasing `percent`, then a terminal `result`
# event whose `vectors` array has one 768-value entry per saved chunk.

psql "$DATABASE_URL" -c "select count(*) from embeddings where chunk_id in (select id from chunks where document_id = '<documentId>');"
# Expected: 0 — generating never writes to the database.
```

## 3. Validate: save persists and accumulates (US3, FR-006, FR-009, SC-003, SC-004)

```bash
curl -N -s "http://localhost:8000/api/embeddings/save/stream?documentId=<documentId>&model=bert"
# Expected: progress events, then a terminal `result` event with `savedCount` equal to the
# document's saved-chunk count.

psql "$DATABASE_URL" -c "select model, count(*) from embeddings where chunk_id in (select id from chunks where document_id = '<documentId>') group by model;"
# Expected: one row, model='bert', count = savedCount from above.

# Save again with the SAME model — must accumulate, not replace.
curl -N -s "http://localhost:8000/api/embeddings/save/stream?documentId=<documentId>&model=bert" > /dev/null

psql "$DATABASE_URL" -c "select model, count(*) from embeddings where chunk_id in (select id from chunks where document_id = '<documentId>') group by model;"
# Expected: count is now DOUBLE the first save's savedCount — nothing was overwritten.
```

## 4. Run the frontend against it

```bash
cd frontend
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

Open the printed local URL and navigate to Embeddings.

## 5. Validate: view saved chunks + model picker (US1)

1. Select a document with saved chunks from the document dropdown. **Expected**: its saved chunks
   are listed with content and position; the model dropdown shows "BERT" pre-selected.
2. Select a document with no saved chunks (if one exists in the active corpus). **Expected**: a
   clear "no saved chunks" message, no broken/empty chunk list, "Generate Embeddings" unavailable.

## 6. Validate: generate with progress, preview only (US2)

1. With saved chunks displayed, click "Generate Embeddings". **Expected**: a progress indicator
   updates as chunks are embedded, then a completed preview appears; nothing indicates it's saved.
2. Change the model or document and generate again. **Expected**: the previous unsaved preview is
   replaced, not accumulated on screen.

## 7. Validate: save with progress, accumulates (US3)

1. With a generated preview displayed, click "Save". **Expected**: its own progress indicator
   appears (independent of anything on the Chunking screen), then a success confirmation.
2. Generate and save again for the same document/model. **Expected**: no error, and (per §3 above)
   the database now holds both saved batches for that chunk/model — confirm via the same `psql`
   check, or a future "view saved embeddings" affordance if one exists by then.
3. Attempt to save before any successful generate this session. **Expected**: "Save" is disabled.

## 8. Run automated tests

```bash
# Backend: contract + unit + integration tests
cd backend && pytest

# Frontend: unit/component tests
cd frontend && npm test

# Frontend: end-to-end
cd frontend && npm run test:e2e
```
