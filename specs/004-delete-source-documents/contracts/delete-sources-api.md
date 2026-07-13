# Contract: Delete Sources API

Base path: `/api/sources`. No authentication (single local user). Extends the existing
`002-persist-pdf-sources/contracts/sources-api.md` contract with one new endpoint.

---

## `POST /api/sources/delete`

Deletes one or more documents by id. Serves both single-document delete (User Story 1) and
multi-document bulk delete (User Story 2) — the frontend's single-row delete sends a one-element
`ids` array.

**Request**: `application/json`
```json
{
  "ids": ["report.pdf", "notes (1).pdf"]
}
```

**Response `200 OK`** (always — per-id outcomes are expressed in the body, not the HTTP status,
matching the existing `POST /api/sources` upload contract's convention):

```json
{
  "results": [
    { "id": "report.pdf", "status": "deleted", "reason": null },
    { "id": "notes (1).pdf", "status": "deleted", "reason": null }
  ]
}
```

**Response `200 OK` — partial failure**:

```json
{
  "results": [
    { "id": "report.pdf", "status": "deleted", "reason": null },
    { "id": "locked.pdf", "status": "failed", "reason": "Permission denied" }
  ]
}
```

**Response `200 OK` — target already absent (treated as success, FR-006)**:

```json
{
  "results": [
    { "id": "already-gone.pdf", "status": "deleted", "reason": null }
  ]
}
```

**Response `200 OK` — path-unsafe id rejected without touching the filesystem (research.md §3)**:

```json
{
  "results": [
    { "id": "../../etc/passwd", "status": "failed", "reason": "invalid id" }
  ]
}
```

**Field semantics**:
- `ids`: one or more document ids (on-disk filenames, exactly as returned by `GET /api/sources` /
  `POST /api/sources`). An empty `ids` array returns `{"results": []}`.
- `results`: exactly one entry per requested id, in the same order as the request, so the frontend
  can zip them back to the documents it asked to delete without an id lookup.
  - `status: "deleted"` — the file was removed, **or** it was already absent from disk (both are
    success from the user's perspective; FR-006). The frontend removes this id from the document
    list in either case.
  - `status: "failed"` — the file exists but could not be removed (`reason` explains why, e.g.
    `"Permission denied"`), or the id itself was rejected as path-unsafe before any filesystem
    access was attempted (`reason: "invalid id"`). The frontend leaves this document in the list
    and surfaces `reason` to the user (FR-005).
- Requesting the same id twice in one call is idempotent — after the first entry deletes it, the
  second is reported as `status: "deleted"` too (already-absent case), never as a duplicate error.

**Error responses**:
- `400 Bad Request` — malformed JSON body (e.g., missing `ids` field entirely, or `ids` is not an
  array of strings). Body: `{"detail": "<message>"}`. This is a transport-level failure distinct
  from per-id outcomes, which always return `200` with a `results` entry instead.
