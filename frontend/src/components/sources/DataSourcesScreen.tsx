import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
// SystemCapacityWidget is temporarily not rendered on this screen (kept in the codebase for
// future re-introduction) — see project notes.
import { UploadDropzone } from './UploadDropzone'
import { DocumentList } from './DocumentList'
import { SourceDocumentPreview } from './SourceDocumentPreview'
import { useSourceDocuments } from '../../hooks/useSourceDocuments'
import { MAX_UPLOAD_SIZE_BYTES, ACCEPTED_UPLOAD_TYPES } from '../../lib/uploadConstraints'
import { exportCsv } from '../../lib/exportCsv'
import { useCorpus } from '../../context/CorpusContext'

function formatDeletionErrorMessage(result: { id: string; reason: string | null }): string {
  return `${result.id}: ${result.reason ?? 'Could not be deleted'}`
}

export interface DataSourcesScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function DataSourcesScreen({ onNavigate }: DataSourcesScreenProps) {
  const { activeCorpusId, corpora, isLoading: isCorporaLoading } = useCorpus()
  const {
    documents,
    rejections,
    deletionErrors,
    isLoading,
    addFiles,
    deleteDocuments,
    attachToCorpus,
    removeFromCorpus,
  } = useSourceDocuments(activeCorpusId)
  const otherCorpora = corpora.filter((corpus) => corpus.id !== activeCorpusId)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

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
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Data Sources</h1>
          <p className="mt-2 text-on-surface-variant">Manage ingestion pipelines.</p>
        </div>

        <div className="mt-6 flex min-h-0 min-w-0 flex-1 gap-6">
          {!isFullscreen && (
            <div
              data-testid="sources-left-pane"
              className="flex min-h-0 min-w-0 w-1/2 flex-col overflow-y-auto pr-2"
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
              ) : (
                <UploadDropzone
                  onFilesSelected={addFiles}
                  maxSizeBytes={MAX_UPLOAD_SIZE_BYTES}
                  acceptedTypes={ACCEPTED_UPLOAD_TYPES}
                  rejections={rejections}
                />
              )}

              {isLoading ? (
                <p className="mt-8 text-on-surface-variant" role="status">
                  Loading documents…
                </p>
              ) : (
                <DocumentList
                  documents={documents}
                  onExportCsv={() => exportCsv(documents)}
                  onDeleteDocuments={deleteDocuments}
                  otherCorpora={otherCorpora}
                  onAttachToCorpus={attachToCorpus}
                  onRemoveFromCorpus={removeFromCorpus}
                  selectedDocumentId={selectedDocumentId}
                  onSelectDocument={setSelectedDocumentId}
                />
              )}

              {deletionErrors.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1" aria-label="Deletion errors">
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
