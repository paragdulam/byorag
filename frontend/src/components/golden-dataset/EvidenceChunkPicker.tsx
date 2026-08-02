import { useState } from 'react'
import type { GoldenCandidate } from '../../types/goldenDataset'

export interface EvidenceChunkPickerProps {
  candidates: GoldenCandidate[]
  selectedChunkIds: Set<string>
  onToggle: (chunkId: string, candidate: GoldenCandidate) => void
  onManualSearch: (query: string) => void
}

function MatchBadge({ candidate }: { candidate: GoldenCandidate }) {
  const label =
    candidate.matchedQuestion && candidate.matchedAnswer
      ? 'Matched both'
      : candidate.matchedQuestion
        ? 'Matched question'
        : candidate.matchedAnswer
          ? 'Matched answer'
          : null

  if (label === null) {
    return null
  }

  return (
    <span className="rounded-full bg-secondary-container/20 px-2 py-0.5 text-xs font-medium text-secondary">
      {label}
    </span>
  )
}

export function EvidenceChunkPicker({
  candidates,
  selectedChunkIds,
  onToggle,
  onManualSearch,
}: EvidenceChunkPickerProps) {
  const [manualQuery, setManualQuery] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label
            htmlFor="evidence-manual-search"
            className="block text-sm text-on-surface-variant"
          >
            Search for more chunks
          </label>
          <input
            id="evidence-manual-search"
            type="text"
            value={manualQuery}
            onChange={(event) => setManualQuery(event.target.value)}
            className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-sm text-on-surface"
          />
        </div>
        <button
          type="button"
          onClick={() => manualQuery.trim() && onManualSearch(manualQuery.trim())}
          className="rounded border border-outline-variant px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high"
        >
          Search
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li
            key={candidate.chunkId}
            className="rounded-lg border border-outline-variant bg-surface-container p-3"
          >
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedChunkIds.has(candidate.chunkId)}
                onChange={() => onToggle(candidate.chunkId, candidate)}
                aria-label={candidate.content}
                className="mt-1"
              />
              <span className="flex-1">
                <span className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-xs text-tertiary">
                    CHUNK_{candidate.chunkIndex}
                  </span>
                  <MatchBadge candidate={candidate} />
                </span>
                <span className="block text-sm text-on-surface">{candidate.content}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
