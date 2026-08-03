# Data Model: Golden Dataset Split-Screen PDF Reference View

No new entities, fields, or state transitions. This feature is a frontend layout and CSS
correctness change over data that already exists and is already fully modeled by
`specs/027-golden-dataset/data-model.md` (`GoldenDatasetEntry`, `GoldenDatasetEntryChunk`) and the
existing `SourceDocument`/PDF-file storage used by the Sources screen.

## Reused, unmodified

- **GoldenDatasetEntry** / **GoldenDatasetEntryChunk** — unchanged; the Golden Dataset screen's
  left half continues to read/write these exactly as it does today (`specs/027-golden-dataset/`).
- **SourceDocument** (PDF content stored in PostgreSQL) — unchanged; the right half's preview reads
  the same `GET /api/sources/{documentId}/file` the Sources screen already uses.

## New client-only UI state (not persisted)

- `GoldenDatasetScreen`'s `isFullscreen: boolean` — mirrors `DataSourcesScreen`'s existing local
  state of the same name and purpose; transient, resets on document-switch/unmount exactly as
  `DataSourcesScreen`'s does today. Not sent to the backend, not part of any entity.
