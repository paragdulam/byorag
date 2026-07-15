# Contract: Embeddings API (+ one Chunking API addition)

No authentication (single local user), matching every existing endpoint in this project.

---

## `GET /api/chunking/saved-chunks`

**New addition to the existing chunking module** — reads a document's currently saved `Chunk`
rows. Needed because, unlike chunking's own screen, the Embeddings screen must display chunks that
were saved in a *prior* session, not a live preview.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Server-generated `Document` UUID. |

**Response**: `200 OK`, `application/json`:

```json
{ "chunks": [{ "id": "b6b8...", "index": 0, "content": "..." }] }
```

- `chunks` is `[]` (not an error) when the document has no saved chunks yet — a normal, expected
  state (spec FR-002, User Story 1 Acceptance Scenario 3), sorted by `index`.
- `404 Not Found` — `{ "detail": "No document found with id '...'" }` — only for a genuinely
  unknown `documentId`, distinct from "known document, zero saved chunks."

---

## `GET /api/embeddings/models`

Lists the registered embedding models, for the dropdown (spec FR-003) — server-driven, not
hardcoded on the frontend, mirroring the backend's `EMBEDDING_MODELS` registry.

**Response**: `200 OK`:

```json
{ "models": [{ "id": "bert", "label": "BERT (bert-base-uncased)" }] }
```

- The first entry is the default pre-selected option (spec User Story 1, Acceptance Scenario 2).
- No query parameters, no failure modes beyond the generic server-error case.

---

## `GET /api/embeddings/generate/stream`

Computes (but does not persist) embeddings for a document's currently saved chunks, using the
selected model. SSE, mirroring `GET /api/chunking/run/stream`'s event shape.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Must have ≥1 saved chunk (see pre-stream validation). |
| `model` | string | yes | Must be a registered model id (e.g. `"bert"`). |

**Pre-stream validation** (plain HTTP responses, before any stream bytes):

- `400 Bad Request` — `model` not registered:
  ```json
  { "detail": "Unsupported embedding model: 'unknown-model'" }
  ```
- `404 Not Found` — unknown `documentId`:
  ```json
  { "detail": "No document found with id '...'" }
  ```
- `400 Bad Request` — document has zero saved chunks (nothing to embed):
  ```json
  { "detail": "Document has no saved chunks to embed" }
  ```

**Successful response**: `200 OK`, `text/event-stream` — one `progress` event per chunk embedded
(not per page, unlike chunking — the unit of work here is a chunk), then one terminal `result`
event:

```
event: progress
data: {"percent": 50, "chunksEmbedded": 3, "totalChunks": 6}

event: progress
data: {"percent": 100, "chunksEmbedded": 6, "totalChunks": 6}

event: result
data: {"documentId": "...", "model": "bert", "vectors": [{"chunkId": "...", "model": "bert", "dims": 768, "vector": [0.0123, -0.0456, ...]}]}
```

- `progress.percent` — `round(chunksEmbedded / totalChunks * 100)`, monotonically non-decreasing.
- `result.vectors` — one entry per saved chunk, in the same order as
  `GET /api/chunking/saved-chunks`'s response, each a full 768-value vector (research.md §1) —
  nothing is persisted by this endpoint.
- Mid-stream `error` event (defensive, e.g. an unexpected inference failure):
  ```
  event: error
  data: {"message": "..."}
  ```

---

## `GET /api/embeddings/save/stream`

Re-computes embeddings for a document's saved chunks (same computation as generate — research.md
§4, never trusts client-supplied vectors) and persists them, **adding** to any previously saved
embeddings for those chunks (research.md §6 — never replaces). SSE for the same reason as generate:
re-running BERT inference is the dominant, non-trivial cost, so FR-008 requires visible progress
here too, unlike chunking's near-instant `POST /api/chunking/save`.

**Query parameters**: identical to `/generate/stream` (`documentId`, `model`).

**Pre-stream validation**: identical to `/generate/stream`'s three cases above.

**Successful response**: `200 OK`, `text/event-stream` — same `progress` event shape as generate,
then a terminal `result` event describing what was saved (not the raw vectors again):

```
event: progress
data: {"percent": 100, "chunksEmbedded": 6, "totalChunks": 6}

event: result
data: {"documentId": "...", "model": "bert", "savedCount": 6}
```

- `savedCount` — number of new `Embedding` rows inserted (equals the number of saved chunks
  embedded); always a fresh insert count, never a "replaced" count (nothing is ever replaced).
- Mid-stream `error` event — either an inference failure (as generate) or a persistence failure
  (DB write error), in both cases: `{"message": "..."}`. On any error, no partial insert is left
  behind — this save's chunk×model batch is written as a single transaction (existing insert rows
  for other saves are untouched either way, since saves are additive, not replacing).

---

## Unchanged

`GET /api/chunking/run/stream` and `POST /api/chunking/save` (`006`/`012`) are untouched by this
feature — this feature only *reads* already-saved chunks via the new `saved-chunks` endpoint above.
