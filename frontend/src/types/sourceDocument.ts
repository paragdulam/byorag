export type SourceDocumentStatus = 'processing' | 'processed'

// id is the server-generated Document UUID (008-corpora-management) — name
// may still be collision-suffixed on the filesystem (e.g. "report (1).pdf").
// uploadedAt is parsed from the API's ISO 8601 string into a Date by
// sourcesApi.ts.
export interface SourceDocument {
  id: string
  name: string
  sizeBytes: number
  uploadedAt: Date
  status: SourceDocumentStatus
}

// A document annotated with every corpus it's currently associated with —
// used by the Corpora screen's "add existing document" picker to exclude
// documents already in the corpus being managed (009-corpora-screen,
// data-model.md).
export interface DocumentWithCorpora extends SourceDocument {
  corpusIds: string[]
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
