# Quickstart: Chunk Preview Structure & UI Fixes

Validation scenarios proving each user story works end-to-end. Run against a local dev stack.

## Prerequisites

- Stack running (`docker-compose up` or local `uv run uvicorn` + `npm run dev`, per repo README).
- A corpus with at least one document whose name is long enough to test wrapping (30+ characters).
- A document chunked (Fixed Size, with `overlap > 0` to exercise overlap coloring) and saved, ideally
  with recognizable structure in the source PDF (a short title-like line, a bullet list) so the
  heading/list heuristic has something to detect.

## US1 — Readable Sources document list

1. Open the Sources screen with a document whose name is long (e.g. 60+ characters, no spaces
   partway through).
   **Expect**: the name wraps onto multiple lines within its column; the row grows taller to fit
   it; no text is clipped or overflows the table (FR-001–FR-002, SC-001).
2. With both a short-named and long-named document in the same list.
   **Expect**: each row's height is independent — the short-named row stays compact, the
   long-named row is taller, and neither row's content overlaps the other (FR-002 acceptance
   scenario 3).

## US2 — Chunked Preview as a continuous, structured, background-highlighted document

1. Select the chunked-with-overlap document, open PDF preview, then click "Chunked Preview".
   **Expect**: the document renders as one continuous flow — no card borders, gaps, or per-chunk
   containers separate one chunk's text from the next (FR-004/FR-005).
2. Scroll through the rendered text.
   **Expect**: background color changes exactly at each chunk boundary, including mid-paragraph or
   mid-word where a boundary falls there (FR-008); adjacent chunk colors are visibly different
   (FR-006).
3. Locate a region produced by the configured chunk overlap.
   **Expect**: that shared span renders in the single reserved "overlap" color/pattern, distinct
   from either contributing chunk's own color (FR-009).
4. Inspect a short standalone line or a bullet-style line from the source PDF, if present.
   **Expect**: it renders as a heading or list item respectively, per the lightweight heuristic
   (FR-007); ordinary paragraph text elsewhere renders as plain paragraphs.
5. Open Chunked Preview for a document with zero saved chunks.
   **Expect**: the existing "no chunks yet" message (unchanged, FR-010).
6. Click "Back to PDF" from Chunked Preview.
   **Expect**: returns to the PDF view exactly as today (FR-010).

## US3 — Consistent "Entire Corpus" experience

1. On Fixed Size Chunking, select "Entire Corpus" for a corpus where every document is already
   chunked.
   **Expect**: the single-line "already chunked" indicator, followed immediately by a per-document
   list showing each document's chunk count (today's existing pattern).
2. On Embeddings, select "Entire Corpus" for a corpus where every document already has saved
   embeddings for the selected model.
   **Expect**: the *same* pattern as step 1 — the single-line indicator (just "embeddings" instead
   of "chunks" in the wording) followed by a per-document list, one row per document showing
   "N of M embeddings saved" (FR-011).
3. Trigger a fresh "Entire Corpus" run on each screen (Re-Calculate Chunks / Generate Embeddings).
   **Expect**: both screens show the identical combined-progress-bar + "Processing document X of
   N" presentation while running (FR-012).
4. Let both batches complete, including at least one per-document failure (e.g. a document with no
   extractable text/no saved chunks to embed).
   **Expect**: both screens show one unified per-document summary list, styled identically,
   including identical error-row styling for the failed document (FR-013/FR-014).

## Contract-level checks

- `GET /api/chunking/structured-preview?documentId=` returns `200` with `fullText` + ordered,
  contiguous, non-overlapping `segments` for a chunked document; `404` for an unknown document,
  a document with zero saved chunks, or a document whose file is missing on disk
  (contracts/chunking-structured-preview-api.md).
- `segments` for a document chunked with `overlap > 0` include at least one `"overlap"`-kind
  segment; for `overlap = 0`, no `"overlap"` segments appear at all.
