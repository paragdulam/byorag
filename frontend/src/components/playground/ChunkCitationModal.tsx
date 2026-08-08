import { buildChunkingChunkLink } from '../../router/urlScheme'
import type { TurnChunk } from '../../types/playground'

export interface ChunkCitationModalProps {
  chunk: TurnChunk
  corpusId: string
  onClose: () => void
  /** Navigates to the chunk's own screen (034-more-deep-links' `navigateToChunkingChunk`,
   * threaded down from App.tsx) — omitted (and the link left as a plain href) when this modal
   * is rendered somewhere without router wiring available, e.g. in isolation in tests. */
  onGoToChunk?: (documentId: string, chunkIndex: number) => void
}

/**
 * Dialog pattern matching `ConfirmModal`/`ComparisonModal` (033-ui-ux-polish US6): shows the
 * cited chunk's content and cosine similarity, a "Go To Chunk" link, and a close control.
 */
export function ChunkCitationModal({ chunk, corpusId, onClose, onGoToChunk }: ChunkCitationModalProps) {
  const goToChunkHref =
    chunk.documentId !== null ? buildChunkingChunkLink(corpusId, chunk.documentId, chunk.index) : null

  return (
    <div
      data-testid="chunk-citation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Chunk ${chunk.index}`}
        data-testid="chunk-citation-modal"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded bg-surface-container p-6"
      >
        <div className="flex shrink-0 items-center justify-between gap-4">
          <span className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</span>
          <div className="flex items-center gap-4">
            {goToChunkHref !== null && (
              <a
                href={goToChunkHref}
                onClick={(event) => {
                  if (chunk.documentId !== null && onGoToChunk) {
                    event.preventDefault()
                    onGoToChunk(chunk.documentId, chunk.index)
                  }
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Go To Chunk
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-on-surface-variant hover:text-on-surface hover:underline"
            >
              Close
            </button>
          </div>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          <p className="text-sm text-on-surface-variant">
            Cosine similarity: <span className="font-mono">{chunk.score.toFixed(3)}</span>
          </p>
          <p className="mt-3 text-on-surface">{chunk.content}</p>
        </div>
      </div>
    </div>
  )
}
