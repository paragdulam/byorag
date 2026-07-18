# Contract: Playground Corpus-Wide Question Scope

No authentication (single local user), matching every existing endpoint in this project. This
extends the existing `017-playground-chat-interface` Playground API (`GET /api/playground/context`,
`GET /api/playground/turns`, `POST /api/playground/turns`) to support asking a question against an
entire corpus, not only a single document. Only the deltas are documented here — fields not
mentioned are unchanged from the 017 contract.

---

## `GET /api/playground/context`

**Change**: accepts either `documentId` (existing, unchanged behavior) or `corpusId` (new) as the
scope to inspect.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | one of `documentId`/`corpusId` | Existing behavior, unchanged. |
| `corpusId` | string | one of `documentId`/`corpusId` | New. Server-generated `Corpus` UUID. |

**Response** (`corpusId` variant): `200 OK`, `application/json`:

```json
{ "corpusId": "c0a1...", "chunkingStrategy": "fixed-size", "embeddingModel": "bert" }
```

- `chunkingStrategy`/`embeddingModel` reflect the most recently saved chunking technique/embedding
  model found among the corpus's documents, mirroring the existing document-scoped behavior. `null`
  when the corpus has no saved chunks/embeddings yet.
- When a corpus has saved chunks from more than one technique, this endpoint still returns a single
  "most recent" pair (as the document-scoped variant already does) — technique **selection** for
  asking a question is a client-side concern (the client passes back whichever technique/model the
  Metrics/Playground UI has selected), not something this read-only context endpoint arbitrates.
- `404 Not Found` — unknown `corpusId`: `{ "detail": "No corpus found with id '...'" }`.

---

## `POST /api/playground/turns`

**Change**: request body now accepts either `documentId` (existing) or `corpusId` (new) as the
question's scope, mutually exclusive.

**Request body** (corpus-wide variant):

```json
{ "corpusId": "c0a1...", "model": "bert", "query": "What is the refund policy?" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | exactly one of `documentId`/`corpusId` | Existing behavior, unchanged. |
| `corpusId` | string | exactly one of `documentId`/`corpusId` | New. Must have ≥1 document with a saved embedding for `model`. |
| `model` | string | yes | Unchanged — must be a registered embedding model id. |
| `query` | string | yes | Unchanged. |

**Behavior**: retrieves the top 5 chunks ranked by cosine similarity across every document
currently linked to the corpus (one global ranking, not top-5-per-document — research.md §4),
persists a `ConversationTurn` with `scope = "corpus"` and `corpus_id` set (`document_id` null), and
persists each retrieved chunk's originating `document_id` on its `ConversationTurnChunk` snapshot.

**Validation** (same ordering discipline as the existing document-scoped path — no turn persisted
before all checks pass):

- `400 Bad Request` — both or neither of `documentId`/`corpusId` provided:
  `{ "detail": "Exactly one of documentId or corpusId must be provided" }`
- `404 Not Found` — unknown `corpusId`: `{ "detail": "No corpus found with id '...'" }`
- `400 Bad Request` — `model` not registered: `{ "detail": "Unsupported embedding model: '...'" }`
- `400 Bad Request` — no document in the corpus has a saved embedding for `model`:
  `{ "detail": "Corpus has no saved embeddings for model '...'" }`
- `400 Bad Request` — empty query / query too long: unchanged messages from the existing contract.

**Response**: same `TurnOut` shape as the existing contract, with two additions:

```json
{
  "id": "t1a2...",
  "scope": "corpus",
  "corpusId": "c0a1...",
  "documentId": null,
  "question": "What is the refund policy?",
  "chunks": [
    { "chunkId": "c1a2...", "documentId": "d9f0...", "index": 3, "content": "Refunds are processed within 5 business days...", "score": 0.87 }
  ],
  "...": "remaining fields unchanged from the 017 TurnOut contract"
}
```

- `scope`: `"document"` or `"corpus"` (new field, present on every turn, including existing
  document-scoped ones now returned by `GET /api/playground/turns`).
- `corpusId`/`documentId`: exactly one is non-null, matching `scope`.
- `chunks[].documentId`: new field — which document that retrieved chunk came from. Always
  populated for `scope = "corpus"` turns; may be `null` for `scope = "document"` turns.

---

## `GET /api/playground/turns`

**Change**: accepts either `documentId` or `corpusId` as the query scope, same mutual-exclusivity
rule as `POST /api/playground/turns`. Response `turns[]` entries include the new `scope`,
`corpusId`, and `chunks[].documentId` fields described above.
