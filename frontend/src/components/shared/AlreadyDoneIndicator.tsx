export interface AlreadyDoneIndicatorProps {
  verb: string
  noun: string
  scope: 'document' | 'corpus'
}

/**
 * Single-line "already done" indicator — shared between Fixed Size Chunking ("Chunking already
 * performed...") and Embeddings ("Embedding generation already performed..."), so both screens
 * present already-existing data the same way instead of Embeddings' previous bespoke per-document
 * breakdown block (022-chunk-preview-ui-fixes research.md §6, FR-011).
 */
export function AlreadyDoneIndicator({ verb, noun, scope }: AlreadyDoneIndicatorProps) {
  return (
    <p data-testid="already-done-indicator" className="mt-2 shrink-0 text-sm text-on-surface-variant">
      {verb} already performed for this {scope} — showing previously saved {noun}.
    </p>
  )
}
