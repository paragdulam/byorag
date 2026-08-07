import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { buildTurnLink } from '../../router/urlScheme'
import type { Turn } from '../../types/playground'

export interface PlaygroundTurnDetailProps {
  turn: Turn
  corpusId: string
  isBusy: boolean
  isGenerating: boolean
  /** Whether this is the turn a deep link opened directly to (034-more-deep-links) — highlighted
   * so it's easy to spot among the others. */
  isLinked?: boolean
  onRetry: () => void
}

const EMBEDDING_COLUMNS = 8
const EMBEDDING_PREVIEW_ROWS = 2
const EMBEDDING_PREVIEW_COUNT = EMBEDDING_COLUMNS * EMBEDDING_PREVIEW_ROWS

/**
 * One turn's full sequence, in one place instead of split across a two-panel layout
 * (031-playground-metrics-redesign US1 FR-002): the question, then the query embedding
 * preview, then the retrieved evidence, then the final answer (or its generating/failed
 * state) — no "Generate" button anywhere, since answering is now automatic (FR-005).
 * Combines what `TurnBubble` and `RetrievalPanel` used to render separately; each instance
 * owns its own expand/collapse state for its embedding preview and chunk list, since it only
 * ever renders one turn.
 */
export function PlaygroundTurnDetail({
  turn,
  corpusId,
  isBusy,
  isGenerating,
  isLinked,
  onRetry,
}: PlaygroundTurnDetailProps) {
  const [expandedChunkIds, setExpandedChunkIds] = useState<Set<string>>(new Set())
  const [embeddingExpanded, setEmbeddingExpanded] = useState(false)

  const hasChunks = turn.chunks.length > 0
  const embeddingValues = embeddingExpanded
    ? turn.queryEmbedding
    : turn.queryEmbedding.slice(0, EMBEDDING_PREVIEW_COUNT)

  function toggleChunk(chunkId: string) {
    setExpandedChunkIds((current) => {
      const next = new Set(current)
      if (next.has(chunkId)) {
        next.delete(chunkId)
      } else {
        next.add(chunkId)
      }
      return next
    })
  }

  function handleCopyLink() {
    const path = buildTurnLink(corpusId, turn.id)
    const url = `${window.location.origin}${path}`
    void navigator.clipboard.writeText(url)
  }

  return (
    <div
      data-testid={`turn-${turn.id}`}
      className={
        'flex flex-col gap-4 rounded-lg border p-4 ' +
        (isLinked
          ? 'border-primary bg-surface-container-high'
          : 'border-outline-variant bg-surface-container')
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="self-start rounded-lg bg-primary-container px-4 py-2 text-on-primary-container">
          {turn.question}
        </div>
        <button
          type="button"
          aria-label={`Copy link to ${turn.question}`}
          onClick={handleCopyLink}
          className="shrink-0 rounded border border-outline-variant px-2 py-1 text-xs text-on-surface hover:bg-surface-container-high"
        >
          Copy link
        </button>
      </div>

      <div>
        <p className="text-sm text-on-surface-variant">Query embedding</p>
        <div
          data-testid="playground-embedding-preview"
          className="mt-1 grid gap-1 font-mono text-xs text-on-surface"
          style={{ gridTemplateColumns: `repeat(${EMBEDDING_COLUMNS}, minmax(0, 1fr))` }}
        >
          {embeddingValues.map((value, index) => (
            <span key={index} className="rounded bg-surface-container-high px-1 py-0.5 text-right">
              {value.toFixed(2)}
            </span>
          ))}
        </div>
        {turn.queryEmbedding.length > EMBEDDING_PREVIEW_COUNT && (
          <button
            type="button"
            aria-label="Show more embedding values"
            aria-expanded={embeddingExpanded}
            onClick={() => setEmbeddingExpanded((current) => !current)}
            className="mt-1 text-xs font-medium text-primary"
          >
            {embeddingExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {!hasChunks && (
        <p data-testid="playground-no-chunks" className="text-sm text-on-surface-variant">
          No saved chunks are available to search for this document yet.
        </p>
      )}

      {hasChunks && (
        <div data-testid="playground-chunk-list" className="flex flex-col gap-2">
          {turn.chunks.map((chunk) => (
            <div
              key={chunk.chunkId}
              className="rounded-lg border border-outline-variant bg-surface p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</span>
                <button
                  type="button"
                  aria-label={`Show more for chunk ${chunk.index}`}
                  aria-expanded={expandedChunkIds.has(chunk.chunkId)}
                  onClick={() => toggleChunk(chunk.chunkId)}
                  className="text-xs font-medium text-primary"
                >
                  {expandedChunkIds.has(chunk.chunkId) ? 'Show less' : 'Show more'}
                </button>
              </div>
              {expandedChunkIds.has(chunk.chunkId) && (
                <p className="mt-2 text-sm text-on-surface">{chunk.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {isGenerating && (
        <p data-testid={`turn-${turn.id}-generating`} className="text-sm text-on-surface-variant">
          Generating answer…
        </p>
      )}

      {!isGenerating && turn.answer !== null && (
        <div
          data-testid={`turn-${turn.id}-answer`}
          aria-label={`Answer to ${turn.question}`}
          className="self-start rounded-lg border border-outline-variant bg-surface px-4 py-2 text-left text-on-surface [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-surface-container-high [&_code]:px-1"
        >
          <ReactMarkdown>{turn.answer}</ReactMarkdown>
        </div>
      )}

      {!isGenerating && turn.answer === null && turn.error !== null && (
        <div className="self-start rounded-lg border border-error bg-surface p-3">
          <p role="alert" className="text-sm text-error">
            {turn.error}
          </p>
          <button
            type="button"
            aria-label={`Retry generating an answer to ${turn.question}`}
            onClick={onRetry}
            disabled={isBusy}
            className="mt-2 rounded bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
