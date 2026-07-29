# Quickstart: Sources, Chunking & Embeddings UX Refresh

Validation scenarios proving each user story works end-to-end. Run against a local dev stack.

## Prerequisites

- Stack running via `docker-compose up` (backend, frontend, postgres — per repo `docker-compose.yml`).
- Backend dependencies updated to include `scikit-learn` and `umap-learn` (research.md §6), image rebuilt.
- At least one corpus with 2+ PDF documents uploaded via the Sources screen.
- One document chunked (Fixed Size) and saved, so saved chunks exist to validate against.
- One document with saved embeddings (any model) generated via the Embeddings screen.

## US1 — Fixed Size Chunking auto-load

1. On the Fixed Size Chunking screen, select the already-chunked document.
   **Expect**: saved chunks render immediately, no click required; screen indicates chunking is
   already done (spec FR-001, FR-002).
2. Select "Entire Corpus" for a corpus where every document already has saved chunks.
   **Expect**: all documents' chunks render without clicking "Re-Calculate Chunks" (FR-003).
3. Click "Re-Calculate Chunks" on the auto-loaded document.
   **Expect**: chunks are recomputed and replace the auto-loaded set (FR-004).
4. Select a document with no saved chunks.
   **Expect**: empty/not-yet-chunked state, unchanged from today.

## US2 — Sources split view with PDF preview

1. Open the Sources screen.
   **Expect**: left column = upload control + document list; right column = empty placeholder
   (FR-005, FR-007).
2. Select a PDF document from the list.
   **Expect**: right column renders that PDF's pages within ~2 seconds for a typical document size
   (FR-006, FR-008, SC-003).
3. Select a different document.
   **Expect**: right column updates to the newly selected document's PDF.
4. Upload a new document while another is previewed.
   **Expect**: new document appears in the list; current preview is undisturbed (FR-005 acceptance
   scenario 5).
5. Select a document whose stored file is missing/unreadable (simulate by moving/deleting the file
   on disk under `PDFS_DIR` without deleting the DB row).
   **Expect**: "preview unavailable" message, not a blank/broken pane (Edge Cases).

## US3 — Chunked Preview with per-chunk colors

1. With a chunked document selected and previewed, click "Chunked Preview" (bottom-right of the
   preview pane).
   **Expect**: document renders as markdown text, one colored block per saved chunk, in order
   (FR-009, FR-010).
2. Visually inspect consecutive chunk blocks.
   **Expect**: no two adjacent blocks share the same background color; text stays legible in every
   block (FR-011, Clarifications session 2026-07-28).
3. Click "Chunked Preview" for a document with zero saved chunks.
   **Expect**: message explaining no chunks exist yet, with guidance to run chunking (FR-012).
4. From the Chunked Preview, switch back to PDF view.
   **Expect**: standard PDF preview returns for the same document (FR-013).

## US4 — UMAP / PCA embedding projection

1. Open the embedding projection view for a document with 5+ embedded chunks; select "UMAP".
   **Expect**: a 2D scatter renders, one point per chunk, each point traceable to its chunk
   (FR-014, acceptance scenario 1).
2. Switch the method to "PCA".
   **Expect**: plot updates to the PCA projection (acceptance scenario 2).
3. Switch scope to "Entire Corpus" for a corpus where every document has embeddings.
   **Expect**: plot shows points for every chunk across all documents, visually grouped/colored by
   source document (FR-015, FR-016).
4. Switch scope to "Entire Corpus" for a corpus where only some documents have embeddings.
   **Expect**: plot shows only embedded chunks; excluded documents are listed with the reason
   (FR-017).
5. Select a document/corpus scope with fewer than 5 embedded chunks total.
   **Expect**: the UMAP/PCA method selector is disabled with a message stating the 5-chunk minimum
   — no failed request, no empty/broken plot (FR-018).

## Contract-level checks

- `GET /api/sources/{document_id}/file` returns `200` + PDF bytes for a valid id; `404` for an
  unknown id or a missing on-disk file (contracts/sources-file-api.md).
- `GET /api/embeddings/projection-methods` reports `umap`/`pca` as `available: true`
  (contracts/embeddings-projection-api.md).
- `POST /api/embeddings/project` with `< 5` entries returns `422`; with mixed vector dimensions
  returns `422`; with a valid 5+ same-dimension payload returns one point per input entry, in order
  (contracts/embeddings-projection-api.md).
