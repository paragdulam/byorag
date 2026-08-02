# Quickstart: Golden Dataset Creation (Manual & LLM-Generated)

Validation scenarios proving each user story works end-to-end. Run against a local dev stack.

## Prerequisites

- Stack running (`docker-compose up` or local backend + `npm run dev`, per repo README).
- A corpus with at least one uploaded, chunked, embedded document (embeddings generated with the
  `bert` model — this feature's candidate search depends on embeddings already existing).
- A personal Anthropic key on file (Profile screen) — required only for the draft-answer button
  and LLM-generation flows (US2/US3); not required for a fully manual entry with a hand-typed
  answer.

## US1 — Manually build a golden dataset entry

1. Open Golden Dataset for the prepared corpus, click **+ New Entry → Write Manually**.
   **Expect**: an empty editor — question field, answer field, an empty evidence-chunk area.
2. Type a question about content you know is in the document.
   **Expect**: candidate chunks appear, each labeled (matched question / matched answer / matched
   both — none should say "matched answer" yet since there's no answer text) (FR-003, FR-004).
3. Type a preferred answer in your own words.
   **Expect**: the candidate list refreshes; some candidates now show "matched both" and are
   pre-checked (FR-005).
4. Uncheck a pre-checked candidate, manually search for and add a different chunk not in the
   original candidate list.
   **Expect**: both actions work — nothing restricts you to the auto-suggested candidates (FR-006).
5. Click **Draft from selected chunks →**.
   **Expect**: the answer field fills with LLM-drafted text grounded in exactly the checked chunks
   (FR-007); edit it freely.
6. Uncheck every evidence chunk, then try to save.
   **Expect**: save is blocked with a message that at least one evidence chunk is required
   (FR-002, SC-005).
7. Re-check at least one chunk, save.
   **Expect**: the entry appears immediately in the entry list with status "Approved" — no review
   step (FR-008).

## US2 — Generate and review a single entry with an LLM

1. Click **+ New Entry → Generate with LLM**, pick the same document, submit.
   **Expect**: a new entry appears in a "Pending Review" list within a few seconds — question,
   evidence chunks, and a draft answer all populated, drawn from real chunk content (FR-009).
2. Open the pending entry.
   **Expect**: the exact same editor from US1 — question/answer/chunk-selection all editable
   (FR-012).
3. Edit the answer slightly, then click **Approve**.
   **Expect**: the entry's status becomes "Approved," now indistinguishable from a manual entry
   except its "LLM-generated" source badge (FR-014).
4. Generate a second entry, open it, click **Reject** without editing.
   **Expect**: status becomes "Rejected"; the entry is excluded from any "usable golden dataset"
   count/filter defaulting to approved-only (FR-013).
5. Open the rejected entry again.
   **Expect**: it's still editable, with a way to move it back to "Pending Review" or straight to
   "Approved" (FR-013a, Clarifications 2026-08-01) — rejection isn't a dead end.

## US3 — Generate a batch of entries at once

1. Click **+ New Entry → Generate a Batch…**, request several entries from the corpus, submit.
   **Expect**: visible per-item progress while it runs (FR-010).
2. Wait for completion.
   **Expect**: every generated entry appears individually in the Pending Review list, each
   independently approvable/rejectable (US3 acceptance scenario 2).
3. Start another batch, then navigate to a different screen and back before it finishes.
   **Expect**: progress (or the completed results) is still visible on return (US3 acceptance
   scenario 3).
4. Run a batch against a document/corpus scope you know is too sparse to fully support the
   requested count (or simulate a generation failure).
   **Expect**: whichever entries succeeded still appear in Pending Review; the UI reports how many
   succeeded vs. failed rather than discarding everything (FR-010b).

## Cross-cutting checks

- Re-chunk a document that has approved golden entries pointing at it (different `chunkSize`).
  **Expect**: those entries' evidence text is unchanged and still readable (FR-016, SC-006) — the
  chunk content shown is exactly what was originally selected, even though it may no longer
  correspond to any single chunk boundary in the newly re-chunked document.
- Delete a document that has golden entries.
  **Expect**: those entries are gone from the list (FR-019) — not orphaned, not shown as broken
  rows.
- Filter the entry list by status and by source independently.
  **Expect**: both filters work and can be combined (FR-015).
- Without any Anthropic key on file, open Golden Dataset from the sidebar.
  **Expect**: the nav entry is gated the same way Playground/Metrics already are (research.md §9).
