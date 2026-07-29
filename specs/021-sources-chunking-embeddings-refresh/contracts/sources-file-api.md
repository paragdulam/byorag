# Contract: Source Document File API (new endpoint)

No authentication (single local user), matching every existing endpoint in this project. Additive
to `002-persist-pdf-sources`'s / `008-corpora-management`'s `contracts/sources-api.md` — nothing
existing changes shape.

---

## `GET /api/sources/{document_id}/file`

Streams the raw stored PDF bytes for a source document, so the Sources screen's right-side preview
pane (spec FR-008) can render it without the frontend needing separate download tooling.

**Path parameters**:

| Param | Type | Required | Notes |
|---|---|---|---|
| `document_id` | string | yes | A `Document` row's id (from `GET /api/sources` / `GET /api/sources/all`). |

**Response**: `200 OK`, `Content-Type: application/pdf`, streamed bytes read from
`Document.storage_path`.

- `404 Not Found` — `{ "detail": "No document found with id '...'" }` — unknown `document_id`.
- `404 Not Found` — `{ "detail": "Stored file is missing or unreadable for document '...'" }` —
  known document row whose `storage_path` no longer resolves to a readable file on disk (spec Edge
  Cases: "PDF file is missing or unreadable"). The frontend renders this as a "preview unavailable"
  state (FR-008, edge case) rather than a generic error.
- No query parameters, no pagination, no partial-content/range support required for this feature
  (the PDF viewer library loads the full file).

---

## Unchanged

`GET /api/sources`, `GET /api/sources/all`, `POST /api/sources`, `POST /api/sources/delete`, and the
corpus-attach/detach endpoints are untouched by this feature.
