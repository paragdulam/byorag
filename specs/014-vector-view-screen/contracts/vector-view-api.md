# Contract: Vector View API (two additions to the existing Embeddings API)

No authentication (single local user), matching every existing endpoint in this project. Both
endpoints below are additive to `013-bert-pgvector-embeddings`'s `contracts/embeddings-api.md` —
nothing existing changes shape.

---

## `GET /api/embeddings/saved`

Reads a chunk's currently saved embeddings, exactly as persisted — no recomputation (spec FR-005,
SC-002).

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `chunkId` | string | yes | A `Chunk` row's id (from `GET /api/chunking/saved-chunks`). |

**Response**: `200 OK`, `application/json`:

```json
{
  "embeddings": [
    {
      "id": "b6b8...",
      "model": "bert",
      "createdAt": "2026-07-15T10:03:12Z",
      "dims": 768,
      "vector": [0.0123, -0.0456, "... 766 more values"]
    }
  ]
}
```

- `embeddings` is ordered newest-first (`createdAt` descending — data-model.md, research.md §3).
- `embeddings` is `[]` (not an error) when the chunk has no saved embeddings yet — a normal,
  expected state (spec FR-008).
- `404 Not Found` — `{ "detail": "No chunk found with id '...'" }` — only for a genuinely unknown
  `chunkId`, distinct from "known chunk, zero saved embeddings."

---

## `GET /api/embeddings/projection-methods`

Lists the registered display/projection methods for the dropdown above the vector display (spec
FR-009–FR-011) — server-driven, mirroring `GET /api/embeddings/models`.

**Response**: `200 OK`:

```json
{
  "methods": [
    { "id": "vector", "label": "Vector", "available": true },
    { "id": "umap", "label": "UMAP", "available": false },
    { "id": "pca", "label": "PCA", "available": false }
  ]
}
```

- The first entry (`"vector"`) is always `available: true` and is the default selection.
- `available: false` entries are included so the frontend can render them as visible-but-disabled
  placeholders (FR-011); selecting one is a frontend-only concern (shows a "not available yet"
  message) — it does not require a distinct backend error response, since no computation is
  attempted for an unavailable method.
- No query parameters, no failure modes beyond the generic server-error case.

---

## Unchanged

`GET /api/embeddings/models`, `GET /api/embeddings/generate/stream`, `GET
/api/embeddings/save/stream`, and `GET /api/chunking/saved-chunks` (`013`) are untouched by this
feature.
