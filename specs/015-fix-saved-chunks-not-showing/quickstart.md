# Quickstart: Validate the Saved-Chunks-Not-Showing Fix

## Prerequisites

- Backend running (`uvicorn app.main:app --reload --port 8000`) against a Postgres instance with
  the `vector` extension bootstrapped.
- Frontend dev server running (`npm run dev` in `frontend/`).
- A corpus containing exactly one document with saved chunks (reproduces the reported bug most
  directly, since there's no alternate document to manually select).

## Scenario 1 — Embeddings screen auto-loads saved chunks (US1 / FR-001, FR-002, SC-001)

1. Open the app, select (or create) a corpus with exactly one document that already has saved
   chunks (use the Chunking screen's "Save Chunks" if none exist yet).
2. Navigate directly to the **Embeddings** screen — do not touch the document dropdown.
3. **Expected**: the document appears selected in the dropdown, and its saved chunks are listed
   immediately, with no click required.
4. **Regression check (FR-005)**: with a second document added to the corpus (also with saved
   chunks), manually switch the dropdown to it — its saved chunks must load correctly.

## Scenario 2 — Vector View auto-loads saved chunks and the selected chunk's embedding (US2 / FR-003, FR-004, SC-002)

1. From the Embeddings screen, generate and save at least one embedding for the single document,
   then click "Move to Vector View" (or navigate there directly).
2. Without clicking anything, confirm:
   - The document is shown selected and its saved chunks are listed immediately.
   - The first chunk is shown selected and its saved embedding renders as a vector grid
     immediately (no click on the chunk required).
3. **Regression check (FR-005)**: manually select a different chunk (if more than one exists) —
   its saved embedding(s) must load correctly.

## Scenario 3 — Corpus switch re-triggers auto-load (Edge case / FR-006)

1. While on the Embeddings (or Vector View) screen, switch the active corpus (via the corpus
   switcher) to a different corpus that also has a document with saved chunks.
2. **Expected**: the newly-active corpus's document is shown selected and its saved chunks load
   immediately, without requiring a manual dropdown interaction — same as a fresh page load.

## Zero-saved-chunks case (Edge case)

1. Select (or create) a document with no saved chunks.
2. **Expected**: the screen clearly shows "No saved chunks for this document yet..." rather than
   an empty-looking or broken area.

## Automated coverage

- `frontend/tests/e2e/embeddings.spec.ts`: extend the existing save → generate → save →
  Vector View flow to assert saved chunks/embeddings are visible immediately after navigation,
  before any dropdown interaction (covers Scenarios 1 and 2 end-to-end).
- New component tests for `EmbeddingsScreen.tsx` and `VectorViewScreen.tsx`: single-item list
  auto-selects and triggers the hook's fetch without simulating an `onChange` event; manual
  `onChange` selection still updates correctly; switching the `documents`/`savedChunks` input
  (simulating a corpus switch) re-triggers auto-selection.
