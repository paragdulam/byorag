import { useState } from 'react'
import { getEntry } from '../../lib/goldenDatasetApi'
import type { GoldenEntry, GoldenEntrySummary } from '../../types/goldenDataset'
import { GoldenEntryEditor } from './GoldenEntryEditor'

export interface GoldenReviewQueueProps {
  entries: GoldenEntrySummary[]
  onEntryChanged: (entry: GoldenEntry) => void
}

export function GoldenReviewQueue({ entries, onEntryChanged }: GoldenReviewQueueProps) {
  const [openEntry, setOpenEntry] = useState<GoldenEntry | null>(null)

  async function handleReview(summary: GoldenEntrySummary) {
    const entry = await getEntry(summary.id)
    setOpenEntry(entry)
  }

  function handleSaved(entry: GoldenEntry) {
    setOpenEntry(null)
    onEntryChanged(entry)
  }

  if (openEntry !== null) {
    return (
      <div className="rounded-lg border border-outline-variant bg-surface-container p-4">
        <GoldenEntryEditor
          scope={{ corpusId: openEntry.corpusId, documentId: openEntry.documentId }}
          initialEntry={openEntry}
          onSaved={handleSaved}
          onCancel={() => setOpenEntry(null)}
        />
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container p-3"
        >
          <span className="text-sm text-on-surface">{entry.question}</span>
          <button
            type="button"
            onClick={() => handleReview(entry)}
            className="rounded border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-container-high"
          >
            Review
          </button>
        </li>
      ))}
    </ul>
  )
}
