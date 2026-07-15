# Contract: Playground API

No authentication (single local user), matching every existing endpoint in this project.

---

## `GET /api/playground/context`

Read-only: the currently-active chunking strategy and embedding model for a document's saved
data, so User Story 2 can display them **before** any search is submitted, without requiring a
search to run first.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Server-generated `Document` UUID. |

**Response**: `200 OK`, `application/json`:

```json
{
  "documentId": "b6b8...",
  "chunkingStrategy": "fixed-size",
  "embeddingModel": "bert"
}
```

- `chunkingStrategy` — the `strategy` value recorded on the document's saved chunks (`null` if the
  document has no saved chunks yet).
- `embeddingModel` — the `model` of the document's most recently created saved `Embedding`, across
  all of its chunks (`null` if none of its chunks have any saved embedding yet). "Most recent"
  mirrors the existing newest-first default already used for a chunk's saved-embedding picker
  (014-vector-view-screen research.md §3).
- `404 Not Found` — `{ "detail": "No document found with id '...'" }` — only for a genuinely
  unknown `documentId`.
- Never a `400` — an empty/not-yet-embedded document is a normal, expected state (spec FR-010),
  represented by `null` fields, not an error.

---

## `POST /api/playground/search`

Embeds the given query text with the specified embedding model, ranks the target document's saved
chunks by cosine similarity to that embedding (deduplicated to each chunk's single best-scoring
saved embedding — FR-008), and returns both the query embedding and the top 5 ranked results.

**Request body**:

```json
{ "documentId": "b6b8...", "model": "bert", "query": "What is the refund policy?" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Must have ≥1 saved embedding for `model` (see validation below). |
| `model` | string | yes | Must be a registered embedding model id. Normally the value returned by `GET /api/playground/context`'s `embeddingModel`, passed back explicitly by the client — the server does not re-derive it, so the response always reflects exactly the model the client asked for. |
| `query` | string | yes | Non-empty after trimming; rejected if it exceeds `model`'s max input length (research.md Decision 4). |

**Validation** (plain HTTP responses, no partial work is ever started before these pass):

- `404 Not Found` — unknown `documentId`:
  ```json
  { "detail": "No document found with id '...'" }
  ```
- `400 Bad Request` — `model` not registered:
  ```json
  { "detail": "Unsupported embedding model: 'unknown-model'" }
  ```
- `400 Bad Request` — the document has no saved embeddings for `model` (FR-010's "search
  unavailable" case):
  ```json
  { "detail": "Document has no saved embeddings for model 'bert'" }
  ```
- `422 Unprocessable Entity` — `query` is empty or whitespace-only:
  ```json
  { "detail": "Query must not be empty" }
  ```
- `422 Unprocessable Entity` — `query` exceeds `model`'s maximum supported input length (FR-014):
  ```json
  { "detail": "Query exceeds the embedding model's maximum input length" }
  ```
  The `422` status itself is the machine-readable signal the frontend uses to show FR-014's
  distinct "query too long" copy — it does not need to pattern-match this `detail` string (mirrors
  how `EmbeddingsScreen` never surfaces raw backend error text — research.md Decision 5).

**Successful response**: `200 OK`, `application/json`:

```json
{
  "documentId": "b6b8...",
  "model": "bert",
  "queryEmbedding": [0.0123, -0.0456, "... 768 values total"],
  "results": [
    {
      "chunkId": "c1a2...",
      "index": 3,
      "content": "Refunds are processed within 5 business days...",
      "score": 0.87
    }
  ]
}
```

- `results` has at most 5 entries, ordered by `score` descending (FR-006); fewer than 5 only when
  the document has fewer than 5 saved chunks with an embedding for `model` (FR-006, SC-004).
  Never padded, never an error.
- `score` is the raw cosine similarity (`1 - cosine_distance`, research.md Decision 1), a value in
  `[-1, 1]` in principle though BERT mean-pooled embeddings in practice cluster toward positive
  values; presentation formatting (e.g., as a percentage) is a frontend concern, not part of this
  contract.
- Each `chunkId` appears at most once (FR-008) — ties in `score` are included and ordered
  arbitrarily-but-deterministically by the database (spec Edge Cases: tie order is not
  user-significant).
- Nothing is persisted by this endpoint — it is pure read + compute, unlike `save/stream`.

---

## Unchanged

Every existing `/api/chunking/*`, `/api/embeddings/*`, `/api/sources/*`, and `/api/corpora/*`
endpoint is untouched by this feature — Playground only *reads* already-saved chunks/embeddings
via the two new endpoints above, plus reuses the existing `EMBEDDING_MODELS` registry internally
to embed the query (no new embedding code path).
