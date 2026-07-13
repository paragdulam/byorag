export type SourceDocumentStatus = 'processing' | 'processed'

// id/name are the on-disk filename returned by the backend (may be
// collision-suffixed, e.g. "report (1).pdf") and uploadedAt is parsed from
// the API's ISO 8601 string into a Date by sourcesApi.ts — see
// specs/002-persist-pdf-sources/data-model.md.
export interface SourceDocument {
  id: string
  name: string
  sizeBytes: number
  uploadedAt: Date
  status: SourceDocumentStatus
}

export type UploadRejectionReason = 'invalid-type' | 'too-large' | 'save-failed'

export interface UploadRejection {
  fileName: string
  reason: UploadRejectionReason
}

export type DeletionStatus = 'deleted' | 'failed'

export interface DeletionResult {
  id: string
  status: DeletionStatus
  reason: string | null
}
