# Contract: Chunking Structured Preview API (new endpoint)

No authentication (single local user), matching every existing endpoint in this project. Additive
to `005-fixed-size-chunking`'s / `012-save-chunks-button`'s chunking contracts — nothing existing
changes shape.

---

## `GET /api/chunking/structured-preview`

Returns the document's structure-preserving extracted text plus a segment map describing which
character ranges belong to which saved chunk (or to an overlap between chunks), for Chunked
Preview v2's continuous, background-only-highlighted rendering
(022-chunk-preview-ui-fixes research.md §1–§2, data-model.md).

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `documentId` | string | yes | A `Document` row's id. |

**Response**: `200 OK`, `application/json`:

```json
{
  "fullText": "Introduction\n\nThis is the first paragraph of the document...",
  "segments": [
    { "start": 0, "end": 142, "kind": "chunk", "chunkIndex": 0 },
    { "start": 142, "end": 168, "kind": "overlap", "chunkIndex": null },
    { "start": 168, "end": 310, "kind": "chunk", "chunkIndex": 1 }
  ]
}
```

- `fullText` is re-extracted from the document's stored PDF (same extraction used by chunking
  itself) with original newlines/paragraph breaks intact — it is **not** the same string as any
  saved `Chunk.content` (which has already lost that structure).
- `segments` covers only the portion of `fullText` spanned by currently saved chunks (words
  beyond the last saved chunk's range, if any — e.g. due to the existing 200-chunk cap — are not
  included). It is ordered by `start`, contiguous, and non-overlapping; a chunk-to-chunk overlap
  (from a non-zero `overlap` setting) is represented as its own `"overlap"`-kind segment rather
  than being attributed to either contributing chunk.
- `404 Not Found` — `{ "detail": "No document found with id '...'" }` — unknown `documentId`.
- `404 Not Found` — `{ "detail": "No saved chunks for document '...'" }` — known document with
  zero currently saved chunks (frontend shows the existing "no chunks yet" message, FR-010).
- `404 Not Found` — `{ "detail": "Stored file is missing or unreadable for document '...'" }` —
  known document whose PDF no longer resolves on disk (mirrors `GET /api/sources/{id}/file`'s
  equivalent case).

---

## Unchanged

`GET /api/chunking/saved-chunks`, `GET /api/chunking/run/stream`, `GET /api/chunking/save/stream`
are untouched by this feature.
