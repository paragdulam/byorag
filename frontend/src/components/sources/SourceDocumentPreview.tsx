import { useEffect, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { sourceFileUrl } from '../../lib/sourcesApi'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface SourceDocumentPreviewProps {
  documentId: string | null
  isFullscreen: boolean
  onToggleFullscreen: () => void
}

/**
 * Right-side preview pane for the Sources screen. Renders the selected document's stored PDF
 * (via `react-pdf`/`pdfjs`, which fetches `GET /api/sources/{documentId}/file` itself given the
 * URL — contracts/sources-file-api.md), continuously scrollable through every page in both the
 * normal and fullscreen layout states (023-pdf-fullscreen-chunk-view FR-002, FR-003, FR-005;
 * fullscreen/normal width itself is controlled by the parent `DataSourcesScreen` — this component
 * only renders the toggle button and reports clicks up via `onToggleFullscreen`). No longer offers
 * a "Chunked Preview" toggle (022's whole-document chunk-annotated view) — that capability moved
 * to the Fixed Size Chunking screen's in-context preview (023 FR-001).
 */
export function SourceDocumentPreview({
  documentId,
  isFullscreen,
  onToggleFullscreen,
}: SourceDocumentPreviewProps) {
  const [numPages, setNumPages] = useState(0)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setNumPages(0)
    setLoadError(false)
  }, [documentId])

  if (documentId === null) {
    return (
      <div
        data-testid="source-preview-empty"
        className="flex h-full min-h-0 flex-1 items-center justify-center p-8 text-center text-on-surface-variant"
      >
        Select a document to preview it here.
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loadError ? (
          <div
            data-testid="source-preview-unavailable"
            className="flex h-full items-center justify-center p-8 text-center text-on-surface-variant"
          >
            Preview unavailable for this document.
          </div>
        ) : (
          <div className="p-4">
            <Document
              file={sourceFileUrl(documentId)}
              onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
              onLoadError={() => setLoadError(true)}
              loading={<p className="text-on-surface-variant">Loading preview…</p>}
            >
              {Array.from({ length: numPages }, (_, index) => (
                <Page key={index} pageNumber={index + 1} className="mb-4" />
              ))}
            </Document>
          </div>
        )}
      </div>

      <div className="flex shrink-0 justify-end border-t border-outline-variant p-3">
        <button
          type="button"
          data-testid="source-preview-fullscreen-toggle"
          onClick={onToggleFullscreen}
          className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high"
        >
          {isFullscreen ? 'Restore' : 'Fullscreen'}
        </button>
      </div>
    </div>
  )
}
