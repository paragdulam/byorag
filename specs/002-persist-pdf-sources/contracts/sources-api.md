# Contract: Sources API

Base path: `/api/sources`. No authentication (single local user).
All responses are `application/json` unless noted.

---

## `GET /api/sources`

Returns every document currently present in `PDFS_DIR`, sorted by
`uploadedAt` ascending.

**Response `200 OK`**:

```json
{
  "documents": [
    {
      "id": "report.pdf",
      "name": "report.pdf",
      "sizeBytes": 2516582,
      "uploadedAt": "2026-07-04T15:32:10Z",
      "status": "processed"
    }
  ]
}
```

- `documents` is `[]` (not omitted) when `PDFS_DIR` is empty or does not
  yet exist.
- This endpoint never writes to disk; it only creates `PDFS_DIR` on first
  read if the directory-creation step (FR-002) has not yet run (idempotent,
  safe to call before any upload).

---

## `POST /api/sources`

Uploads one or more files. Request is `multipart/form-data` with one or
more parts under the field name `files`.

**Request**: `multipart/form-data; boundary=...`
```
--boundary
Content-Disposition: form-data; name="files"; filename="report.pdf"
Content-Type: application/pdf

<bytes>
--boundary
Content-Disposition: form-data; name="files"; filename="notes.txt"
Content-Type: text/plain

<bytes>
--boundary--
```

**Response `200 OK`** (always — per-file outcomes are expressed in the
body, not the HTTP status; see `research.md` §5):

```json
{
  "documents": [
    {
      "id": "report.pdf",
      "name": "report.pdf",
      "sizeBytes": 2516582,
      "uploadedAt": "2026-07-04T15:32:10Z",
      "status": "processed"
    }
  ],
  "rejections": [
    {
      "fileName": "notes.txt",
      "reason": "invalid-type"
    }
  ]
}
```

**Field semantics**:
- `documents`: one entry per file that was validated and successfully
  written to `PDFS_DIR`. `name`/`id` reflect the actual on-disk filename,
  which may differ from the submitted filename if a collision was resolved
  (e.g., client sent `report.pdf`, server saved `report (1).pdf` because
  `report.pdf` already existed — research.md §3).
- `rejections`: one entry per file that did **not** end up on disk, with
  `reason`:
  - `"invalid-type"` — file is not a PDF.
  - `"too-large"` — file exceeds 50MB.
  - `"save-failed"` — file passed validation but the filesystem write
    failed (e.g., disk full, permission error — FR-009). No partial file
    is left behind in this case.
- An empty `files` field (no files submitted) returns
  `{"documents": [], "rejections": []}`.

**Error responses**:
- `400 Bad Request` — malformed multipart body (e.g., missing `files`
  field entirely). Body: `{"detail": "<message>"}`. This is a transport-
  level failure distinct from per-file validation, which always returns
  `200` with a `rejections` entry instead.
