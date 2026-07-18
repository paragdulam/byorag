# Contract: Metrics API

No authentication (single local user), matching every existing endpoint in this project. New
endpoints backing the Metrics screen (spec `019-metrics-dashboard`). See `data-model.md` for the
"RAG pipeline" grouping key `(corpus_id, chunking_strategy, embedding_model)` used throughout.

---

## `GET /api/metrics/corpora`

Lists every corpus with a lightweight summary — powers the Metrics screen's corpus list (FR-001).

**Response**: `200 OK`, `application/json`:

```json
{
  "corpora": [
    {
      "corpusId": "c0a1...",
      "name": "Product Docs",
      "chunkingStrategies": ["fixed-size"],
      "hasPipelines": true
    },
    {
      "corpusId": "c0a2...",
      "name": "Empty Corpus",
      "chunkingStrategies": [],
      "hasPipelines": false
    }
  ]
}
```

- `chunkingStrategies`: distinct chunking technique names with at least one saved chunk among the
  corpus's documents, in no particular order.
- `hasPipelines`: `false` when `chunkingStrategies` is empty (FR-014's "no chunking pipeline
  established yet" state) — lets the client render the empty state without a second request.

---

## `GET /api/metrics/corpora/{corpusId}/pipelines`

Lists every `(chunking_strategy, embedding_model)` pipeline for one corpus, each with its own
summary figures — powers the technique switcher (US2) and is the data source the comparison modal
(US3) also reuses.

**Path parameters**: `corpusId` — server-generated `Corpus` UUID.

**Response**: `200 OK`, `application/json`:

```json
{
  "corpusId": "c0a1...",
  "pipelines": [
    {
      "chunkingStrategy": "fixed-size",
      "embeddingModel": "bert",
      "chunkCount": 214,
      "questionCount": 12,
      "answerCount": 11,
      "scopeBreakdown": { "corpus": 4, "document": 8 },
      "scores": {
        "contextPrecision": 0.81,
        "contextRecall": 0.74,
        "responseRelevancy": 0.88,
        "faithfulness": 0.92,
        "sampleSize": 11
      }
    }
  ]
}
```

- `pipelines` is empty when the corpus has no saved chunks (mirrors `hasPipelines: false`).
- `scores` is `null` (not zeros) when `sampleSize` would be 0 — no answered-and-scored question yet
  for this pipeline (FR-013). When present, each score is the mean of that measure across every
  scored turn matching this pipeline, and `sampleSize` is the count of scored turns contributing to
  that mean — clients use `sampleSize` to render "based on N questions" rather than presenting a
  score as universally final.
- `scopeBreakdown.corpus` / `.document` count questions by `ConversationTurn.scope`, summing to
  `questionCount` (FR-006).
- `404 Not Found` — unknown `corpusId`: `{ "detail": "No corpus found with id '...'" }`.

---

## `GET /api/metrics/corpora/{corpusId}/compare`

Same shape as the `pipelines` endpoint's array, returned together for the comparison modal (US3) so
the client can render every pipeline in one response rather than one request per technique.

**Path parameters**: `corpusId` — server-generated `Corpus` UUID.

**Response**: `200 OK`, `application/json` — identical shape to `GET .../pipelines`'s response body.

- `400 Bad Request` — corpus has fewer than 2 pipelines: `{ "detail": "Corpus has fewer than 2 pipelines to compare" }` (matches spec User Story 3, Acceptance Scenario 2 — the client is expected to disable/hide the Compare action in this case, so this response is a defensive guard, not the primary UX path).
- `404 Not Found` — unknown `corpusId`: unchanged.
