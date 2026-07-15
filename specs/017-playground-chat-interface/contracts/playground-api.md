# Contract: Playground API (Chat Interface)

No authentication (single local user), matching every existing endpoint in this project. This
replaces the `POST /api/playground/search` contract from 016 — see research.md Decision 2 for why.
`GET /api/playground/context` is unchanged from 016 and not repeated here.

---

## `GET /api/playground/turns`

Lists a document's persisted conversation, oldest first — powers FR-017's automatic reload when
the Playground is opened for a document.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Server-generated `Document` UUID. |

**Response**: `200 OK`, `application/json`:

```json
{
  "documentId": "b6b8...",
  "turns": [
    {
      "id": "t1a2...",
      "question": "What is the refund policy?",
      "queryEmbedding": [0.0123, -0.0456, "... 768 values total"],
      "chunks": [
        { "chunkId": "c1a2...", "index": 3, "content": "Refunds are processed within 5 business days...", "score": 0.87 }
      ],
      "llmProvider": "anthropic",
      "llmModel": "claude-sonnet-5",
      "prompt": "Answer the question using only the context below...\n\n[CHUNK 3]\nRefunds are...\n\nQuestion: What is the refund policy?",
      "answer": "Refunds are processed within 5 business days of the return being received.",
      "error": null,
      "createdAt": "2026-07-15T10:00:00Z",
      "answeredAt": "2026-07-15T10:00:04Z"
    }
  ]
}
```

- `turns` is ordered by `createdAt` ascending (spec: chronological display, FR-009).
- `chunks` is ordered by `rank` ascending (most similar first, matching 016's ranking order).
- An unanswered turn (Generate never clicked) has `llmProvider`, `llmModel`, `prompt`, `answer`,
  `answeredAt` all `null` and `error` `null`.
- A failed turn has `answer` and `answeredAt` `null`, `error` non-null, and `prompt`/`llmProvider`/
  `llmModel` reflecting the last attempt (so the failed attempt itself is inspectable).
- `404 Not Found` — unknown `documentId`: `{ "detail": "No document found with id '...'" }`.
- `turns: []` (not a 404) when the document exists but has no conversation yet — a normal state.

---

## `POST /api/playground/turns`

Embeds the question, retrieves and persists the target document's most similar saved chunks
(same retrieval as 016: cosine similarity, deduplicated to each chunk's best-scoring saved
embedding, top 5), and creates a new `ConversationTurn`. Equivalent request shape to 016's
`POST /api/playground/search`; the response now represents a persisted turn rather than a
throwaway computation.

**Request body**:

```json
{ "documentId": "b6b8...", "model": "bert", "query": "What is the refund policy?" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | Must have ≥1 saved embedding for `model`. |
| `model` | string | yes | Must be a registered embedding model id — normally the value from `GET /api/playground/context`'s `embeddingModel`, passed back explicitly by the client. |
| `query` | string | yes | Non-empty after trimming; rejected if it exceeds `model`'s max input length. |

**Validation** (identical error shapes/order to 016's `/search`; no turn is persisted before all
of these pass):

- `404 Not Found` — unknown `documentId`: `{ "detail": "No document found with id '...'" }`
- `400 Bad Request` — `model` not registered: `{ "detail": "Unsupported embedding model: '...'" }`
- `400 Bad Request` — document has no saved embeddings for `model` (FR-015's "search unavailable"
  case): `{ "detail": "Document has no saved embeddings for model '...'" }`
- `422 Unprocessable Entity` — `query` empty/whitespace: `{ "detail": "Query must not be empty" }`
- `422 Unprocessable Entity` — `query` exceeds max input length:
  `{ "detail": "Query exceeds the embedding model's maximum input length" }`

**Successful response**: `201 Created`, `application/json` — a single turn object, same shape as
one entry in `GET /turns`'s `turns` array, with `llmProvider`/`llmModel`/`prompt`/`answer`/
`error`/`answeredAt` all `null` (generation hasn't been requested yet):

```json
{
  "id": "t1a2...",
  "question": "What is the refund policy?",
  "queryEmbedding": [0.0123, -0.0456, "... 768 values total"],
  "chunks": [
    { "chunkId": "c1a2...", "index": 3, "content": "Refunds are processed within 5 business days...", "score": 0.87 }
  ],
  "llmProvider": null,
  "llmModel": null,
  "prompt": null,
  "answer": null,
  "error": null,
  "createdAt": "2026-07-15T10:00:00Z",
  "answeredAt": null
}
```

- `chunks` has at most 5 entries (fewer only if the document has fewer than 5 saved chunks with an
  embedding for `model` — never padded, never an error, same as 016 SC-004).
- The turn is persisted (visible in a subsequent `GET /turns`) even if the caller never calls
  `generate` on it (spec Assumptions: unanswered turns remain visible).

---

## `POST /api/playground/turns/{turnId}/generate`

Builds the prompt from the turn's persisted question and chunk snapshots, sends it to the
configured `GenerationProvider`, and persists the outcome onto the same turn. Calling this again
on a turn whose last attempt failed is FR-014's retry — it reuses the turn's existing chunk
snapshots and does **not** perform a new retrieval.

**Path parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `turnId` | string | yes | A `ConversationTurn.id` returned by `POST /turns`. |

**Request body**: none.

**Validation**:

- `404 Not Found` — unknown `turnId`: `{ "detail": "No conversation turn found with id '...'" }`
- `400 Bad Request` — the turn has zero retrieved chunks (FR-015):
  `{ "detail": "No retrieved chunks to generate an answer from" }`
- `502 Bad Gateway` — the configured `GenerationProvider` call failed (network error, upstream API
  error, missing/invalid API key — research.md Decision 4):
  `{ "detail": "Answer generation failed: <provider-reported reason>" }`
  The turn's `prompt`, `llmProvider`, and `llmModel` are still persisted from this attempt (so the
  failed attempt is inspectable per FR-018); `error` is set to the same detail message; `answer`
  and `answeredAt` remain (or become) `null`.

**Successful response**: `200 OK`, `application/json` — the updated turn object, now with
`llmProvider`, `llmModel`, `prompt`, `answer`, and `answeredAt` populated and `error: null`:

```json
{
  "id": "t1a2...",
  "question": "What is the refund policy?",
  "queryEmbedding": [0.0123, -0.0456, "... 768 values total"],
  "chunks": [
    { "chunkId": "c1a2...", "index": 3, "content": "Refunds are processed within 5 business days...", "score": 0.87 }
  ],
  "llmProvider": "anthropic",
  "llmModel": "claude-sonnet-5",
  "prompt": "Answer the question using only the context below...\n\n[CHUNK 3]\nRefunds are...\n\nQuestion: What is the refund policy?",
  "answer": "Refunds are processed within 5 business days of the return being received.",
  "error": null,
  "createdAt": "2026-07-15T10:00:00Z",
  "answeredAt": "2026-07-15T10:00:04Z"
}
```

- The response is delivered as a single complete JSON body once generation finishes — no
  streaming/partial responses (per Clarifications; contrasts with the existing
  `/api/chunking/run/stream` and `/api/embeddings/generate/stream` SSE endpoints, which this
  endpoint deliberately does not mirror).
- A successful call always clears any prior `error` from an earlier failed attempt on the same
  turn.

---

## Unchanged

`GET /api/playground/context`, and every existing `/api/chunking/*`, `/api/embeddings/*`,
`/api/sources/*`, and `/api/corpora/*` endpoint, are untouched by this feature.

## Removed

`POST /api/playground/search` (016) is replaced by `POST /api/playground/turns` — see research.md
Decision 2. Any client still calling the old path receives a `404` (route no longer registered).
