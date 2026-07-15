import { useState } from 'react'
import type { Turn } from '../../types/playground'

export interface RetrievalPanelProps {
  turn: Turn | null
  isBusy: boolean
  isGenerating: boolean
  onGenerate: () => void
}

const EMBEDDING_COLUMNS = 8
const EMBEDDING_PREVIEW_ROWS = 2
const EMBEDDING_PREVIEW_COUNT = EMBEDDING_COLUMNS * EMBEDDING_PREVIEW_ROWS

// Right panel (spec FR-004): Generate control, then the retrieved-chunk list, then the query
// embedding preview, for whichever turn is currently selected (defaults to the newest —
// spec FR-010; User Story 2 lets a past answer be selected instead).
export function RetrievalPanel({ turn, isBusy, isGenerating, onGenerate }: RetrievalPanelProps) {
  // Keyed by turn id so switching turns doesn't carry over a previous turn's expanded state.
  const [expandedChunks, setExpandedChunks] = useState<Record<string, Set<string>>>({})
  const [expandedEmbeddingTurns, setExpandedEmbeddingTurns] = useState<Set<string>>(new Set())

  if (turn === null) {
    return (
      <p data-testid="playground-retrieval-empty" className="text-sm text-on-surface-variant">
        Ask a question to see the chunks it retrieves.
      </p>
    )
  }

  const hasChunks = turn.chunks.length > 0
  const expandedForTurn = expandedChunks[turn.id] ?? new Set<string>()
  const embeddingExpanded = expandedEmbeddingTurns.has(turn.id)
  const embeddingValues = embeddingExpanded
    ? turn.queryEmbedding
    : turn.queryEmbedding.slice(0, EMBEDDING_PREVIEW_COUNT)

  const toggleChunk = (chunkId: string) => {
    setExpandedChunks((prev) => {
      const current = new Set(prev[turn.id] ?? [])
      if (current.has(chunkId)) {
        current.delete(chunkId)
      } else {
        current.add(chunkId)
      }
      return { ...prev, [turn.id]: current }
    })
  }

  const toggleEmbedding = () => {
    setExpandedEmbeddingTurns((prev) => {
      const next = new Set(prev)
      if (next.has(turn.id)) {
        next.delete(turn.id)
      } else {
        next.add(turn.id)
      }
      return next
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <button
        type="button"
        aria-label="Generate"
        onClick={onGenerate}
        disabled={isBusy || !hasChunks}
        className="self-start rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
      >
        Generate
      </button>

      {!hasChunks && (
        <p data-testid="playground-no-chunks" className="text-sm text-on-surface-variant">
          No saved chunks are available to search for this document yet.
        </p>
      )}

      {isGenerating && (
        <p data-testid="playground-generating" className="text-sm text-on-surface-variant">
          Generating…
        </p>
      )}

      {hasChunks && (
        <div data-testid="playground-chunk-list" className="flex flex-col gap-2">
          {turn.chunks.map((chunk) => (
            <div
              key={chunk.chunkId}
              className="rounded-lg border border-outline-variant bg-surface-container p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</span>
                <button
                  type="button"
                  aria-label={`Show more for chunk ${chunk.index}`}
                  aria-expanded={expandedForTurn.has(chunk.chunkId)}
                  onClick={() => toggleChunk(chunk.chunkId)}
                  className="text-xs font-medium text-primary"
                >
                  {expandedForTurn.has(chunk.chunkId) ? 'Show less' : 'Show more'}
                </button>
              </div>
              {expandedForTurn.has(chunk.chunkId) && (
                <p className="mt-2 text-sm text-on-surface">{chunk.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto">
        <p className="text-sm text-on-surface-variant">Query embedding</p>
        <div
          data-testid="playground-embedding-preview"
          className="mt-1 grid gap-1 font-mono text-xs text-on-surface"
          style={{ gridTemplateColumns: `repeat(${EMBEDDING_COLUMNS}, minmax(0, 1fr))` }}
        >
          {embeddingValues.map((value, index) => (
            <span key={index} className="rounded bg-surface-container px-1 py-0.5 text-right">
              {value.toFixed(2)}
            </span>
          ))}
        </div>
        {turn.queryEmbedding.length > EMBEDDING_PREVIEW_COUNT && (
          <button
            type="button"
            aria-label="Show more embedding values"
            aria-expanded={embeddingExpanded}
            onClick={toggleEmbedding}
            className="mt-1 self-end text-xs font-medium text-primary"
          >
            {embeddingExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  )
}
