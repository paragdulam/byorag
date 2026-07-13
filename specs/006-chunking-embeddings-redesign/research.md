# Research: Chunking Section Redesign & Embeddings Entry Point

## 1. How should the backend report *real* chunking progress (clarified requirement) without adding heavyweight infrastructure?

**Decision**: Convert the chunking run endpoint from a single-shot `POST /api/chunking/run` (JSON request/response) to a streaming `GET /api/chunking/run/stream` endpoint that returns a `text/event-stream` (Server-Sent Events) response via FastAPI's `StreamingResponse`. The backend emits a `progress` event after each PDF page is extracted (percent = pages processed so far ÷ total pages, scaled to 0–90%), then runs the (fast, in-memory) fixed-size splitting step and emits a final `result` event (percent 100) carrying the existing `ChunkRunResponse` payload unchanged.

**Rationale**: The spec's clarification requires progress driven by real backend work, not a client-side timer. Page-by-page PDF text extraction (`backend/app/chunking/service.py::extract_text`, already a `for page in reader.pages` loop) is the one part of the pipeline whose cost scales with document size, so it's the natural, honest progress signal — no fabricated intermediate steps are needed. SSE over a plain GET request needs no new dependency (FastAPI/Starlette already support `StreamingResponse`) and no job-queue, WebSocket server, or polling-with-persistence layer, keeping Principle III (Single-User Simplicity / YAGNI) intact. GET (rather than POST) lets the browser's native `EventSource` API consume the stream directly with automatic reconnection semantics not needed here but free.

**Alternatives considered**:
- *WebSocket connection*: bidirectional and more infrastructure than this one-way, fire-and-forget progress feed needs; rejected as over-engineering for a single local user.
- *POST to start a job + client polls a `GET .../{jobId}/progress` endpoint*: requires persisting job state (even if in-memory) and a cleanup/expiry story; more moving parts than a single streamed request for a feature with no cross-session resumption requirement.
- *Client-side simulated/time-based progress animation*: simplest to build, but explicitly rejected by the clarification — it does not reflect real backend work and would misrepresent progress for documents whose extraction time varies.
- *Keep `POST /api/chunking/run` unchanged and add a separate progress endpoint polled on an interval*: doubles the number of endpoints and requires the backend to track run state between requests; a single streamed response is simpler and removes the state-tracking problem entirely.

## 2. Should the existing `POST /api/chunking/run` endpoint be kept alongside the new streaming endpoint?

**Decision**: Replace it. The streaming `GET /api/chunking/run/stream` endpoint becomes the only way to run chunking; the old POST endpoint, its request schema field usages, and its now-superseded contract test are removed.

**Rationale**: This is a local, single-user tool (Principle III) with exactly one caller (this frontend screen). Keeping both endpoints would mean maintaining two implementations of the same chunking-and-cap logic indefinitely for no consumer. Removing the old endpoint keeps exactly one code path for "run chunking," which is also easier to keep correctly tested (Principle II).

**Alternatives considered**: Keeping the old endpoint for backward compatibility was considered and rejected — there is no external/second consumer of this API to be compatible with (Assumptions, spec.md).

## 3. How should validation errors (bad document id, non-positive chunk size, unsupported strategy) surface once the response is a stream?

**Decision**: Perform all input validation (document existence, `chunkSize > 0`, known strategy) *before* opening the `StreamingResponse`, exactly as today, so those cases still return plain HTTP 404/400 responses with the existing error bodies. Only the *extraction-failed* case (empty extracted text — discovered only after streaming has already started, since it requires having read the pages) is reported as the final `result` event with `extractionFailed: true`, reusing the existing `ChunkRunResponse` shape unchanged.

**Rationale**: HTTP status codes can only be set before the first byte of a streaming response is sent. Everything that can be validated synchronously up front (document id, chunk size, strategy name) already is validated up front in `service.py` today, so this preserves the current, already-tested error contract for those cases with zero behavior change. Only the genuinely mid-stream failure mode (extraction failure) needs to travel inside the stream, and it already had a payload shape (`extractionFailed: true`) designed for exactly this — no new error envelope is introduced.

**Alternatives considered**: Encoding all errors as SSE `error` events (including document-not-found/bad-chunk-size) was considered for consistency, but rejected because it would be a gratuitous behavior change to already-correct, already-tested 400/404 responses for no benefit.

## 4. How should the frontend consume the SSE stream?

**Decision**: Use the browser's native `EventSource` API (GET-only, which is why the endpoint takes `documentId`/`chunkSize` as query parameters rather than a JSON body) inside `frontend/src/lib/chunkingApi.ts`, exposing a `runChunkingStream(documentId, chunkSize, { onProgress, onResult, onError })` function that opens the `EventSource`, wires its `progress`/`result`/`error` named events, and closes the connection once a terminal event (`result` or `error`) arrives.

**Rationale**: `EventSource` is built into every target browser (Target Platform: desktop web browsers, unchanged) and needs no new frontend dependency, consistent with Principle III/IV. It natively parses the `event: ...\ndata: ...\n\n` framing the backend emits, so no hand-rolled stream-chunk parser is needed.

**Alternatives considered**: Manually reading a `fetch()` response body via `ReadableStream`/`TextDecoder` was considered (would allow POST) but rejected as unnecessary hand-rolled parsing work when `EventSource` already does it, given the endpoint has no need for a request body.

## 5. Should the chunk list use a virtualization library for the internally-scrollable list?

**Decision**: No. Keep rendering the full (already-capped-at-200, per the existing `MAX_CHUNKS` constant) chunk list as plain DOM nodes inside a `flex-1 overflow-y-auto` container; no virtualization library is introduced.

**Rationale**: 200 DOM nodes of short text blocks is not a performance concern in any modern browser, and the cap already exists from the 005 feature. Adding a virtualization dependency (e.g., `react-window`) for this scale would violate Principle III (YAGNI) and Principle IV (no new frontend dependency without cause).

**Alternatives considered**: `react-window`/`react-virtualized` — rejected as unneeded complexity at this list size.

## 6. How should the "fits on screen, chunk list scrolls internally" layout be achieved?

**Decision**: Give the Chunking screen's content region a fixed-height flex-column layout (`h-full flex flex-col`, matching the existing `AppShell`'s content slot) with three stacked regions: (a) sub-header + horizontal control bar (fixed height, no shrink), (b) the chunk list region (`flex-1 min-h-0 overflow-y-auto`), and (c) the bottom action bar (fixed height, no shrink). Only region (b) scrolls.

**Rationale**: This is a standard CSS flexbox pattern (`flex-1 min-h-0` is what allows a flex child to become independently scrollable instead of growing the page) and needs no new library — Tailwind (already in use throughout the frontend) expresses it directly.

**Alternatives considered**: A CSS Grid-based layout was considered; flexbox was chosen only because it mirrors the pattern already used by `AppShell` and other screens in this codebase, minimizing unrelated diff.

## 7. How should "Move to Embeddings" enablement (clarified: gated on a successful chunk run) be tracked?

**Decision**: Add a `hasSucceededOnce: boolean` field to the existing `useFixedSizeChunking` hook's state, set to `true` the first time a run's terminal state is `'success'`, and never reset back to `false` for the remainder of the session (including across subsequent re-runs, even if a later run fails).

**Rationale**: The clarification requires the button disabled "until 'Re-calculate Chunks' has completed successfully at least once in the current session" — it does not require re-disabling it after a later failed run, so a one-way latch is the simplest state shape that satisfies the requirement (Principle III).

**Alternatives considered**: Deriving enablement purely from `status === 'success'` (i.e., re-disabling on every subsequent failed re-run) was considered but rejected as contradicting the "at least once in the current session" wording, which implies a persistent-within-session unlock, not a live reflection of the latest run's outcome.

## 8. What should the new Embeddings placeholder screen consist of?

**Decision**: A new minimal component (`EmbeddingsScreen`) rendered inside the existing `AppShell`, showing only a short "Embeddings configuration is coming soon" style message — no data fetching, no controls, no state carried over from the Chunking screen.

**Rationale**: Matches the clarified scope exactly (AppShell/nav intact, short message, no functional controls, no carried-over state) and requires no new dependency or backend endpoint.

**Alternatives considered**: None — this was fully resolved by the clarification.
