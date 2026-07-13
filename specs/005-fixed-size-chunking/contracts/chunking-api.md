# Contract: Chunking API

Base path: `/api/chunking`. No authentication (single local user). All responses are
`application/json`.

---

## `POST /api/chunking/run`

Extracts the selected document's text and splits it using the requested chunking strategy. Only
`"fixed-size"` is implemented today (research.md §1) — the `strategy` field is included from day
one so future strategies can be added without a breaking contract change.

**Request**: `application/json`
```json
{
  "documentId": "report.pdf",
  "chunkSize": 50,
  "strategy": "fixed-size"
}
```

**Response `200 OK` — success**:

```json
{
  "extractionFailed": false,
  "result": {
    "chunks": [
      { "index": 0, "content": "The architecture of modern Retrieval-Augmented Generation..." },
      { "index": 1, "content": "systems relies heavily on the quality of document partitioning..." }
    ],
    "totalChunks": 812,
    "strategy": "fixed-size",
    "chunkSize": 50
  }
}
```

**Response `200 OK` — extraction failed (e.g., a scanned PDF with no text layer)**:

```json
{
  "extractionFailed": true,
  "result": null
}
```

**Response `400 Bad Request` — malformed request or invalid chunk size**:

```json
{ "detail": "chunkSize must be a positive integer" }
```

Also returned for a missing `documentId`/`chunkSize`, or an unsupported `strategy` value (anything
other than `"fixed-size"` today).

**Response `404 Not Found` — no document with the given id**:

```json
{ "detail": "No document found with id 'does-not-exist.pdf'" }
```

**Field semantics**:
- `documentId` — must match an existing document's `id` as returned by `GET /api/sources`
  (`002-persist-pdf-sources`); the endpoint reads that file's bytes from `PDFS_DIR` directly, it
  does not accept uploaded content in this request.
- `chunkSize` — a positive integer, interpreted as an approximate word count per chunk
  (research.md §3), not an exact LLM-tokenizer token count.
- `strategy` — currently only `"fixed-size"` is accepted; any other value is a `400`.
- `extractionFailed` — `true` only when the selected document's text could not be extracted at
  all (FR-012). This is the **only** condition under which `result` is `null`; it is never `null`
  on a successful run, even when the document produces zero chunks (an empty-text document would
  still return `result` with `chunks: []`, `totalChunks: 0`).
- `result.chunks` — at most 200 entries (FR-007a), ordered by `index` starting at `0`.
- `result.totalChunks` — the true chunk count the run produced, which may exceed
  `result.chunks.length` when the cap applies. The frontend shows the "more chunks exist" note
  (SC-005) whenever `totalChunks > chunks.length`.
- `result.strategy` / `result.chunkSize` — echo the request's `strategy`/`chunkSize`, so the
  frontend can display what produced this result without keeping separate client-side state in
  sync.

**Error responses**:
- `400 Bad Request` — see above (malformed body, invalid `chunkSize`, unsupported `strategy`).
- `404 Not Found` — see above (`documentId` does not exist).
- No other error statuses are expected in normal operation — extraction failure is represented in
  a `200` body (`extractionFailed: true`), not an HTTP error, since it is an expected per-document
  outcome the UI must render gracefully (FR-012), not a transport-level failure.
