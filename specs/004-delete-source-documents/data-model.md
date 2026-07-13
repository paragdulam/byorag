# Phase 1 Data Model: Delete Source Documents

No database is introduced. Deletion acts directly on the filesystem (`PDFS_DIR`, from
`002-persist-pdf-sources`) and reports a transient, per-request outcome — nothing new is
persisted.

## SourceDocument (existing entity, extended lifecycle)

No field changes to `SourceDocument` (`002-persist-pdf-sources/data-model.md`). This feature adds
a new terminal transition to its lifecycle:

| State | Meaning |
|---|---|
| exists | As today — a file is present in `PDFS_DIR`, returned by `GET /api/sources`. |
| deleted | New in this feature. The file no longer exists in `PDFS_DIR`, whether removed via this feature's delete action or externally. There is no "deleted" status value stored anywhere — a deleted document simply stops appearing in subsequent `GET /api/sources` responses, since document existence is still derived entirely from `PDFS_DIR`'s contents (same "no persisted metadata" model as 002). |

**Validation rules** (unchanged from 002): none apply to deletion itself beyond the id
path-safety check below — deletion has no size/type constraints, since it consumes an existing
document's id, not new file content.

## DeletionResult

Represents the outcome of attempting to delete one document, within a `POST /api/sources/delete`
request (which may target one or many ids at once — User Story 1 and User Story 2 share this same
shape).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Echoes the requested id (on-disk filename) exactly, so the frontend can match results back to the documents it asked to delete. |
| `status` | `"deleted"` \| `"failed"` | `"deleted"` covers both "file removed now" and "file was already absent" (FR-006 — both are success from the user's perspective). `"failed"` covers a genuine error: an OS-level failure (e.g., permission denied) or a rejected (path-unsafe) id (research.md §3). |
| `reason` | string \| null | Present only when `status` is `"failed"`; a short, user-displayable explanation (FR-005). `null` when `status` is `"deleted"`. |

**Validation rules**:
- `reason` MUST be non-null when `status` is `"failed"`, and MUST be null when `status` is
  `"deleted"` (enforced by construction in `delete_documents()`, not by a runtime schema
  constraint).
- One `DeletionResult` is returned per requested id, in the same order as the request's `ids` list
  — no id is silently dropped, satisfying FR-009 (each failure is reported individually).

**State transitions**: None — `DeletionResult` is a transient response value, not a persisted
entity. It exists only for the duration of one `POST /api/sources/delete` request/response cycle.

## API request/response shapes

See `contracts/delete-sources-api.md` for the full `POST /api/sources/delete` contract.

## Relationship to existing frontend types

`frontend/src/types/sourceDocument.ts` currently defines `SourceDocument` and `UploadRejection`
(from 001/002). This feature adds:
- `DeletionResult` (mirrors the backend shape above, camelCase — already camelCase in the backend
  schema so no field renaming is needed, matching the existing convention `sources/schemas.py`
  already uses).

No changes to `SourceDocument` or `UploadRejection` themselves.
