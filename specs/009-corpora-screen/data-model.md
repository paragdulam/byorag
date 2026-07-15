# Phase 1 Data Model: Dedicated Corpora Screen with App-Wide Scoping

No new tables or columns. `Corpus`, `Document`, `DocumentCorpus`, and `Chunk` (established in
`008-corpora-management`, `backend/app/db/models.py`) are unchanged. This feature adds exactly one
new **wire-level** (API response) shape, derived from existing tables via a read-only query.

## AllSourceDocument (new wire shape, no new table)

Represents one document in the system-wide listing used by the Corpora screen's "add existing
document" picker.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | string (UUID) | `documents.id` | Same identity as `SourceDocument.id` (`002`/`008`). |
| `name` | string | `documents.name` | |
| `sizeBytes` | integer | `documents.size_bytes` | |
| `uploadedAt` | string (ISO 8601 UTC) | `documents.uploaded_at` | |
| `status` | `"processing" \| "processed"` | `documents.status` | |
| `corpusIds` | string[] (UUIDs) | `document_corpora` rows for this document | Every corpus this document is currently associated with. Used client-side to exclude/gray-out documents already in the corpus being managed. |

**Query shape**: `Document` joined to `DocumentCorpus`, grouped by document, aggregating
`corpus_id` into `corpusIds`; ordered by `uploaded_at` ascending (consistent with the existing
corpus-scoped listing). No pagination, consistent with this project's established small/personal
scale assumption (`008-corpora-management` research.md §4).

## Relationship to existing frontend types

`frontend/src/types/sourceDocument.ts`'s `SourceDocument` (from `002`/`008`) is unchanged. A new
type is added alongside it:

```ts
export interface DocumentWithCorpora extends SourceDocument {
  corpusIds: string[]
}
```

No other entity changes. `Corpus` (`frontend/src/types/corpus.ts`) is reused as-is for the screen's
corpora list.
