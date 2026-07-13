# Data Model: Data Sources Screen

All entities below are **in-memory, browser-session-only** (per FR-009 /
constitution Principle III). Nothing here is persisted to a database or
filesystem by this feature.

## SourceDocument

Represents one uploaded PDF as shown in the document list.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Client-generated unique id (e.g. `crypto.randomUUID()`); used as React list key, not persisted anywhere else |
| `name` | `string` | Original file name (e.g. `Q3_Financial_Report.pdf`) |
| `sizeBytes` | `number` | Raw byte count from the `File` object; formatted for display via `formatFileSize` (e.g. `2.4 MB`) |
| `uploadedAt` | `Date` | Timestamp captured at the moment the file is accepted |
| `status` | `SourceDocumentStatus` | `"processing"` \| `"processed"` — see State Transitions below |

**Validation rules** (applied before a `SourceDocument` is created — see FR-004/FR-005/FR-006):
- `name` must end in `.pdf` (case-insensitive) and the file's MIME type, when available, must be `application/pdf`.
- `sizeBytes` must be `<= 50 * 1024 * 1024` (50MB).
- A file failing either rule produces an `UploadRejection` instead (see below) and no `SourceDocument` is created.

**State Transitions**:

```
(file accepted) → processing --(simulated delay, ~1.5s)--> processed
```

There is no transition back to `processing` and no `failed`/`error` status
for documents already in the list — rejections happen before a document
ever enters the list (see `UploadRejection`).

## UploadRejection

Represents a file the user attempted to upload that failed validation.
Not stored in the document list; used only to render a transient error
message (FR-004/FR-005).

| Field | Type | Notes |
|---|---|---|
| `fileName` | `string` | Name of the rejected file, for the error message |
| `reason` | `"invalid-type"` \| `"too-large"` | Drives the displayed message text |

## VectorStorageStat (placeholder)

Static display-only data for the "Vector Storage" widget (FR-011). Not
computed from any real store in this feature.

| Field | Type | Notes |
|---|---|---|
| `usedGb` | `number` | Static placeholder value matching the design (e.g. `42.8`) |
| `percentOfCapacity` | `number` | Static placeholder value matching the design (e.g. `68`) |

## Relationships

- `SourceDocument` list is the sole collection driving the Document List
  table and the CSV export (FR-007/FR-010).
- `UploadRejection` is ephemeral (cleared after display / on next action)
  and has no relationship to `SourceDocument`.
- `VectorStorageStat` is a standalone, single instance with no relationship
  to the other entities.
