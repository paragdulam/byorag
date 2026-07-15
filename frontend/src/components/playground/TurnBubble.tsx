import type { Turn } from '../../types/playground'

export interface TurnBubbleProps {
  turn: Turn
  isGenerating: boolean
  isBusy: boolean
  isSelected: boolean
  onSelect: () => void
  onRetry: () => void
}

// One question + its answer/loading/error state (spec FR-008, FR-014). The answer, once
// present, is clickable/tappable to select this turn for the right-side retrieval panel
// (FR-018) — wired up in User Story 2.
export function TurnBubble({ turn, isGenerating, isBusy, isSelected, onSelect, onRetry }: TurnBubbleProps) {
  return (
    <div data-testid={`turn-${turn.id}`} className="flex flex-col gap-2">
      <div className="self-end rounded-lg bg-primary-container px-4 py-2 text-on-primary-container">
        {turn.question}
      </div>

      {isGenerating && (
        <p data-testid={`turn-${turn.id}-generating`} className="text-sm text-on-surface-variant">
          Generating answer…
        </p>
      )}

      {!isGenerating && turn.answer !== null && (
        <button
          type="button"
          aria-label={`Answer to ${turn.question}`}
          onClick={onSelect}
          aria-pressed={isSelected}
          className={`self-start rounded-lg border px-4 py-2 text-left text-on-surface ${
            isSelected ? 'border-primary bg-surface-container-high' : 'border-outline-variant bg-surface-container'
          }`}
        >
          {turn.answer}
        </button>
      )}

      {!isGenerating && turn.answer === null && turn.error !== null && (
        <div className="self-start rounded-lg border border-error bg-surface-container p-3">
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
