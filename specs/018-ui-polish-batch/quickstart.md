# Quickstart: RAG Workflow Screens — UI Polish Batch

Validates all eight user stories end-to-end. Assumes the app is already runnable per the
project's existing setup (PostgreSQL reachable, backend + frontend started, Docker Compose or
local dev servers — unchanged by this feature).

## Prerequisites

- Backend and frontend running (`docker-compose up`, or `cd backend && uvicorn app.main:app
  --reload` + `cd frontend && npm run dev`, per `README.md`).
- A corpus with at least 3 uploaded PDF documents, one of which has a very long, hyphen/underscore
  -only file name with no spaces (e.g. rename or upload one of the long-named PDFs already in
  `backend/pdfs/` — several exist).

## 1. Validate: chunk an entire corpus in one action (User Story 1)

1. Open Chunking. Confirm the document selector lists "Entire Corpus" above the individual
   documents.
2. Select "Entire Corpus", set a chunk size/overlap, and run chunking.
3. Confirm one combined progress bar appears with text like "Processing document 2 of 3
   (name.pdf)…", advancing through every document without further clicks.
4. Confirm a per-document summary (name + chunk count) appears once the run completes.
5. Click "Save Chunks". Confirm every document in the corpus now has saved chunks (spot-check via
   Vector View or the saved-chunks endpoint).
6. Rename one document's underlying PDF file so extraction fails (or use a corrupted PDF) and
   re-run "Entire Corpus" — confirm that document is reported as failed while the others still
   complete and save successfully.

## 2. Validate: generate embeddings for an entire corpus in one action (User Story 2)

1. With saved chunks in place for at least two documents (one deliberately left without saved
   chunks), open Embeddings and select "Entire Corpus" plus a model.
2. Click "Generate Embeddings". Confirm the same combined-progress format as chunking, and confirm
   the document with no saved chunks is skipped and reported rather than failing the whole run.
3. Click "Save". Confirm every eligible document now has saved embeddings.

## 3. Validate: no horizontal scrolling on Sources (User Story 3)

1. Open Data Sources for the corpus containing the long, unbroken-token-named document.
2. Confirm its name wraps across multiple lines in the Document Name column and the document
   table never produces a horizontal scrollbar, at any reasonable browser width.

## 4. Validate: Save Chunks shows progress (User Story 4)

1. Open Chunking for a single document, run chunking, then click "Save Chunks".
2. Confirm a progress bar and percentage appear while saving (same visual pattern as Embeddings'
   "Save"), the button is disabled meanwhile, and it's replaced by "Saved" on completion.

## 5. Validate: corpus row clicks never switch the active corpus (User Story 5)

1. Open Corpora with at least two corpora, neither of which is active.
2. Click anywhere on a non-active corpus row except its "Make Active" button (e.g., its document
   preview area). Confirm the active corpus does not change.
3. Click that row's "Make Active" button. Confirm it becomes active.

## 6. Validate: Playground answers render as Markdown (User Story 6)

1. Ask a question in Playground whose generated answer includes a Markdown list and bold text
   (or use a corpus/document known to produce one).
2. Confirm the answer renders with an actual bulleted/numbered list and bold text — not literal
   `*`/`-`/`**` characters.
3. Confirm a plain, unformatted answer still displays as ordinary readable text.

## 7. Validate: Corpora list previews each corpus's documents (User Story 7)

1. Open Corpora with one corpus containing more than 5 documents and one with 5 or fewer.
2. Confirm the larger corpus's row shows exactly 5 document names plus a "Show more" control;
   clicking it reveals the rest and turns into "Show less".
3. Confirm the smaller corpus's row shows all its documents with no "Show more" control, and that
   a corpus with zero documents shows an empty-state message instead of a list.

## 8. Validate: Vector View can show an entire corpus's chunks (User Story 8)

1. With saved chunks in more than one document (from Steps 1/2 above), open Vector View and
   select "Entire Corpus".
2. Confirm the chunk list shows a header per document followed by that document's chunks, for
   every document with saved chunks (documents with none are simply absent, not shown empty).
3. Select any chunk from any document's group. Confirm its saved embedding(s) display exactly as
   selecting that document individually would show.

## 9. Run the automated test suites

```bash
# Backend
cd backend && DATABASE_URL="postgresql+psycopg://byorag:byorag@localhost:5432/byorag_test" pytest

# Frontend
cd frontend && npm run test        # unit + integration
cd frontend && npm run test:e2e    # e2e (Playwright)
```

All suites are expected to pass with zero skips before this feature is considered done
(Constitution Principle II) — including the rewritten `test_chunking_save.py` contract test
(`contracts/chunking-save-stream-api.md`) and every screen's updated unit/integration/e2e coverage
listed in `plan.md`'s Project Structure.
