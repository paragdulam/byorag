# Contract: Chunking Streaming API

Base path: `/api/chunking`. No authentication (single local user).

This replaces `005-fixed-size-chunking`'s `POST /api/chunking/run` (removed — research.md §2) with
a single streaming endpoint that reports real, backend-driven progress (spec.md Clarifications,
research.md §1) while the requested document is chunked.

---

## `GET /api/chunking/run/stream`

Extracts the selected document's text (page by page) and splits it using the fixed-size strategy
— the only strategy this screen offers (FR-002). Always behaves as `strategy="fixed-size"`
server-side; there is no `strategy` input anymore.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Must match an existing document's `id` from `GET /api/sources` (`002-persist-pdf-sources`). |
| `chunkSize` | integer | yes | Positive integer; approximate word count per chunk (unchanged from 005). |

**Pre-stream validation (returned as plain HTTP responses, before any stream bytes are sent — research.md §3)**:

- **`400 Bad Request`** — `chunkSize` missing, non-integer, or `<= 0`:
  ```json
  { "detail": "chunkSize must be a positive integer" }
  ```
- **`404 Not Found`** — no document with the given `documentId`:
  ```json
  { "detail": "No document found with id 'does-not-exist.pdf'" }
  ```

**Successful response**: `200 OK`, `Content-Type: text/event-stream`, one or more `progress`
events followed by exactly one terminal `result` event, then the connection closes.

```
event: progress
data: {"percent": 0}

event: progress
data: {"percent": 43}

event: progress
data: {"percent": 87}

event: result
data: {"extractionFailed": false, "result": {"chunks": [{"index": 0, "content": "..."}], "totalChunks": 812, "strategy": "fixed-size", "chunkSize": 50}}

```

**Extraction-failed run** (e.g., a scanned PDF with no text layer) — still a `200 OK` stream; only
the terminal event's payload differs:

```
event: progress
data: {"percent": 0}

event: progress
data: {"percent": 100}

event: result
data: {"extractionFailed": true, "result": null}

```

**Mid-stream unexpected failure** (research.md §3 — only for genuine unexpected errors after
streaming has begun; not used for validation, which is rejected before the stream opens):

```
event: error
data: {"message": "Unexpected error while chunking this document."}

```

**Field semantics**:
- `progress` events — `percent` is `pages_processed / total_pages * 90`, floored to an integer, so
  it always starts at (or immediately reaches) `0` and never exceeds `90` before the terminal
  event. It is monotonically non-decreasing within a single run. A one-page document may emit only
  a single `progress` event at `0` before the terminal event.
- `result` event — identical payload shape to 005's `ChunkRunResponse` (`extractionFailed`,
  `result`), unchanged field semantics for `chunks` (capped at 200, FR unchanged from 005),
  `totalChunks`, `strategy` (always `"fixed-size"`), and `chunkSize`.
- `error` event — only for failures that occur after the stream has already started (e.g., an
  unexpected exception while reading the file); the frontend maps this to the existing `'error'`
  status (FR unchanged from 005's error-handling behavior).
- The stream always ends with exactly one terminal event (`result` or `error`); no further events
  follow it and the HTTP response then completes normally.

**Removed**: `POST /api/chunking/run` and its JSON request body (`documentId`, `chunkSize`,
`strategy`) no longer exist (research.md §2). Any caller must use this streaming `GET` endpoint.
