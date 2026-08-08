import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
// SystemCapacityWidget is temporarily not rendered on this screen (kept in the codebase for
// future re-introduction) — see project notes.
import { DocumentList } from './DocumentList'
import { SourceDocumentPreview } from './SourceDocumentPreview'
import { useSourceDocuments } from '../../hooks/useSourceDocuments'
import { ACCEPTED_UPLOAD_TYPES } from '../../lib/uploadConstraints'
import { exportCsv } from '../../lib/exportCsv'
import { useCorpus } from '../../context/CorpusContext'
import type { UploadRejection } from '../../types/sourceDocument'

function formatDeletionErrorMessage(result: { id: string; reason: string | null }): string {
  return `${result.id}: ${result.reason ?? 'Could not be deleted'}`
}

function formatRejectionMessage(rejection: UploadRejection): string {
  const reasonText =
    rejection.reason === 'invalid-type'
      ? 'is not a PDF file'
      : rejection.reason === 'too-large'
        ? 'exceeds the 50MB limit'
        : 'could not be saved (a server error occurred)'
  return `${rejection.fileName} ${reasonText}`
}

export interface DataSourcesScreenProps {
  onNavigate: (screen: ScreenId) => void
  /** A document to preview directly, per a deep link (034-more-deep-links). */
  linkedDocumentId?: string | null
  /** Called whenever the previewed document changes (deep link open, or a plain in-app click),
   * so the caller can keep the URL in sync. */
  onDocumentSelected?: (documentId: string) => void
}

export function DataSourcesScreen({
  onNavigate,
  linkedDocumentId,
  onDocumentSelected,
}: DataSourcesScreenProps) {
  const { activeCorpusId, isLoading: isCorporaLoading } = useCorpus()
  const {
    documents,
    rejections,
    deletionErrors,
    isLoading,
    addFiles,
    deleteDocuments,
  } = useSourceDocuments(activeCorpusId)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  function handleUploadInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      addFiles(files)
    }
    event.target.value = ''
  }

  // Deep link (034-more-deep-links): opens straight to the linked document once it's loaded.
  useEffect(() => {
    if (linkedDocumentId != null && documents.some((doc) => doc.id === linkedDocumentId)) {
      setSelectedDocumentId(linkedDocumentId)
    }
  }, [linkedDocumentId, documents])

  function selectDocument(documentId: string) {
    setSelectedDocumentId(documentId)
    onDocumentSelected?.(documentId)
  }

  // If the currently previewed document is deleted (or the corpus switches out from under it),
  // clear the selection rather than leaving the right pane pointed at a document that no longer
  // appears in the list (021-sources-chunking-embeddings-refresh Edge Cases).
  useEffect(() => {
    if (selectedDocumentId !== null && !documents.some((doc) => doc.id === selectedDocumentId)) {
      setSelectedDocumentId(null)
    }
  }, [documents, selectedDocumentId])

  // Fullscreen is a transient reading mode, not per-document state — switching documents always
  // drops back to the normal split (023-pdf-fullscreen-chunk-view FR-004, Clarification 3).
  // Navigating away from and back to this screen resets it for free: the parent swaps screens via
  // a ternary over React elements (App.tsx), so this component fully unmounts/remounts.
  useEffect(() => {
    setIsFullscreen(false)
  }, [selectedDocumentId])

  return (
    <AppShell activeScreen="sources" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-on-surface">Data Sources</h1>
            <p className="mt-2 text-on-surface-variant">Manage ingestion pipelines.</p>
          </div>
          <div>
            <input
              ref={uploadInputRef}
              data-testid="upload-browse-input"
              type="file"
              multiple
              accept={ACCEPTED_UPLOAD_TYPES.join(',')}
              className="hidden"
              onChange={handleUploadInputChange}
            />
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={activeCorpusId === null}
              className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              Upload
            </button>
          </div>
        </div>

        <div className="mt-6 flex min-h-0 min-w-0 flex-1 gap-6">
          {!isFullscreen && (
            <div
              data-testid="sources-left-pane"
              className="flex min-h-0 min-w-0 w-1/2 flex-col gap-3 overflow-y-auto pr-2"
            >
              {isCorporaLoading ? (
                <p className="text-on-surface-variant" role="status">
                  Loading corpora…
                </p>
              ) : activeCorpusId === null ? (
                <p className="text-on-surface-variant" role="status">
                  Create a corpus (see the Corpora section in the left nav) before uploading
                  documents.
                </p>
              ) : null}

              {rejections.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Upload errors">
                  {rejections.map((rejection, index) => (
                    <li
                      key={`${rejection.fileName}-${index}`}
                      role="alert"
                      className="rounded border border-error/40 bg-error-container/10 px-4 py-2 text-sm text-error"
                    >
                      {formatRejectionMessage(rejection)}
                    </li>
                  ))}
                </ul>
              )}

              {isLoading ? (
                <p className="text-on-surface-variant" role="status">
                  Loading documents…
                </p>
              ) : (
                <DocumentList
                  documents={documents}
                  onExportCsv={() => exportCsv(documents)}
                  onDeleteDocuments={deleteDocuments}
                  selectedDocumentId={selectedDocumentId}
                  onSelectDocument={selectDocument}
                />
              )}

              {deletionErrors.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Deletion errors">
                  {deletionErrors.map((result, index) => (
                    <li
                      key={`${result.id}-${index}`}
                      role="alert"
                      className="rounded border border-error/40 bg-error-container/10 px-4 py-2 text-sm text-error"
                    >
                      {formatDeletionErrorMessage(result)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div
            data-testid="sources-right-pane"
            className={
              'flex min-h-0 min-w-0 flex-col rounded-lg border border-outline-variant bg-surface-container ' +
              (isFullscreen ? 'w-full' : 'w-1/2')
            }
          >
            <SourceDocumentPreview
              documentId={selectedDocumentId}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((current) => !current)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
