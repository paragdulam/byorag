# Contract: Chunking Save Stream API

Base path: `/api/chunking`. No authentication (single local user).

This **replaces** `012-save-chunks-button`'s `POST /api/chunking/save` with a streaming
`GET /api/chunking/save/stream`, so the frontend can show real save progress (spec FR-014),
mirroring `/api/embeddings/save/stream` (`013-bert-pgvector-embeddings`) exactly. No other
`chunking` endpoint changes.

---

## `GET /api/chunking/save/stream`

Recomputes the chunking result for a document (deterministic given the same inputs — `012`
research.md §1) while streaming real extraction progress, then persists it — fully replacing any
previously saved chunks for that document, exactly as the old `POST /save` did. Strategy is not a
request field — like `run/stream`, this only ever saves `"fixed-size"` results.

**Request** (query parameters, not a JSON body — `EventSource` only issues GET):

```
GET /api/chunking/save/stream?documentId=b6b8...&chunkSize=512&overlap=50
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Same semantics as `run/stream`'s `documentId` — the server-generated `Document` UUID. |
| `chunkSize` | integer | yes | Same validation as `run/stream`: must be a positive integer. |
| `overlap` | integer | no | Defaults to `0`. Must satisfy `0 <= overlap < chunkSize`, same as `run/stream`. |

**Pre-stream validation** (returned as plain HTTP responses before the stream opens, identical to
`run/stream`'s pre-stream validation):

- **`400 Bad Request`** — `chunkSize` missing, non-integer, or `<= 0`:
  ```json
  { "detail": "chunkSize must be a positive integer" }
  ```
- **`400 Bad Request`** — `overlap` negative, or `overlap >= chunkSize`:
  ```json
  { "detail": "overlap must be a non-negative integer smaller than chunkSize" }
  ```
- **`404 Not Found`** — no document with the given `documentId`:
  ```json
  { "detail": "No document found with id '...'" }
  ```

**Stream** (`text/event-stream`), identical event shape to `run/stream` and
`/api/embeddings/save/stream`:

- Zero or more `progress` events during page-by-page text extraction (same 0–90% real-progress
  behavior as `run/stream` — `012` research.md/§1's own reuse of `stream_chunking`):
  ```
  event: progress
  data: {"percent": 42}
  ```
- One terminal `result` event, same `ChunkRunResponse` payload shape the old `POST /save`
  returned synchronously:
  ```
  event: result
  data: {"extractionFailed": false, "result": {"chunks": [...], "totalChunks": 940, "strategy": "fixed-size", "chunkSize": 512, "overlap": 50}}
  ```
  - If no text can be extracted, the terminal event is still `result` with
    `{"extractionFailed": true, "result": null}`, and **nothing is persisted** — any previously
    saved chunks for the document are left unchanged (mirrors old `POST /save`'s behavior).
  - `result.chunks` is capped at `MAX_CHUNKS` (200), matching `run/stream` and the old `POST
    /save`; the persisted rows match this capped list exactly.
- A mid-stream `error` event only for genuinely unexpected failures (e.g., a database write
  failure during persistence), mirroring `run/stream`'s and `/embeddings/save/stream`'s existing
  `error` event shape:
  ```
  event: error
  data: {"message": "Failed to save chunks: ..."}
  ```
  Any previously saved chunks for the document remain unchanged (the replace is a single
  transaction — delete + insert then commit; a failure rolls back rather than partially applying,
  same guarantee the old `POST /save` gave).

**Idempotency / replace semantics**: Unchanged from `012` — calling this endpoint again for the
same document, with the same or different `chunkSize`/`overlap`, fully replaces the previously
saved chunk rows for that `documentId`. No versioning; only the latest save is retained.

---

## Removed: `POST /api/chunking/save`

This endpoint, its request schema (`ChunkSaveRequest`), and the synchronous "call it, get one
JSON response back" contract from `012-save-chunks-button` no longer exist. Nothing else in this
codebase depends on the old endpoint continuing to exist — the only frontend caller
(`frontend/src/lib/chunkingApi.ts`'s `saveChunks()`) is replaced by a `saveChunksStream()`
function built the same way `saveEmbeddingsStream()` already is.
