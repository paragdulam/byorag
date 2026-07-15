import type { Turn } from '../../types/playground'
import { TurnBubble } from './TurnBubble'

export interface ConversationPanelProps {
  turns: Turn[]
  queryText: string
  onQueryChange: (text: string) => void
  onSend: () => void
  isBusy: boolean
  generatingTurnId: string | null
  onRetry: (turnId: string) => void
  selectedTurnId: string | null
  onSelectTurn: (turnId: string) => void
}

// Left panel (spec FR-002, FR-009): the growing conversation, with the question textfield and
// send button pinned to the bottom.
export function ConversationPanel({
  turns,
  queryText,
  onQueryChange,
  onSend,
  isBusy,
  generatingTurnId,
  onRetry,
  selectedTurnId,
  onSelectTurn,
}: ConversationPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        data-testid="playground-turns"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
      >
        {turns.map((turn) => (
          <TurnBubble
            key={turn.id}
            turn={turn}
            isGenerating={generatingTurnId === turn.id}
            isBusy={isBusy}
            isSelected={selectedTurnId === turn.id}
            onSelect={() => onSelectTurn(turn.id)}
            onRetry={() => onRetry(turn.id)}
          />
        ))}
      </div>

      <div className="mt-4 flex shrink-0 items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm text-on-surface-variant" htmlFor="playground-query">
            Question
          </label>
          <input
            id="playground-query"
            aria-label="Question"
            type="text"
            value={queryText}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSend()
              }
            }}
            className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
          />
        </div>
        <button
          type="button"
          aria-label="Send"
          onClick={onSend}
          disabled={isBusy || queryText.trim().length === 0}
          className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}
