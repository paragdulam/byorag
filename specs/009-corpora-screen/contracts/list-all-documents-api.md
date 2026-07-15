# Contract: List All Documents API

Base path: `/api/sources`. No authentication (single local user, Constitution III).

New in this feature — adds one endpoint alongside the existing corpus-scoped `/api/sources`
endpoints from `008-corpora-management`, which are unchanged.

---

## `GET /api/sources/all`

Lists every document in the system, regardless of which corpus (or corpora) it belongs to, each
annotated with its current corpus associations. Used by the Corpora screen (`009-corpora-screen`)
to offer a picker of existing documents that can be attached to the corpus currently being managed.

**Query parameters**: none.

**Response**: `200 OK`

```json
{
  "documents": [
    {
      "id": "d4e5...",
      "name": "handbook.pdf",
      "sizeBytes": 102400,
      "uploadedAt": "2026-07-14T09:00:00Z",
      "status": "processed",
      "corpusIds": ["9ac2...", "b3f1..."]
    }
  ]
}
```

An empty `documents` array is a valid response (no documents exist anywhere yet).

**Field semantics**: identical to `SourceDocument` (`contracts/sources-api.md`, `008-corpora-management`)
plus `corpusIds` — the full list of corpus ids this document is currently associated with (always
at least one, per the existing "a document must belong to at least one corpus to exist" invariant).

**Relationship to existing endpoints**: `GET /api/sources?corpusId=X` (corpus-scoped, unchanged)
remains the source of truth for "what's in this corpus" everywhere else (Sources screen, Chunking's
document picker). This endpoint is additive and used only by the Corpora screen's attach picker —
it does not replace or alter any existing endpoint's behavior.
