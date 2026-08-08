import { useEffect, useState, type SubmitEvent } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useCorpus } from '../../context/CorpusContext'
import { deleteSources, listSources } from '../../lib/sourcesApi'
import { buildDocumentLink } from '../../router/urlScheme'
import { ConfirmModal } from '../shared/ConfirmModal'
import type { SourceDocument } from '../../types/sourceDocument'

export interface CorporaScreenProps {
  onNavigate: (screen: ScreenId) => void
  onDocumentOpen?: (corpusId: string, documentId: string) => void
}

const DOCUMENT_PREVIEW_LIMIT = 5

function CorpusRowDocumentPreview({
  corpusId,
  documents,
  isExpanded,
  onToggleExpanded,
  onDocumentOpen,
  onDeleteDocument,
}: {
  corpusId: string
  documents: SourceDocument[]
  isExpanded: boolean
  onToggleExpanded: () => void
  onDocumentOpen?: (corpusId: string, documentId: string) => void
  onDeleteDocument: (document: SourceDocument) => void
}) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant" data-testid={`corpus-row-${corpusId}-documents`}>
        No documents in this corpus yet.
      </p>
    )
  }

  const visibleDocuments = isExpanded ? documents : documents.slice(0, DOCUMENT_PREVIEW_LIMIT)

  return (
    <div data-testid={`corpus-row-${corpusId}-documents`}>
      <ul className="flex flex-col gap-1">
        {visibleDocuments.map((doc) => (
          <li key={doc.id} className="flex items-center gap-2 text-sm">
            <a
              href={buildDocumentLink(corpusId, doc.id)}
              onClick={(event) => {
                event.preventDefault()
                onDocumentOpen?.(corpusId, doc.id)
              }}
              className="text-on-surface underline hover:text-primary"
            >
              {doc.name}
            </a>
            <button
              type="button"
              aria-label={`Delete ${doc.name}`}
              onClick={() => onDeleteDocument(doc)}
              className="leading-none hover:opacity-70"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
      {documents.length > DOCUMENT_PREVIEW_LIMIT && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="mt-1 text-xs font-medium text-primary"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export function CorporaScreen({ onNavigate, onDocumentOpen }: CorporaScreenProps) {
  const { corpora, activeCorpusId, isLoading, selectCorpus, createCorpus, deleteCorpus } = useCorpus()
  const [isCreating, setIsCreating] = useState(false)
  const [newCorpusName, setNewCorpusName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [documentsByCorpus, setDocumentsByCorpus] = useState<Map<string, SourceDocument[]>>(new Map())
  const [expandedCorpusIds, setExpandedCorpusIds] = useState<Set<string>>(new Set())
  const [pendingDeleteDocument, setPendingDeleteDocument] = useState<SourceDocument | null>(null)
  const [deleteDocumentError, setDeleteDocumentError] = useState<string | null>(null)

  const refreshAllDocuments = () => {
    Promise.all(
      corpora.map((corpus) => listSources(corpus.id).then((docs) => [corpus.id, docs] as const)),
    ).then((entries) => setDocumentsByCorpus(new Map(entries)))
  }

  useEffect(() => {
    refreshAllDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpora])

  const toggleExpanded = (corpusId: string) => {
    setExpandedCorpusIds((prev) => {
      const next = new Set(prev)
      if (next.has(corpusId)) {
        next.delete(corpusId)
      } else {
        next.add(corpusId)
      }
      return next
    })
  }

  const handleCreateSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newCorpusName.trim()
    if (!name) {
      return
    }
    try {
      await createCorpus(name)
      setNewCorpusName('')
      setIsCreating(false)
      setCreateError(null)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create corpus')
    }
  }

  const handleDeleteRow = async (id: string, name: string) => {
    if (!window.confirm(`Delete corpus "${name}"? This cannot be undone.`)) {
      return
    }
    setDeleteError(null)
    try {
      await deleteCorpus(id)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete corpus')
    }
  }

  const handleConfirmDeleteDocument = async (document: SourceDocument) => {
    try {
      await deleteSources([document.id])
      setPendingDeleteDocument(null)
      refreshAllDocuments()
    } catch (error) {
      setDeleteDocumentError(error instanceof Error ? error.message : 'Failed to delete document')
      setPendingDeleteDocument(null)
    }
  }

  return (
    <AppShell activeScreen="corpora" onNavigate={onNavigate}>
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">Corpora</h1>
        <p className="mt-2 text-on-surface-variant">
          Create, browse, and manage the corpora that scope Sources and Chunking.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-8 text-on-surface-variant" role="status">
          Loading corpora…
        </p>
      ) : (
        <div className="mt-8 rounded-lg border border-outline-variant bg-surface-container">
          <div className="flex items-center justify-between border-b border-outline-variant p-6">
            <h2 className="text-xl font-semibold text-on-surface">All Corpora</h2>
            {!isCreating && (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container"
              >
                + New Corpus
              </button>
            )}
          </div>

          {isCreating && (
            <form
              onSubmit={handleCreateSubmit}
              className="flex items-center gap-2 border-b border-outline-variant p-6"
            >
              <label htmlFor="corpora-screen-new-name" className="sr-only">
                New corpus name
              </label>
              <input
                id="corpora-screen-new-name"
                aria-label="New corpus name"
                value={newCorpusName}
                onChange={(event) => setNewCorpusName(event.target.value)}
                autoFocus
                className="flex-1 rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface"
                placeholder="Corpus name"
              />
              <button
                type="submit"
                className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false)
                  setNewCorpusName('')
                  setCreateError(null)
                }}
                className="rounded px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                Cancel
              </button>
            </form>
          )}

          {createError && (
            <p role="alert" className="px-6 pt-4 text-sm text-error">
              {createError}
            </p>
          )}

          {deleteError && (
            <p role="alert" className="px-6 pt-4 text-sm text-error">
              {deleteError}
            </p>
          )}

          {deleteDocumentError && (
            <p role="alert" className="px-6 pt-4 text-sm text-error">
              {deleteDocumentError}
            </p>
          )}

          {corpora.length === 0 ? (
            <p className="p-6 text-on-surface-variant">
              No corpora yet. Create your first corpus to get started.
            </p>
          ) : (
            <ul className="flex flex-col">
              {corpora.map((corpus) => {
                const isActive = corpus.id === activeCorpusId
                return (
                  <li
                    key={corpus.id}
                    data-testid={`corpus-row-${corpus.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={
                      'flex w-full flex-col gap-3 border-b border-outline-variant px-6 py-4 last:border-b-0 text-on-surface ' +
                      (isActive ? 'bg-primary-container/20' : '')
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span>{corpus.name}</span>
                      <div className="flex items-center gap-3">
                        {isActive ? (
                          <span className="text-xs font-medium tracking-wide text-primary">
                            ACTIVE
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Make ${corpus.name} active`}
                            onClick={() => selectCorpus(corpus.id)}
                            className="rounded border border-outline-variant px-3 py-1 text-sm text-on-surface hover:bg-surface-container-high"
                          >
                            Make Active
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${corpus.name}`}
                          onClick={() => void handleDeleteRow(corpus.id, corpus.name)}
                          className="rounded border border-error/40 px-3 py-1 text-sm text-error hover:bg-error-container/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <CorpusRowDocumentPreview
                      corpusId={corpus.id}
                      documents={documentsByCorpus.get(corpus.id) ?? []}
                      isExpanded={expandedCorpusIds.has(corpus.id)}
                      onToggleExpanded={() => toggleExpanded(corpus.id)}
                      onDocumentOpen={onDocumentOpen}
                      onDeleteDocument={setPendingDeleteDocument}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {pendingDeleteDocument && (
        <ConfirmModal
          title="Delete document"
          message={`Delete "${pendingDeleteDocument.name}"? This removes it from the system entirely and cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => void handleConfirmDeleteDocument(pendingDeleteDocument)}
          onCancel={() => setPendingDeleteDocument(null)}
        />
      )}
    </AppShell>
  )
}
