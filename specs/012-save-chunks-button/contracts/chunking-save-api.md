# Contract: Chunking Save API

Base path: `/api/chunking`. No authentication (single local user).

This adds a new endpoint, `POST /api/chunking/save`, and amends the existing
`GET /api/chunking/run/stream` endpoint's *side effects only* (no request/response shape change to
that endpoint — see "Amendment" below).

---

## `POST /api/chunking/save`

Recomputes the chunking result for a document (deterministic given the same inputs — research.md
§1) and persists it, fully replacing any previously saved chunks for that document. Strategy is
not a request field — like `/run/stream`, this screen only ever saves `"fixed-size"` results.

**Request body** (`application/json`):

```json
{ "documentId": "b6b8...", "chunkSize": 512, "overlap": 50 }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Same semantics as `/run/stream`'s `documentId` — the server-generated `Document` UUID. |
| `chunkSize` | integer | yes | Same validation as `/run/stream`: must be a positive integer. |
| `overlap` | integer | no | Defaults to `0`. Must satisfy `0 <= overlap < chunkSize`, same as `/run/stream`. |

**Pre-save validation** (returned as plain HTTP responses, no stream involved):

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

**Successful response**: `200 OK`, `application/json`, same shape as `/run/stream`'s terminal
`result` event payload (`ChunkRunResponse`):

```json
{
  "extractionFailed": false,
  "result": {
    "chunks": [{ "index": 0, "content": "..." }],
    "totalChunks": 940,
    "strategy": "fixed-size",
    "chunkSize": 512,
    "overlap": 50
  }
}
```

- If no text can be extracted from the document (mirrors `/run/stream`'s extraction-failed case),
  the response is still `200 OK` with:
  ```json
  { "extractionFailed": true, "result": null }
  ```
  and **nothing is persisted** — any previously saved chunks for the document are left unchanged
  (spec Edge Cases).
- `result.chunks` is capped at the same `MAX_CHUNKS` (200) limit as the preview endpoint, and the
  persisted rows match this capped list exactly (spec Assumptions).

**Persistence failure**: `500 Internal Server Error` if the database write itself fails (e.g.
connectivity issue):
```json
{ "detail": "Failed to save chunks: ..." }
```
Any previously saved chunks for the document remain unchanged (spec FR-007) — the replace is a
single transaction (delete + insert then commit); a failure rolls back rather than partially
applying.

**Idempotency / replace semantics**: Calling this endpoint again for the same document — with the
same or different `chunkSize`/`overlap` — fully replaces the previously saved chunk rows for that
`documentId`. There is no versioning; only the latest save is retained (spec FR-005).

---

## Amendment: `GET /api/chunking/run/stream`

**No change** to the request parameters, SSE event types, or response payload shapes documented in
`006-chunking-embeddings-redesign`'s and `007-chunking-overlap-controls`'s contracts.

**Side-effect change**: this endpoint **no longer writes to the database**. Previously, a
successful run replaced the document's saved `Chunk` rows as a side effect; now it only computes
and streams the result for display (spec FR-001). Persisting requires a separate, explicit call to
`POST /api/chunking/save` above (spec FR-002).
