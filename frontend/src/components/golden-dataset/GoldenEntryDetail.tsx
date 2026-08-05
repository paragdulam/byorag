import { useState } from 'react'
import type { GoldenEntry, GoldenEntryChunk } from '../../types/goldenDataset'

export interface GoldenEntryDetailProps {
  entry: GoldenEntry
  onClose: () => void
}

/** One evidence chunk, collapsed to a couple of lines by default with a Show more/Show less
 * toggle to read the full content — independent per chunk, matching the per-row expand
 * pattern already used one level up in `GoldenEntryList`. */
function ChunkItem({ chunk }: { chunk: GoldenEntryChunk }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <li className="rounded border border-outline-variant bg-surface-container p-2">
      <div className="font-mono text-xs text-tertiary">CHUNK_{chunk.chunkIndex}</div>
      <p className={'text-sm text-on-surface ' + (isExpanded ? '' : 'line-clamp-2')}>
        {chunk.content}
      </p>
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="mt-1 text-xs font-medium text-primary hover:underline"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </li>
  )
}

/**
 * Read-only view of an approved golden dataset entry's question, full answer, and supporting
 * evidence chunks (030-golden-dataset-entry-detail US2). Deliberately not `GoldenEntryEditor`
 * in a disabled mode — this component renders no form elements and no save control at all, so
 * "there is no edit path here" holds by construction rather than depending on every
 * conditional in the shared editor staying correctly gated (see research.md).
 */
export function GoldenEntryDetail({ entry, onClose }: GoldenEntryDetailProps) {
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-outline-variant bg-surface p-3">
      <div>
        <div className="text-xs font-medium text-on-surface-variant">Question</div>
        <p className="text-sm text-on-surface">{entry.question}</p>
      </div>
      <div>
        <div className="text-xs font-medium text-on-surface-variant">Answer</div>
        <p className="text-sm text-on-surface">{entry.preferredAnswer}</p>
      </div>
      {entry.chunks.length > 0 && (
        <div>
          <div className="text-xs font-medium text-on-surface-variant">Evidence</div>
          <ul className="mt-1 flex flex-col gap-2">
            {entry.chunks.map((chunk) => (
              <ChunkItem key={chunk.id} chunk={chunk} />
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="self-start rounded border border-outline-variant px-2 py-1 text-xs text-on-surface hover:bg-surface-container-high"
      >
        Close
      </button>
    </div>
  )
}
