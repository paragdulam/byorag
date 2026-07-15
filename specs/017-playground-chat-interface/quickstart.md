# Quickstart: Validate Playground Split-Screen Chat Interface

## Prerequisites

- Backend running against a Postgres instance with the `vector` extension bootstrapped.
- `ANTHROPIC_API_KEY` set in the backend's environment (see `docker-compose.yml` /
  `backend/app/config.py`); `GENERATION_PROVIDER` and `ANTHROPIC_MODEL` may be left at their
  defaults (`"anthropic"` and the configured default model).
- Frontend dev server running.
- A corpus containing a document with saved chunks and at least one saved embedding batch (use
  Chunking → Save Chunks, then Embeddings → Generate Embeddings → Save).

## Scenario 1 — Ask a question, review retrieval, then generate an answer (US1/US2, FR-001–FR-008)

1. Open the Playground for a document with saved embeddings.
2. **Expected**: the screen is split into a left panel (question field + send button at the
   bottom) and a right panel (initially empty until a question is sent).
3. Type a question and click Send.
4. **Expected**: the right panel populates, top to bottom, with a Generate control, a list of
   retrieved chunks identified by chunk ID only (each with its own "Show more"), and a query
   embedding preview limited to 2 rows with its own "Show more" (FR-004–FR-006).
5. Click a chunk's "Show more" and confirm its full content is revealed; click the embedding's
   "Show more" and confirm the remaining values appear.
6. Click Generate.
7. **Expected**: a loading indicator appears, then the complete answer is revealed as a single
   block (not streamed) directly below the question in the left panel, above the input field
   (FR-007, FR-008, FR-012).

## Scenario 2 — Multi-turn conversation and persistence across a reload (US3, FR-009, FR-016, FR-017)

1. Continuing from Scenario 1, ask a second, different question and click Send, then Generate.
2. **Expected**: the left panel now shows both question/answer exchanges in order, the first one
   unchanged; the right panel reflects only the second question's chunks/embedding.
3. Reload the browser page (or navigate away and back to the Playground for the same document).
4. **Expected**: the left panel automatically shows both prior questions and answers, in order,
   before any new question is submitted — nothing needs to be re-typed.

## Scenario 3 — Revisit a past turn's retrieval-and-generation process (US2, FR-018)

1. With at least two answered turns visible (from Scenario 2), click the first (older) generated
   answer.
2. **Expected**: the right panel updates to show that turn's retrieved chunks, query embedding,
   the LLM used, and the prompt sent — not the most recent turn's.
3. Click Send with a new question.
4. **Expected**: the right panel switches back to reflect the newest question (FR-010).

## Scenario 4 — Generation failure and retry (FR-014)

1. Temporarily misconfigure `ANTHROPIC_API_KEY` (or otherwise force a provider failure), send a
   question so chunks are retrieved, then click Generate.
2. **Expected**: a clear error message appears in place of an answer, no fabricated/partial answer
   is shown, and a retry control is offered on that turn.
3. Restore a valid key and click retry.
4. **Expected**: the same question and its already-retrieved chunks are resent (no new retrieval
   performed — the right panel's chunk list does not change), and a successful answer appears.

## Scenario 5 — Concurrency, empty query, and document switch (FR-011, FR-013, FR-015, FR-017)

1. With the query field empty or whitespace-only, click Send. **Expected**: no retrieval or
   generation occurs.
2. Send a question, and while retrieval or generation is in progress, confirm Send and Generate
   are both disabled until the in-flight request finishes or fails (FR-013).
3. Switch to a document with no saved embeddings. **Expected**: Generate is unavailable and the
   screen clearly communicates no chunks are available (FR-015).
4. Switch to a different document that has its own prior conversation. **Expected**: the left
   panel shows that document's conversation instead (or starts empty if none exists), and the
   right panel clears (FR-017).

## Automated coverage

- `backend/tests/contract/test_playground_turns.py` — validates `GET /api/playground/turns` and
  `POST /api/playground/turns` against contracts/playground-api.md, including all documented error
  statuses.
- `backend/tests/contract/test_playground_generate.py` — validates
  `POST /api/playground/turns/{turnId}/generate`, including the 502 failure path and successful
  retry after failure.
- `backend/tests/unit/test_anthropic_provider.py` — verifies prompt construction and response
  parsing against a mocked Anthropic client (no real network calls).
- `backend/tests/unit/test_playground_service.py` — turn creation persists the correct chunk
  snapshots; generate persists prompt/answer/error correctly; generate on a zero-chunk turn is
  rejected.
- `backend/tests/integration/test_playground_conversation_persistence.py` — full cycle: create
  turn → generate → list turns (reload) → confirm the reloaded turn matches what was persisted,
  including after the turn's original `Chunk` rows are deleted by a re-chunk (Decision 1's
  snapshot guarantee).
- `frontend/tests/unit/PlaygroundScreen.test.tsx` / `usePlaygroundConversation.test.ts` — cover
  turn list rendering, send/generate/retry status transitions, the busy-lock (FR-013), and
  clicking a past answer to select its turn.
- `frontend/tests/e2e/playground.spec.ts` — end-to-end: save chunks and embeddings, ask two
  questions with generated answers, reload the page and confirm both persist, click an older
  answer to confirm its retrieval panel reappears.
