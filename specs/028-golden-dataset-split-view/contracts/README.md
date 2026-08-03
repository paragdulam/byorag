# Contracts: Golden Dataset Split-Screen PDF Reference View

No new or changed API contracts. This feature is frontend-only (layout restructuring + a CSS
correctness fix); it reuses existing endpoints exactly as-is:

- `GET /api/sources/{documentId}/file` — PDF bytes for the right-half preview (already used by
  `SourceDocumentPreview` on the Sources screen; contract unchanged).
- `GET /api/golden-dataset/...` (list/candidates/generate/entries) — already used by the left
  half's existing controls (`specs/027-golden-dataset/contracts/`); contract unchanged.

No backend files are touched by this feature.
