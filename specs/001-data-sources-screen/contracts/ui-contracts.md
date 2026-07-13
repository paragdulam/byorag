# UI Contracts: Data Sources Screen

This feature exposes no network API — per FR-009, there are no backend calls.
The "contract" surface here is the set of component props/callback shapes
that let the pieces of the screen be built and tested independently. These
are internal TypeScript interfaces, not a wire protocol.

## `useSourceDocuments()` hook contract

```ts
type SourceDocumentStatus = "processing" | "processed";

interface SourceDocument {
  id: string;
  name: string;
  sizeBytes: number;
  uploadedAt: Date;
  status: SourceDocumentStatus;
}

interface UploadRejection {
  fileName: string;
  reason: "invalid-type" | "too-large";
}

interface UseSourceDocuments {
  documents: SourceDocument[];
  rejections: UploadRejection[];
  addFiles: (files: File[]) => void;   // validates, accepts valid PDFs, records rejections for invalid ones
  clearRejections: () => void;
}
```

**Behavioral contract**:
- `addFiles` MUST synchronously validate every file in the batch (FR-004/FR-005) before adding any to `documents`.
- Valid files MUST be appended to `documents` with `status: "processing"`, then transition to `"processed"` after the simulated delay (data-model.md).
- Invalid files MUST be appended to `rejections` and MUST NOT appear in `documents` (US2, FR-004/FR-005).
- `documents` and `rejections` MUST NOT be written to any storage outside React state (FR-009).

## `UploadDropzone` component contract

```ts
interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void; // called for both drag-drop and browse paths
  maxSizeBytes: number;   // 50 * 1024 * 1024, surfaced in the "Max size: 50MB" chip (FR-006)
  acceptedTypes: string[]; // [".pdf", "application/pdf"], surfaced in the "PDF only" chip (FR-006)
}
```

**Behavioral contract**: Must call `onFilesSelected` with the same shape
regardless of whether files arrived via drag-and-drop or the browse dialog
(FR-001/FR-002), including when multiple files are dropped/selected at once
(FR-003).

## `DocumentList` component contract

```ts
interface DocumentListProps {
  documents: SourceDocument[];
  onExportCsv: () => void; // FR-010
}
```

**Behavioral contract**: Renders one row per document (name, formatted size,
formatted upload date/time, status chip) in the order provided; `onExportCsv`
MUST reflect exactly the `documents` currently passed in, including when
the list is empty (US3 acceptance scenario 2 — header-only CSV).

## `exportCsv(documents: SourceDocument[]): void` contract

- MUST produce one CSV row per element of `documents`, columns in order:
  `name, size, uploadDate, status`.
- MUST produce a header-only CSV when `documents` is empty.
- MUST trigger a client-side file download; MUST NOT make a network request.

## `fileValidation` contract

```ts
function validateFile(
  file: File,
  maxSizeBytes: number,
  acceptedTypes: string[]
): { valid: true } | { valid: false; reason: "invalid-type" | "too-large" };
```

- Pure function, no side effects — enables the unit tests listed in
  `plan.md`'s `tests/unit/fileValidation.test.ts`.
