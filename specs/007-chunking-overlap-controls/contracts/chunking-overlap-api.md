# Contract: Chunking Streaming API — Overlap Addition

Base path: `/api/chunking`. No authentication (single local user).

This amends `006-chunking-embeddings-redesign`'s `GET /api/chunking/run/stream` contract by adding
an `overlap` query parameter and an `overlap` field on the terminal `result` event's payload. No
other part of the endpoint's behavior (SSE event types, progress semantics, 200-chunk cap,
extraction-failure/error events) changes.

---

## `GET /api/chunking/run/stream`

**Query parameters** (`chunkSize`/`documentId` unchanged from `006`; `overlap` is new):

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Unchanged. |
| `chunkSize` | integer | yes | Unchanged. |
| `overlap` | integer | no | **New.** Defaults to `0` (no overlap — identical to pre-feature behavior) when omitted. Must satisfy `0 <= overlap < chunkSize`. |

**Pre-stream validation** (returned as plain HTTP responses, before any stream bytes are sent —
unchanged mechanism from `006`; one new case added):

- **`400 Bad Request`** — `chunkSize` missing, non-integer, or `<= 0` (unchanged):
  ```json
  { "detail": "chunkSize must be a positive integer" }
  ```
- **`400 Bad Request`** — **new**: `overlap` is negative, or `overlap >= chunkSize`:
  ```json
  { "detail": "overlap must be a non-negative integer smaller than chunkSize" }
  ```
- **`404 Not Found`** — no document with the given `documentId` (unchanged):
  ```json
  { "detail": "No document found with id 'does-not-exist.pdf'" }
  ```

**Successful response**: `200 OK`, `Content-Type: text/event-stream` — unchanged event sequence
(one or more `progress` events, then exactly one terminal `result` event). The terminal event's
`result` object gains one field, `overlap`:

```
event: progress
data: {"percent": 0}

event: progress
data: {"percent": 87}

event: result
data: {"extractionFailed": false, "result": {"chunks": [{"index": 0, "content": "..."}], "totalChunks": 940, "strategy": "fixed-size", "chunkSize": 50, "overlap": 10}}

```

**Extraction-failed / mid-stream `error` events**: unchanged from `006` — `overlap` has no effect
on these paths since no chunking occurs.

**Field semantics** (only the new/changed field is documented here; all others are unchanged from
`006-chunking-embeddings-redesign`'s contract):
- `overlap` (query param) — approximate-token count (same unit as `chunkSize`) of trailing content
  repeated at the start of each subsequent chunk. `0` reproduces exactly the non-overlapping
  behavior that existed before this feature.
- `result.overlap` — echoes the `overlap` query parameter used for this run, so the response is
  fully self-describing (mirrors the existing `result.chunkSize` echo).
- `result.totalChunks` — unchanged field; naturally increases for the same document/`chunkSize`
  as `overlap` increases, since a larger overlap produces a smaller stride and therefore more
  windows over the same text (research.md §1).

**Unchanged**: `documentId`/`chunkSize` validation, progress-event semantics, the 200-chunk display
cap (`chunks` vs. `totalChunks`), the `error` event for mid-stream failures, and the removal of the
old `POST /api/chunking/run` endpoint (already removed in `006`).
