# Contract: Sources API (corpus-scoped)

Base path: `/api/sources`. No authentication (single local user, Constitution III).

This revises `002-persist-pdf-sources`' `/api/sources` endpoints to be corpus-scoped and DB-backed
(replacing filesystem-only listing), and adds two new endpoints for many-to-many corpus
association (FR-006, FR-007). The upload/list/delete request-response *shapes* are unchanged except
where noted; `id` semantics change (see below).

---

## `GET /api/sources?corpusId={corpusId}`

Lists documents associated with the given corpus (FR-004). Replaces the unscoped `GET /api/sources`
from `002-persist-pdf-sources`.

**Query parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `corpusId` | string (UUID) | yes | Must match an existing corpus from `GET /api/corpora`. |

**Response**: `200 OK`, same shape as `002-persist-pdf-sources`:

```json
{
  "documents": [
    { "id": "d4e5...", "name": "handbook.pdf", "sizeBytes": 102400, "uploadedAt": "2026-07-14T09:00:00Z", "status": "processed" }
  ]
}
```

**Errors**:
- `400 Bad Request` — `corpusId` missing.
- `404 Not Found` — no corpus with the given `corpusId`.

**Breaking change from `002`**: `id` is now the server-generated `Document.id` (UUID), not the
on-disk filename — filenames are no longer guaranteed unique once dedup'd re-uploads exist
(`data-model.md` § Document).

---

## `POST /api/sources`

Uploads one or more files into a target corpus (FR-005). Same multipart shape as
`002-persist-pdf-sources`, plus a required `corpusId` field.

**Request**: `multipart/form-data`
- `files`: one or more file parts (unchanged).
- `corpusId`: string (UUID), the corpus to upload into.

**Response**: `200 OK`, same shape as `002`:

```json
{
  "documents": [ { "id": "d4e5...", "name": "handbook.pdf", "sizeBytes": 102400, "uploadedAt": "...", "status": "processed" } ],
  "rejections": []
}
```

**Dedup behavior** (Clarification, `research.md` §3): if an uploaded file's content hash matches an
existing `Document`, no new document or chunks are created — the existing document is linked to
`corpusId` (or left as-is if already linked) and returned in `documents` exactly as a fresh upload
would be, so the caller cannot distinguish a dedup'd link from a new upload from the response shape
alone.

**Errors/rejections**: unchanged validation reasons from `002`/`004`
(`invalid-type` / `too-large` / `save-failed`), plus:
- `400 Bad Request` — `corpusId` missing:
  ```json
  { "detail": "corpusId is required" }
  ```
- `404 Not Found` — `corpusId` does not match an existing corpus.

---

## `POST /api/sources/{documentId}/corpora`

Attaches an already-uploaded document to an additional corpus without re-uploading it (FR-006).

**Request body**:

```json
{ "corpusId": "9ac2..." }
```

**Response**: `204 No Content` on success (including if the document was already linked to that
corpus — idempotent, matches the `document_corpora` composite-PK no-op in `data-model.md`).

**Errors**:
- `404 Not Found` — no document with `documentId`, or no corpus with the given `corpusId`.

---

## `DELETE /api/sources/{documentId}/corpora/{corpusId}`

Removes a document from one corpus (unlink), independent of deleting the document itself (FR-007).
If this was the document's last remaining corpus association, the document and all of its chunks
are deleted in the same transaction (FR-008, `research.md` §6).

**Response**: `204 No Content` on success, in both the "unlinked, document survives" and "unlinked,
document + chunks deleted" cases — the caller cannot distinguish the two from the response alone
(the frontend can tell by re-listing the document's corpora if it needs to).

**Errors**:
- `404 Not Found` — no such document, no such corpus, or the document is not currently linked to
  that corpus.

---

## `POST /api/sources/delete` (unchanged from `004-delete-source-documents`)

Bulk-deletes documents outright by `id`, regardless of corpus membership — unchanged request/response
shape from `004`. Internally now also deletes the documents' `Chunk` rows and all of their
`document_corpora` links (cascade, `data-model.md` § Chunk/DocumentCorpus), not just the file.

**Field semantics carried over from `002`/`004`, unchanged**: `sizeBytes`, `uploadedAt`, `status`,
`DeletionResult.status` (`"deleted" | "failed"`), `UploadRejection.reason`.
