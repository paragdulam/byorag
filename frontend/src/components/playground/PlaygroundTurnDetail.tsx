import { useRef, useState } from 'react'
import { buildTurnLink } from '../../router/urlScheme'
import { useClickOutside } from '../../hooks/useClickOutside'
import { AnswerCitations } from './AnswerCitations'
import { ChunkCitationModal } from './ChunkCitationModal'
import type { Turn, TurnChunk } from '../../types/playground'

export interface PlaygroundTurnDetailProps {
  turn: Turn
  corpusId: string
  isBusy: boolean
  isGenerating: boolean
  /** Whether this is the turn a deep link opened directly to (034-more-deep-links) — highlighted
   * so it's easy to spot among the others. */
  isLinked?: boolean
  onRetry: () => void
  /** Navigates to a cited chunk's own screen (034-more-deep-links' `navigateToChunkingChunk`,
   * threaded down from App.tsx via PlaygroundScreen). */
  onGoToChunk?: (documentId: string, chunkIndex: number) => void
}

const EMBEDDING_COLUMNS = 8
const EMBEDDING_PREVIEW_ROWS = 2
const EMBEDDING_PREVIEW_COUNT = EMBEDDING_COLUMNS * EMBEDDING_PREVIEW_ROWS

/**
 * One turn's full sequence, in one place instead of split across a two-panel layout
 * (031-playground-metrics-redesign US1 FR-002): the question, then the answer with its
 * evidence merged inline via in-answer citations (033-ui-ux-polish US6) — the query embedding
 * and Retrieved Chunks group are tucked behind the Actions popover instead of always shown, so
 * the default view reads like an answer rather than a debugging dump.
 */
export function PlaygroundTurnDetail({
  turn,
  corpusId,
  isBusy,
  isGenerating,
  isLinked,
  onRetry,
  onGoToChunk,
}: PlaygroundTurnDetailProps) {
  const [embeddingExpanded, setEmbeddingExpanded] = useState(false)
  const [isActionsOpen, setIsActionsOpen] = useState(false)
  const [showQueryEmbedding, setShowQueryEmbedding] = useState(false)
  const [showRetrievedChunks, setShowRetrievedChunks] = useState(false)
  const [citedChunk, setCitedChunk] = useState<TurnChunk | null>(null)
  const actionsRef = useRef<HTMLDivElement>(null)

  useClickOutside(actionsRef, () => setIsActionsOpen(false))

  const hasChunks = turn.chunks.length > 0
  const embeddingValues = embeddingExpanded
    ? turn.queryEmbedding
    : turn.queryEmbedding.slice(0, EMBEDDING_PREVIEW_COUNT)

  function handleCopyLink() {
    const path = buildTurnLink(corpusId, turn.id)
    const url = `${window.location.origin}${path}`
    void navigator.clipboard.writeText(url)
    setIsActionsOpen(false)
  }

  function handleChooseQueryEmbedding() {
    setShowQueryEmbedding(true)
    setIsActionsOpen(false)
  }

  function handleChooseRetrievedChunks() {
    setShowRetrievedChunks(true)
    setIsActionsOpen(false)
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
        <div ref={actionsRef} className="relative shrink-0">
          <button
            type="button"
            aria-label={`Actions for ${turn.question}`}
            aria-haspopup="menu"
            aria-expanded={isActionsOpen}
            onClick={() => setIsActionsOpen((current) => !current)}
            className="rounded border border-outline-variant px-2 py-1 text-sm text-on-surface hover:bg-surface-container-high"
          >
            ⋮
          </button>
          {isActionsOpen && (
            <div
              role="menu"
              aria-label={`Actions for ${turn.question}`}
              className="absolute right-0 top-full z-10 mt-1 w-44 overflow-hidden rounded border border-outline-variant bg-surface-container shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleCopyLink}
                className="block w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
              >
                Copy Link
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleChooseQueryEmbedding}
                className="block w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
              >
                Query Embedding
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleChooseRetrievedChunks}
                className="block w-full px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
              >
                Retrieved Chunks
              </button>
            </div>
          )}
        </div>
      </div>

      {showQueryEmbedding && (
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
      )}

      {showRetrievedChunks && hasChunks && (
        <div>
          <p className="text-sm text-on-surface-variant">Retrieved Chunks</p>
          <ul data-testid="playground-retrieved-chunks" className="mt-1 flex flex-col gap-2">
            {turn.chunks.map((chunk) => (
              <li key={chunk.chunkId} className="rounded-lg border border-outline-variant bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</span>
                  <span className="font-mono text-xs text-on-surface-variant">
                    cosine similarity: {chunk.score.toFixed(3)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-on-surface">{chunk.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasChunks && (
        <p data-testid="playground-no-chunks" className="text-sm text-on-surface-variant">
          No saved chunks are available to search for this document yet.
        </p>
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
          className="self-start rounded-lg border border-outline-variant bg-surface px-4 py-2 text-left text-on-surface"
        >
          <AnswerCitations answer={turn.answer} chunks={turn.chunks} onCiteClick={setCitedChunk} />
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

      {citedChunk && (
        <ChunkCitationModal
          chunk={citedChunk}
          corpusId={corpusId}
          onClose={() => setCitedChunk(null)}
          onGoToChunk={onGoToChunk}
        />
      )}
    </div>
  )
}
