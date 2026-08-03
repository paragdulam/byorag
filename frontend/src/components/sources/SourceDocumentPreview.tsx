import { useEffect, useMemo, useState, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { sourceFileRequest } from '../../lib/sourcesApi'
import { DEFAULT_SCALE, MAX_SCALE, MIN_SCALE, clampScale, zoomIn, zoomOut } from '../../lib/pdfZoom'
import { mostVisiblePage } from '../../lib/pdfPageVisibility'

// Fine-grained thresholds so the observer callback fires as a page's visible share changes
// gradually while scrolling, not just at a single crossing point (029-pdf-preview-page-count).
const INTERSECTION_THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 10)

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
 * to the Fixed Size Chunking screen's in-context preview (023 FR-001). Also shows a "Page X of N"
 * indicator in the toolbar tracking whichever page is predominantly visible in the scroll area,
 * via an `IntersectionObserver` over each rendered page (029-pdf-preview-page-count) — shared by
 * every screen that mounts this component (Data Sources, Golden Dataset split view) with no
 * per-consumer wiring needed.
 */
export function SourceDocumentPreview({
  documentId,
  isFullscreen,
  onToggleFullscreen,
}: SourceDocumentPreviewProps) {
  const [numPages, setNumPages] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const [currentPage, setCurrentPage] = useState<number | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const pageWrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const pageRatiosRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    setNumPages(0)
    setLoadError(false)
    setScale(DEFAULT_SCALE)
    setCurrentPage(null)
    pageWrapperRefs.current.clear()
    pageRatiosRef.current.clear()
  }, [documentId])

  // A fresh ref callback per page number, memoized on numPages so it stays referentially
  // stable across re-renders that don't change the page count (e.g. zoom) — otherwise React
  // would detach/reattach every page's ref on every render.
  const pageRefCallbacks = useMemo(
    () =>
      Array.from({ length: numPages }, (_, index) => {
        const pageNumber = index + 1
        return (el: HTMLDivElement | null) => {
          if (el) {
            pageWrapperRefs.current.set(pageNumber, el)
          } else {
            pageWrapperRefs.current.delete(pageNumber)
          }
        }
      }),
    [numPages],
  )

  // Tracks which rendered page occupies the most of the scroll area's viewport, for the page
  // indicator (029-pdf-preview-page-count). Runs after the ref callbacks above have populated
  // pageWrapperRefs for the current page count, so every page is observed from the start.
  useEffect(() => {
    if (numPages === 0) return

    pageRatiosRef.current.clear()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pageNumber = Number((entry.target as HTMLElement).dataset.previewPage)
          pageRatiosRef.current.set(pageNumber, entry.intersectionRatio)
        }
        const visible = Array.from(pageRatiosRef.current.entries(), ([pageNumber, intersectionRatio]) => ({
          pageNumber,
          intersectionRatio,
        }))
        setCurrentPage(mostVisiblePage(visible))
      },
      { root: scrollAreaRef.current, threshold: INTERSECTION_THRESHOLDS },
    )

    pageWrapperRefs.current.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [numPages])

  // Before the observer has reported anything (e.g. immediately after load, unscrolled), the
  // indicator defaults to page 1 rather than staying blank — matches what the user is actually
  // looking at, without waiting on IntersectionObserver's own timing.
  const displayedPage = currentPage ?? (numPages > 0 ? 1 : null)

  // sourceFileRequest returns a fresh object every call — memoized so <Document file={...}>
  // gets a referentially stable value across re-renders that don't actually change the
  // document, matching react-pdf's expectation (an unmemoized value makes it think the file
  // changed on every render and reload/reparse the PDF unnecessarily).
  const file = useMemo(
    () => (documentId === null ? null : sourceFileRequest(documentId)),
    [documentId],
  )

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
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <div
        ref={scrollAreaRef}
        data-testid="source-preview-scroll-area"
        className="min-h-0 min-w-0 flex-1 overflow-auto"
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
              file={file}
              onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
              onLoadError={() => setLoadError(true)}
              loading={<p className="text-on-surface-variant">Loading preview…</p>}
            >
              {Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1
                return (
                  <div
                    key={pageNumber}
                    ref={pageRefCallbacks[index]}
                    data-preview-page={pageNumber}
                    className="mb-4"
                  >
                    <Page pageNumber={pageNumber} scale={scale} />
                  </div>
                )
              })}
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
          {!loadError && displayedPage !== null && (
            <span
              data-testid="source-preview-page-indicator"
              className="ml-2 min-w-max text-sm text-on-surface-variant"
            >
              Page {displayedPage} of {numPages}
            </span>
          )}
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
