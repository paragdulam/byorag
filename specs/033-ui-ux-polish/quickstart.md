# Quickstart: Validating UI/UX Polish Across Corpora, Sources, Chunking, Embeddings, Vector View, and Playground

Prerequisites: app running locally per the repo's standard dev setup, a signed-in test account
with a personal Anthropic key on file (Playground/Golden Dataset gating), at least one corpus
with one uploaded, chunked, and embedded document.

## Scenario 1 — Delete a document from the Corpora screen (US1, FR-002–FR-006)

1. On the Corpora screen, open a corpus with at least one document.
2. Confirm each document's name is a clickable link and there is a delete icon immediately after
   it — and that there is no "remove from corpus" button or "attach an existing document"
   control anywhere in the panel.
3. Click a document's name. **Expected**: lands on the Sources screen with that exact document's
   preview open.
4. Back on Corpora, click a document's delete icon. **Expected**: a confirmation modal appears
   (not a native browser popup), clearly stating the document will be permanently deleted.
5. Cancel the modal. **Expected**: the document is still listed, nothing changed.
6. Click delete again and confirm. **Expected**: the document disappears from the list without a
   page reload, and no longer appears on the Sources screen, Fixed Size Chunking, Vector View, or
   any Golden Dataset entry/Playground turn that referenced it.
7. Try uploading the exact same file into a *different* corpus. **Expected**: it uploads
   successfully as its own document (no longer deduped/blocked against the other corpus's copy).

## Scenario 2 — Sources screen layout (US2, FR-007–FR-010)

1. Open the Sources screen for a corpus with documents.
2. **Expected**: "Data Sources" and an "Upload" button share the top row (button on the right);
   the left pane is entirely the document list — no upload card/dropzone box above it.
3. Click "Upload", select a PDF. **Expected**: uploads exactly as before (same size/type
   validation and rejection messaging).

## Scenario 3 — Chunk copy link (US3, FR-011–FR-012)

1. On Fixed Size Chunking, with a document's chunks showing, click "Copy Link" on a specific
   chunk's row (top-right of that row).
2. Open the copied link in a new tab. **Expected**: lands directly on that document, with that
   chunk selected — same as `034-more-deep-links`' chunk deep link.

## Scenario 4 — Typography parity (US2–US6, FR-013)

1. Open Corpora, then each of Sources, Fixed Size Chunking, Embeddings, Vector View, and
   Playground in turn. **Expected**: headings, section titles, and body/list text visually match
   Corpora's scale on every screen — nothing looks larger.

## Scenario 5 — Playground Actions popover and citations (US6, FR-014–FR-024)

1. Ask a question in the Playground and wait for the answer.
2. **Expected**: the turn shows a single icon-based "Actions" control (no standalone "Copy Link"
   button); the query embedding and a "Retrieved Chunks" list are **not** shown by default; the
   answer and its supporting evidence read as one connected block, not two separate stacked
   sections.
3. Click "Actions". **Expected**: a popover opens with "Copy Link" and "Query Embedding" options.
4. Click outside the popover. **Expected**: it closes without any other effect.
5. Reopen Actions, choose "Copy Link". **Expected**: a shareable turn link is copied (same link
   `034-more-deep-links`' turn deep link would produce).
6. Reopen Actions, choose "Query Embedding". **Expected**: the query embedding values and a
   Retrieved Chunks list both appear, each retrieved chunk showing its cosine similarity score.
7. In the answer text, find a segment with an info icon. Click it. **Expected**: a modal opens
   showing that chunk's content and cosine similarity score.
8. Click "Go To Chunk" in the modal. **Expected**: navigates to that exact chunk on the Fixed
   Size Chunking screen.
9. Repeat step 7, then use the modal's close control instead. **Expected**: modal closes, turn
   unchanged, no navigation.

## Automated coverage (see tasks.md for the concrete task breakdown)

- Backend: migration idempotency (rerun-safe), one-to-many enforcement, cascade-delete-on-document
  (chunks/embeddings/turns/golden-dataset entries), removed-endpoint 404s.
- Frontend unit: `ConfirmModal`, `useClickOutside`, `AnswerCitations` marker parsing (valid,
  out-of-range, no-marker cases), typography audit assertions per screen.
- Frontend integration: Corpora delete-with-confirmation flow, document-name-links-to-Sources,
  chunk copy-link, Actions popover open/dismiss/option flows, citation-icon-to-modal flow.
- E2E: Scenario 1 and Scenario 5 end-to-end through the real UI.
