import { useState } from 'react'
import type { SourceDocument } from '../../types/sourceDocument'
import { formatFileSize } from '../../lib/formatFileSize'

export interface OtherCorpus {
  id: string
  name: string
}

export interface DocumentListProps {
  documents: SourceDocument[]
  onExportCsv: () => void
  onDeleteDocuments: (ids: string[]) => void
  otherCorpora?: OtherCorpus[]
  onAttachToCorpus?: (documentId: string, targetCorpusId: string) => void
  onRemoveFromCorpus?: (documentId: string) => void
  selectedDocumentId?: string | null
  onSelectDocument?: (documentId: string) => void
}

function formatUploadedAt(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

function StatusChip({ status }: { status: SourceDocument['status'] }) {
  const isProcessed = status === 'processed'
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-xs font-medium tracking-wide ' +
        (isProcessed
          ? 'bg-secondary-container/20 text-secondary'
          : 'bg-tertiary-container/20 text-tertiary')
      }
    >
      <span
        className={'h-1.5 w-1.5 rounded-full ' + (isProcessed ? 'bg-secondary' : 'bg-tertiary')}
        aria-hidden="true"
      />
      {isProcessed ? 'PROCESSED' : 'PROCESSING'}
    </span>
  )
}

function handleDeleteRow(doc: SourceDocument, onDeleteDocuments: (ids: string[]) => void) {
  if (window.confirm(`Delete ${doc.name}?`)) {
    onDeleteDocuments([doc.id])
  }
}

export function DocumentList({
  documents,
  onExportCsv,
  onDeleteDocuments,
  otherCorpora = [],
  onAttachToCorpus,
  onRemoveFromCorpus,
  selectedDocumentId = null,
  onSelectDocument,
}: DocumentListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDeleteSelected = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      return
    }
    if (window.confirm(`Delete ${ids.length} documents?`)) {
      onDeleteDocuments(ids)
      setSelectedIds(new Set())
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-outline-variant bg-surface-container">
      <div className="flex items-center justify-between border-b border-outline-variant p-6">
        <h2 className="text-xl font-semibold text-on-surface">Document List</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="rounded border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            Delete Selected
          </button>
          <button
            type="button"
            onClick={onExportCsv}
            className="rounded border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="rounded border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high"
          >
            View All
          </button>
        </div>
      </div>

      {/* Wraps the table so a pathologically long, unbreakable token still scrolls within this
          pane instead of overflowing the surrounding split-pane layout (022-chunk-preview-ui-fixes
          US1). The other columns get fixed widths sized to their content (STATUS needs w-32 to fit
          the "PROCESSED" chip without spilling into the actions column) and DOCUMENT NAME takes
          whatever space is left via w-auto — the actions column only needs to fit a single Delete
          button today; re-enabling the commented-out attach/remove controls below will need
          revisiting this width. */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="font-mono text-xs tracking-widest text-on-surface-variant">
              <th className="w-10 px-6 py-3 font-medium">
                <span className="sr-only">Select</span>
              </th>
              <th className="w-auto px-6 py-3 font-medium">DOCUMENT NAME</th>
              <th className="w-20 px-6 py-3 font-medium">SIZE</th>
              <th className="w-28 px-6 py-3 font-medium">UPLOAD DATE</th>
              <th className="w-32 px-6 py-3 font-medium">STATUS</th>
              <th className="w-24 px-6 py-3 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr
                key={doc.id}
                aria-current={doc.id === selectedDocumentId ? 'true' : undefined}
                className={
                  'border-t border-outline-variant' +
                  (doc.id === selectedDocumentId ? ' bg-surface-container-high' : '')
                }
              >
                <td className="px-6 py-4">
                  {doc.status === 'processed' && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${doc.name}`}
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleSelected(doc.id)}
                    />
                  )}
                </td>
                <td className="break-words px-6 py-4 text-on-surface">
                  {onSelectDocument ? (
                    <button
                      type="button"
                      onClick={() => onSelectDocument(doc.id)}
                      className="block w-full text-left hover:underline focus:underline"
                    >
                      {doc.name}
                    </button>
                  ) : (
                    doc.name
                  )}
                </td>
                <td className="px-6 py-4 text-on-surface-variant">{formatFileSize(doc.sizeBytes)}</td>
                <td className="px-6 py-4 text-on-surface-variant">{formatUploadedAt(doc.uploadedAt)}</td>
                <td className="px-6 py-4">
                  <StatusChip status={doc.status} />
                </td>
                <td className="px-6 py-4 text-right">
                  {doc.status === 'processed' && (
                    <div className="flex items-center justify-end gap-2">
                      {/* {onAttachToCorpus && otherCorpora.length > 0 && (
                        <select
                          aria-label={`Add ${doc.name} to another corpus`}
                          defaultValue=""
                          onChange={(event) => {
                            const targetCorpusId = event.target.value
                            if (targetCorpusId) {
                              onAttachToCorpus(doc.id, targetCorpusId)
                              event.target.value = ''
                            }
                          }}
                          className="rounded border border-outline-variant bg-surface px-2 py-1 text-xs text-on-surface"
                        >
                          <option value="" disabled>
                            Add to corpus…
                          </option>
                          {otherCorpora.map((corpus) => (
                            <option key={corpus.id} value={corpus.id}>
                              {corpus.name}
                            </option>
                          ))}
                        </select>
                      )} */}
                      {/* {onRemoveFromCorpus && (
                        <button
                          type="button"
                          aria-label={`Remove ${doc.name} from this corpus`}
                          onClick={() => onRemoveFromCorpus(doc.id)}
                          className="rounded border border-outline-variant px-3 py-1 text-sm text-on-surface hover:bg-surface-container-high"
                        >
                          Remove from Corpus
                        </button>
                      )} */}
                      <button
                        type="button"
                        aria-label={`Delete ${doc.name}`}
                        onClick={() => handleDeleteRow(doc, onDeleteDocuments)}
                        className="rounded border border-outline-variant px-3 py-1 text-sm text-on-surface hover:bg-surface-container-high"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
