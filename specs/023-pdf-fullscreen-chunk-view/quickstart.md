# Quickstart: PDF Fullscreen Reading & In-Context Chunk Preview

Validation scenarios proving each user story works end-to-end. Run against a local dev stack.

## Prerequisites

- Stack running (`docker-compose up` or local `uv run uvicorn` + `npm run dev`, per repo README).
- A corpus with at least one processed, multi-page document.
- That document chunked (Fixed Size, `chunk_size` small enough relative to the document that at
  least one chunk boundary falls mid-page, and ideally one chunk spans two pages) and saved.

## US1 — Read a source PDF comfortably in Sources

1. Open Sources, select the multi-page document.
   **Expect**: PDF preview shows at ~50% width on the right, document list at ~50% on the left; no
   "Chunked Preview" button is present anywhere on the screen (FR-001).
2. Click the fullscreen control.
   **Expect**: the PDF preview expands to 100% of the content area (document list no longer
   visible); the preview remains scrollable through every page (FR-002, FR-005).
3. Click the restore control.
   **Expect**: layout returns to the normal ~50%/50% split (FR-003).
4. Enter fullscreen again, then select a different document from the list.
   **Expect**: the newly selected document's PDF shows, and the layout is back to the normal split
   — not still fullscreen (FR-004, Clarification 3).
5. Enter fullscreen again, navigate to another screen (e.g., Embeddings), then navigate back to
   Sources.
   **Expect**: the layout is the normal split, not fullscreen (FR-004).

## US2 — See each chunk in its original page context during Fixed Size Chunking

1. Open Fixed Size Chunking for the prepared document.
   **Expect**: chunk list on the left, in-context preview pane on the right; the first chunk is
   selected by default and its page context is already showing (FR-006, FR-007).
2. Select a chunk in the middle of the list.
   **Expect**: the right-hand preview updates to that chunk's page context; if the previous
   selection's page(s) differ, they're replaced, not appended (FR-007 acceptance scenario 2).
3. Select a chunk known to span two PDF pages (or whose neighbor lands on the next page).
   **Expect**: both pages render, stacked in page order, each with its own page-number label; no
   scrolling through unrelated document content is required to see them (FR-008, FR-009,
   Clarification 2).
4. Inspect the rendered page(s).
   **Expect**: headers, footers, and paragraph/list structure are preserved (not one run-on block
   of text) — same rendering quality as 022's whole-document Chunked Preview (FR-010).
5. Inspect the background coloring.
   **Expect**: the selected chunk, its one preceding/following neighbor (when they exist), and any
   overlapping span between them are each colored per the existing chunk/overlap scheme; a chunk
   that appears on two stacked pages keeps the *same* color on both (FR-011, research.md §6).
6. Select the very first chunk, then the very last chunk.
   **Expect**: only the neighbor(s) that actually exist show — no error, no empty placeholder for
   the missing side (FR-012).
7. Re-run Fixed Size Chunking with different settings but do not click Save Chunks.
   **Expect**: the left-hand chunk list shows the new, unsaved preview as it always has; the
   right-hand in-context preview shows the "save to see this configuration in context" state
   rather than mismatched page content (research.md §8). Click Save Chunks — the in-context
   preview then reflects the newly saved configuration.
8. Open Fixed Size Chunking for a document with zero saved chunks.
   **Expect**: the in-context preview area shows the existing "no chunks yet" state (FR-013).

## Contract-level checks

- `GET /api/chunking/structured-preview?documentId=` response includes `pages` (fully partitioning
  `fullText`, 1-indexed, ordered) and `chunkRanges` (one per saved chunk with non-empty content,
  ordered by `chunkIndex`) alongside the existing `fullText`/`segments`
  (contracts/chunking-structured-preview-page-mapping.md).
- Existing 404 cases (unknown document, zero saved chunks, missing file) are unchanged.
