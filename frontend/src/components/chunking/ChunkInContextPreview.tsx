import { useEffect, useState } from 'react'
import { fetchStructuredPreview } from '../../lib/chunkingApi'
import type { StructuredPreview } from '../../lib/chunkingApi'
import { computeChunkContextView } from '../../lib/chunkContextView'
import type { ChunkContextPage } from '../../lib/chunkContextView'
import { ColoredBlockGroups } from '../shared/ColoredBlockGroups'

export interface ChunkInContextPreviewProps {
  documentId: string
  selectedChunkIndex: number
  hasUnsavedChanges: boolean
}

/**
 * Right-hand pane on Fixed Size Chunking showing the selected chunk (plus its one preceding/
 * following neighbor) rendered against the real PDF page(s) it came from, reusing the structural
 * classification and chunk/overlap coloring already established for the whole-document Chunked
 * Preview (022-chunk-preview-ui-fixes), scoped down to just the relevant pages
 * (023-pdf-fullscreen-chunk-view). Fetches a document's full structured-preview payload once and
 * caches it — switching `selectedChunkIndex` re-slices client-side with no further network calls.
 */
export function ChunkInContextPreview({
  documentId,
  selectedChunkIndex,
  hasUnsavedChanges,
}: ChunkInContextPreviewProps) {
  const [preview, setPreview] = useState<StructuredPreview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(false)

  useEffect(() => {
    if (hasUnsavedChanges) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setIsEmpty(false)

    fetchStructuredPreview(documentId)
      .then((result) => {
        if (!cancelled) {
          setPreview(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsEmpty(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [documentId, hasUnsavedChanges])

  if (hasUnsavedChanges) {
    return (
      <p data-testid="chunk-context-unsaved" className="p-4 text-on-surface-variant">
        Save chunks to see this configuration in its page context.
      </p>
    )
  }

  if (isLoading) {
    return <p className="p-4 text-on-surface-variant">Loading chunks…</p>
  }

  if (isEmpty || preview === null) {
    return (
      <p data-testid="chunked-preview-empty" className="p-4 text-on-surface-variant">
        No chunks exist yet for this document. Run Fixed Size Chunking (and save the result)
        first, then reopen the in-context preview.
      </p>
    )
  }

  const pages: ChunkContextPage[] = computeChunkContextView(preview, selectedChunkIndex)

  return (
    <div className="flex flex-col gap-4 p-4 leading-relaxed">
      {pages.map((page) => (
        <div key={page.pageNumber} data-testid="chunk-context-page" className="flex flex-col gap-2">
          <div
            data-testid="chunk-context-page-number"
            className="font-mono text-xs tracking-widest text-on-surface-variant"
          >
            Page {page.pageNumber}
          </div>
          <ColoredBlockGroups blocks={page.blocks} spansByBlock={page.spansByBlock} />
        </div>
      ))}
    </div>
  )
}
