import { useEffect, useRef, useState } from 'react'
import { getEntry } from '../../lib/goldenDatasetApi'
import { buildEntryLink } from '../../router/urlScheme'
import type { GoldenEntry, GoldenEntrySummary } from '../../types/goldenDataset'
import { NotFoundState } from '../router/NotFoundState'
import { GoldenEntryDetail } from './GoldenEntryDetail'

export interface GoldenEntryListProps {
  entries: GoldenEntrySummary[]
  corpusId: string
  onDelete: (entry: GoldenEntrySummary) => void
  /** Document id -> name, so entries can be grouped under a document-name header. Only passed
   * by the parent when "Entire Corpus" is selected — with a single document selected, every
   * entry already belongs to it, so grouping would be redundant. */
  documentNames?: Map<string, string>
  /** An entry to open directly, per a deep link (032-deep-linking FR-007) — auto-expanded
   * (when approved) and scrolled into view on mount/change. */
  linkedEntryId?: string | null
  /** Called when the linked entry above is collapsed, so the parent can drop `entryId` from
   * the URL (032-deep-linking research.md §4). */
  onCloseLinkedEntry?: () => void
  /** Called whenever an entry is expanded via a plain in-app click (not the deep-link open
   * path above), so the caller can keep the URL in sync (034-more-deep-links). */
  onEntryOpened?: (entryId: string) => void
}

interface EntryGroup {
  key: string
  documentName: string | null
  entries: GoldenEntrySummary[]
}

const STATUS_LABELS: Record<GoldenEntrySummary['status'], string> = {
  approved: 'Approved',
  pending_review: 'Pending Review',
  rejected: 'Rejected',
}

const STATUS_ICONS: Record<GoldenEntrySummary['status'], string> = {
  approved: '✅',
  pending_review: '⏳',
  rejected: '❌',
}

const SOURCE_LABELS: Record<GoldenEntrySummary['source'], string> = {
  manual: 'Human Generated Answer',
  llm_generated: 'LLM Generated Answer',
}

const SOURCE_ICONS: Record<GoldenEntrySummary['source'], string> = {
  manual: '🧑',
  llm_generated: '🤖',
}

/** Groups entries by documentId, preserving the order each document first appears in
 * `entries`, per VectorViewScreen's own document-grouping pattern. */
function groupByDocument(entries: GoldenEntrySummary[], documentNames: Map<string, string>): EntryGroup[] {
  const groups: EntryGroup[] = []
  const groupByKey = new Map<string, EntryGroup>()

  for (const entry of entries) {
    const key = entry.documentId ?? ''
    let group = groupByKey.get(key)
    if (group === undefined) {
      group = {
        key,
        documentName: entry.documentId !== null ? (documentNames.get(entry.documentId) ?? 'Unknown document') : null,
        entries: [],
      }
      groupByKey.set(key, group)
      groups.push(group)
    }
    group.entries.push(entry)
  }

  return groups
}

/**
 * The Golden Dataset screen's main entry list. Clicking an approved entry's question fetches
 * and expands its full read-only answer inline, beneath that row (030-golden-dataset-entry-
 * detail US2) — independent per row, so multiple entries can be expanded at once (research.md).
 * Pending-review and rejected entries' questions are inert here; they keep using the separate,
 * fully-editable Pending Review workflow rendered above this list. When `documentNames` is
 * given (i.e. "Entire Corpus" is selected), entries are grouped under a document-name header
 * per document, instead of one flat list.
 */
export function GoldenEntryList({
  entries,
  corpusId,
  onDelete,
  documentNames,
  linkedEntryId,
  onCloseLinkedEntry,
  onEntryOpened,
}: GoldenEntryListProps) {
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set())
  const [loadedEntries, setLoadedEntries] = useState<Map<string, GoldenEntry>>(new Map())
  const [notFoundEntryId, setNotFoundEntryId] = useState<string | null>(null)
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map())

  // Deep-linked entry (032-deep-linking FR-007/FR-009): fetch it directly (independent of the
  // click-to-expand path below, since it may not be approved, or may not exist at all), expand
  // it when approved — matching what a manual click would show — and surface a not-found state
  // on a 404 instead of the list.
  useEffect(() => {
    if (linkedEntryId === null || linkedEntryId === undefined) {
      setNotFoundEntryId(null)
      return
    }

    let cancelled = false
    setNotFoundEntryId(null)

    getEntry(linkedEntryId)
      .then((entry) => {
        if (cancelled) return
        setLoadedEntries((current) => new Map(current).set(entry.id, entry))
        if (entry.status === 'approved') {
          setExpandedEntryIds((current) => new Set(current).add(entry.id))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNotFoundEntryId(linkedEntryId)
        }
      })

    return () => {
      cancelled = true
    }
  }, [linkedEntryId])

  useEffect(() => {
    if (linkedEntryId === null || linkedEntryId === undefined || notFoundEntryId !== null) {
      return
    }
    rowRefs.current.get(linkedEntryId)?.scrollIntoView({ block: 'center' })
  }, [linkedEntryId, entries, notFoundEntryId])

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
      if (summary.id === linkedEntryId) {
        onCloseLinkedEntry?.()
      }
      return
    }

    if (!loadedEntries.has(summary.id)) {
      const entry = await getEntry(summary.id)
      setLoadedEntries((current) => new Map(current).set(summary.id, entry))
    }
    setExpandedEntryIds((current) => new Set(current).add(summary.id))
    onEntryOpened?.(summary.id)
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

  function handleCopyLink(summary: GoldenEntrySummary) {
    const path = buildEntryLink(corpusId, summary.id)
    const url = `${window.location.origin}${path}`
    void navigator.clipboard.writeText(url)
  }

  if (notFoundEntryId !== null) {
    return (
      <NotFoundState
        message="This entry no longer exists, or you don't have access to it."
        backHref={`/golden-dataset/${corpusId}`}
        backLabel="Back to Golden Dataset"
      />
    )
  }

  function renderRow(entry: GoldenEntrySummary) {
    return (
      <li
        key={entry.id}
        data-testid={`golden-entry-${entry.id}`}
        ref={(node) => {
          if (node) {
            rowRefs.current.set(entry.id, node)
          } else {
            rowRefs.current.delete(entry.id)
          }
        }}
        className="rounded-lg border border-outline-variant bg-surface-container p-3"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => handleQuestionClick(entry)}
              className="text-left text-sm text-on-surface"
            >
              {entry.question}
            </button>
            <span className="flex items-center gap-1">
              <span
                title={STATUS_LABELS[entry.status]}
                aria-label={STATUS_LABELS[entry.status]}
                className="inline-flex h-5 w-5 items-center justify-center text-base leading-none"
              >
                {STATUS_ICONS[entry.status]}
              </span>
              <span
                title={SOURCE_LABELS[entry.source]}
                aria-label={SOURCE_LABELS[entry.source]}
                className="inline-flex h-5 w-5 items-center justify-center text-base leading-none"
              >
                {SOURCE_ICONS[entry.source]}
              </span>
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-2 text-xs text-on-surface-variant">
            <button
              type="button"
              aria-label={`Copy link to ${entry.question}`}
              onClick={() => handleCopyLink(entry)}
              className="rounded border border-outline-variant px-2 py-1 text-xs text-on-surface hover:bg-surface-container-high"
            >
              🔗 Copy link
            </button>
            <button
              type="button"
              aria-label={`Delete ${entry.question}`}
              onClick={() => handleDelete(entry)}
              className="rounded border border-outline-variant px-2 py-1 text-xs text-on-surface hover:bg-surface-container-high"
            >
              🗑️ Delete
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
    )
  }

  if (documentNames !== undefined) {
    return (
      <div data-testid="golden-entry-list" className="flex flex-col gap-4">
        {groupByDocument(entries, documentNames).map((group) => (
          <div key={group.key} data-testid={`golden-entry-group-${group.key || 'entire-corpus'}`}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {group.documentName ?? 'Entire Corpus'}
            </div>
            <ul className="flex flex-col gap-2">{group.entries.map(renderRow)}</ul>
          </div>
        ))}
      </div>
    )
  }

  return <ul data-testid="golden-entry-list" className="flex flex-col gap-2">{entries.map(renderRow)}</ul>
}
