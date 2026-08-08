# Contract: Sources API changes (US1 — one-to-many corpus/document relationship)

## Removed endpoints

| Endpoint | Was used for | Removal reason |
|---|---|---|
| `POST /api/sources/{document_id}/corpora` | Attach an existing document to a second corpus | No longer valid — every document has exactly one, immutable owning corpus (FR-001). |
| `DELETE /api/sources/{document_id}/corpora/{corpus_id}` | Unlink a document from one of its corpora (leaving it attached to any others) | No longer valid for the same reason — there's no "one of several" to unlink from. |

Any client code calling either endpoint MUST be removed (Corpora screen's "attach an existing
document" control, `DocumentList.tsx`'s "add to another corpus"/"remove from corpus" controls —
FR-005).

## Reused, unchanged endpoint

| Endpoint | Behavior |
|---|---|
| `POST /api/sources/delete` (body: `{"ids": [documentId, ...]}`) | Already performs real deletion — file content, chunks, embeddings, and (via existing `ondelete="CASCADE"` FKs) dependent Playground turns and Golden Dataset entries. The Corpora screen's new per-document delete icon (FR-002–FR-004) calls this exact endpoint with a single-element `ids` array; no new backend route is added. |

## Unchanged endpoints

`GET /api/sources`, `POST /api/sources` (upload), `GET /api/sources/{document_id}/file`,
`GET /api/sources/all` — all unaffected. Upload now always targets exactly one corpus (the one
the request is scoped to); this was already true of every existing upload call site.
