# Contract: Metrics API — Retrieval/Generation Stage Fields

No authentication (single local user), matching every existing endpoint in this project. This
extends `019-metrics-dashboard`'s `contracts/metrics-api.md` — only the deltas to
`GET /api/metrics/corpora/{corpusId}/pipelines` and `GET /api/metrics/corpora/{corpusId}/compare`
are documented here; both endpoints' request shape, status codes, and all other response fields
are unchanged.

---

## `GET /api/metrics/corpora/{corpusId}/pipelines`

**Change**: each entry in `pipelines[]` gains three fields.

**Response**: `200 OK`, `application/json`:

```json
{
  "corpusId": "c0a1...",
  "pipelines": [
    {
      "chunkingStrategy": "fixed-size",
      "embeddingModel": "bert",
      "retrievalStrategy": "cosine-similarity",
      "chunkCount": 214,
      "questionCount": 12,
      "answerCount": 11,
      "scopeBreakdown": { "corpus": 4, "document": 8 },
      "generationLlm": "claude-sonnet-5",
      "judgeLlm": "claude-sonnet-5",
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

- `retrievalStrategy`: always present, even for a pipeline with zero questions asked — reflects
  the currently registered retrieval strategy, not a value derived from question history
  (research.md §2).
- `generationLlm`: the `llmModel` of the pipeline's most recently *answered* question; `null` when
  no question has been successfully answered yet (spec FR-006).
- `judgeLlm`: the model that produced the pipeline's most recently *scored* question's quality
  scores; `null` when no question has been scored yet (spec FR-006). Independent of `scores` being
  present — in practice `judgeLlm` is `null` exactly when `scores` is `null`, since a score row is
  what carries `judgeLlm` in the first place.
- All other fields (`chunkingStrategy`, `embeddingModel`, `chunkCount`, `questionCount`,
  `answerCount`, `scopeBreakdown`, `scores`) are unchanged from `019-metrics-dashboard`'s contract.

---

## `GET /api/metrics/corpora/{corpusId}/compare`

**Change**: identical field additions as `.../pipelines` above — same `PipelineSummary` shape,
same 400/404 behavior, unchanged from the 019 contract.
