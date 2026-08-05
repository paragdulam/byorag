import { useState } from 'react'
import { getEntry } from '../../lib/goldenDatasetApi'
import type { GoldenEntry, GoldenEntrySummary } from '../../types/goldenDataset'
import { GoldenEntryDetail } from './GoldenEntryDetail'

export interface GoldenEntryListProps {
  entries: GoldenEntrySummary[]
  onDelete: (entry: GoldenEntrySummary) => void
}

const STATUS_LABELS: Record<GoldenEntrySummary['status'], string> = {
  approved: 'Approved',
  pending_review: 'Pending Review',
  rejected: 'Rejected',
}

const SOURCE_LABELS: Record<GoldenEntrySummary['source'], string> = {
  manual: 'Manual',
  llm_generated: 'LLM-generated',
}

/**
 * The Golden Dataset screen's main entry list. Clicking an approved entry's question fetches
 * and expands its full read-only answer inline, beneath that row (030-golden-dataset-entry-
 * detail US2) — independent per row, so multiple entries can be expanded at once (research.md).
 * Pending-review and rejected entries' questions are inert here; they keep using the separate,
 * fully-editable Pending Review workflow rendered above this list.
 */
export function GoldenEntryList({ entries, onDelete }: GoldenEntryListProps) {
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set())
  const [loadedEntries, setLoadedEntries] = useState<Map<string, GoldenEntry>>(new Map())

  async function handleQuestionClick(summary: GoldenEntrySummary) {
    if (summary.status !== 'approved') {
      return
    }

    if (expandedEntryIds.has(summary.id)) {
      setExpandedEntryIds((current) => {
        const next = new Set(current)
        next.delete(summary.id)
        return next
      })
      return
    }

    if (!loadedEntries.has(summary.id)) {
      const entry = await getEntry(summary.id)
      setLoadedEntries((current) => new Map(current).set(summary.id, entry))
    }
    setExpandedEntryIds((current) => new Set(current).add(summary.id))
  }

  function handleDelete(summary: GoldenEntrySummary) {
    setExpandedEntryIds((current) => {
      const next = new Set(current)
      next.delete(summary.id)
      return next
    })
    setLoadedEntries((current) => {
      const next = new Map(current)
      next.delete(summary.id)
      return next
    })
    onDelete(summary)
  }

  return (
    <ul data-testid="golden-entry-list" className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          data-testid={`golden-entry-${entry.id}`}
          className="rounded-lg border border-outline-variant bg-surface-container p-3"
        >
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => handleQuestionClick(entry)}
              className="text-left text-sm text-on-surface"
            >
              {entry.question}
            </button>
            <span className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span>{STATUS_LABELS[entry.status]}</span>
              <span>·</span>
              <span>{SOURCE_LABELS[entry.source]}</span>
              <button
                type="button"
                aria-label={`Delete ${entry.question}`}
                onClick={() => handleDelete(entry)}
                className="rounded border border-outline-variant px-2 py-1 text-xs text-on-surface hover:bg-surface-container-high"
              >
                Delete
              </button>
            </span>
          </div>
          {expandedEntryIds.has(entry.id) && loadedEntries.has(entry.id) && (
            <GoldenEntryDetail
              entry={loadedEntries.get(entry.id) as GoldenEntry}
              onClose={() => handleQuestionClick(entry)}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
