# Quickstart: Validate Playground Similarity Search

## Prerequisites

- Backend running against a Postgres instance with the `vector` extension bootstrapped.
- Frontend dev server running.
- A corpus containing a document with saved chunks and at least one saved embedding batch (use
  Chunking → Save Chunks, then Embeddings → Generate Embeddings → Save).

## Scenario 1 — See search context before typing anything (US2 / FR-002, SC-005)

1. From the Embeddings or Vector View screen, click "Move to Playground" (or navigate directly).
2. **Expected**: without touching anything, the screen shows the selected document's name, its
   chunking strategy, and the embedding model used for its saved embeddings, all above the query
   field.
3. If the document has no saved embeddings yet, confirm the screen clearly states search isn't
   available yet (FR-010) rather than showing a blank/broken-looking area.

## Scenario 2 — Ask a question and see ranked results (US1 / FR-003–FR-008, SC-001–SC-004)

1. Type a natural-language question related to the document's content into the query field.
2. Click the send button.
3. **Expected**: a loading indicator appears briefly (FR-012), then up to 5 results appear,
   ordered from most to least similar, each showing its content and a similarity
   ranking/score (FR-007).
4. If the document has fewer than 5 saved chunks, confirm the result count exactly matches the
   number of saved chunks (SC-004) — no padding, no error.
5. If any chunk has more than one saved embedding (e.g., embeddings were generated and saved
   twice for the same document), confirm that chunk appears only once in the results (FR-008).

## Scenario 3 — See the generated query embedding (US3 / FR-004)

1. After Scenario 2's search completes, confirm the query's generated embedding values are
   displayed in the UI.
2. Submit a second, different query.
3. **Expected**: the displayed embedding updates to the new query's values, replacing the old one.

## Scenario 4 — Empty query and query-too-long handling (Edge Cases / FR-009, FR-014)

1. With the query field empty (or whitespace-only), click send.
2. **Expected**: no search is performed, no results/loading/error state appears.
3. Enter a very long query (exceeding the embedding model's max input length — e.g. several
   thousand words for BERT's 512-token limit).
4. **Expected**: the send action is rejected with a clear "query too long" message, distinct from
   the generic search-failure message, and no search is performed.

## Scenario 5 — Document switch resets search state (US2 / FR-011)

1. After completing Scenario 2 (results visible) and Scenario 3 (embedding visible), switch the
   selected document to a different one that also has saved chunks/embeddings.
2. **Expected**: the displayed document/chunking-strategy/embedding-model context updates to the
   new document, and the previous query text, query embedding, and results are all cleared —
   nothing from the old document lingers on screen.

## Automated coverage

- `backend/tests/contract/test_playground_search.py` — validates `GET /api/playground/context`
  and `POST /api/playground/search` against contracts/playground-api.md, including all documented
  error statuses (404, 400 ×2, 422 ×2).
- `backend/tests/unit/test_cosine_similarity_strategy.py` — verifies ranking order, the top-5 cap,
  and per-chunk deduplication (best-scoring embedding wins) directly against the retrieval
  strategy.
- `backend/tests/unit/test_bert_fits.py` — verifies `fits()` accepts a short query and rejects one
  exceeding 512 tokens.
- `frontend/tests/unit/PlaygroundScreen.test.tsx` / `usePlaygroundSearch.test.ts` — cover the
  idle/searching/success/error/query-too-long states and the document-switch reset.
- `frontend/tests/e2e/playground.spec.ts` — end-to-end: save chunks and embeddings, navigate to
  Playground, submit a query, and confirm context, query embedding, and ranked results all render
  without any additional manual interaction beyond typing the query and clicking send.
