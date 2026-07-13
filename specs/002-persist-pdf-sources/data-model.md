# Phase 1 Data Model: Persist Uploaded PDFs to Filesystem

No database is introduced (see `research.md` §4). The entities below are
derived entirely from the filesystem at request time; this document
describes their shape as exchanged between backend and frontend, not
storage schema.

## SourceDocument

Represents a single PDF file present in the `PDFS_DIR` directory.

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | string | on-disk filename | Stable, unique within `PDFS_DIR`; doubles as `name`. |
| `name` | string | on-disk filename | Already collision-resolved (research.md §3); this is what the UI displays. |
| `sizeBytes` | integer | `os.stat().st_size` | Human-readable formatting stays a frontend concern (existing `formatFileSize.ts`, unchanged). |
| `uploadedAt` | string (ISO 8601 UTC datetime) | `os.stat().st_mtime` | Set once at creation; files are never modified after upload. |
| `status` | `"processing" \| "processed"` | Always `"processed"` from the API (research.md §4) | Frontend may show a transient local `"processing"` state while an upload request is in flight. |

**Validation rules** (enforced server-side before a file is accepted):
- File name must end in `.pdf` (case-insensitive) or declare
  `content-type: application/pdf`, matching existing `ACCEPTED_UPLOAD_TYPES`.
- File size must be ≤ 50MB (`MAX_UPLOAD_SIZE_BYTES`, existing constant,
  now also enforced server-side).

**State transitions**: None persisted. A document exists (appears in every
`GET /api/sources` response) from the moment its file is fully written to
`PDFS_DIR` until the file is removed from that directory (by any means,
including outside the app — see spec Edge Cases). There is no "delete"
API in this feature.

## UploadRejection

Represents a single file from an upload request that failed validation and
was never written to disk.

| Field | Type | Notes |
|---|---|---|
| `fileName` | string | The name as submitted by the client (not collision-resolved, since it was never saved). |
| `reason` | `"invalid-type" \| "too-large" \| "save-failed"` | `"save-failed"` is new in this feature: validation passed but the write to disk failed (e.g., disk full/permissions — FR-009); `"invalid-type"`/`"too-large"` are carried over from 001. |

Transient — exists only in a single `POST /api/sources` response; never
persisted.

## Relationship to existing frontend types

`frontend/src/types/sourceDocument.ts` already defines `SourceDocument` and
`UploadRejection` shapes from 001. This feature:
- Changes `SourceDocument.id` from a client-generated `crypto.randomUUID()`
  to the server-provided on-disk filename.
- Changes `SourceDocument.uploadedAt` from a client-side `new Date()` to a
  value parsed from the server's ISO datetime string.
- Adds `"save-failed"` to `UploadRejectionReason`.

No other frontend-facing entity changes; `VectorStorageStat` is unaffected
(remains a static placeholder per 001).
