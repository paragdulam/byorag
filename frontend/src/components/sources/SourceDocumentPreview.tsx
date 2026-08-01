import { useEffect, useState, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { sourceFileRequest } from '../../lib/sourcesApi'
import { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, clampScale, zoomIn, zoomOut } from '../../lib/pdfZoom'

interface DragState {
  pointerId: number
  startX: number
  startY: number
  startScrollLeft: number
  startScrollTop: number
}

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
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)

  useEffect(() => {
    setNumPages(0)
    setLoadError(false)
    setScale(DEFAULT_SCALE)
  }, [documentId])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const container = scrollAreaRef.current
    if (scale <= MIN_SCALE || !container) return
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: container.scrollLeft,
      startScrollTop: container.scrollTop,
    }
    container.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current
    const container = scrollAreaRef.current
    if (!drag || !container || drag.pointerId !== event.pointerId) return
    container.scrollLeft = drag.startScrollLeft - (event.clientX - drag.startX)
    container.scrollTop = drag.startScrollTop - (event.clientY - drag.startY)
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    scrollAreaRef.current?.releasePointerCapture?.(event.pointerId)
    dragStateRef.current = null
  }

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

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '20px'
  };

  const pageContentStyle: CSSProperties = {
    ...containerStyle,
    // FR-012: while zoomed in, dragging pans instead of selecting text — disabling pointer events
    // on the page content lets pointerdown/move/up bubble to the scroll-area's drag-to-pan
    // handlers instead of starting a native text selection. At the default zoom, pointer events
    // stay enabled and text selection behaves as it always has.
    pointerEvents: scale > MIN_SCALE ? 'none' : undefined,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={scrollAreaRef}
        data-testid="source-preview-scroll-area"
        className="min-h-0 flex-1 overflow-auto"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {loadError ? (
          <div
            data-testid="source-preview-unavailable"
            className="flex h-full items-center justify-center p-8 text-center text-on-surface-variant"
          >
            Preview unavailable for this document.
          </div>
        ) : (
          <div className="p-4" data-testid="source-preview-page-content" style={pageContentStyle}>
            <Document
              file={sourceFileRequest(documentId)}
              onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
              onLoadError={() => setLoadError(true)}
              loading={<p className="text-on-surface-variant">Loading preview…</p>}
            >
              {Array.from({ length: numPages }, (_, index) => (
                <Page key={index} pageNumber={index + 1} scale={scale} className="mb-4" />
              ))}
            </Document>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-outline-variant p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="source-preview-zoom-in"
            onClick={() => setScale((current) => clampScale(zoomIn(current)))}
            disabled={scale >= MAX_SCALE}
            className="rounded border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            +
          </button>
          <button
            type="button"
            data-testid="source-preview-zoom-out"
            onClick={() => setScale((current) => clampScale(zoomOut(current)))}
            disabled={scale <= MIN_SCALE}
            className="rounded border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            −
          </button>
          <span data-testid="source-preview-zoom-level" className="min-w-12 text-center text-sm text-on-surface-variant">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            data-testid="source-preview-zoom-reset"
            onClick={() => setScale(DEFAULT_SCALE)}
            className="rounded border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-container-high"
          >
            Reset
          </button>
        </div>
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
