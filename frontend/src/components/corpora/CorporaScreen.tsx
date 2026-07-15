import { useEffect, useState, type SubmitEvent } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useCorpus } from '../../context/CorpusContext'
import {
  attachDocumentToCorpus,
  listAllSources,
  listSources,
  removeDocumentFromCorpus,
} from '../../lib/sourcesApi'
import type { DocumentWithCorpora, SourceDocument } from '../../types/sourceDocument'

export interface CorporaScreenProps {
  onNavigate: (screen: ScreenId) => void
}

function CorpusDocumentsPanel({
  corpusId,
  corpusName,
}: {
  corpusId: string
  corpusName: string
}) {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [allDocuments, setAllDocuments] = useState<DocumentWithCorpora[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setIsLoading(true)
    Promise.all([listSources(corpusId), listAllSources()])
      .then(([scoped, all]) => {
        setDocuments(scoped)
        setAllDocuments(all)
      })
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corpusId])

  const candidates = allDocuments.filter((doc) => !doc.corpusIds.includes(corpusId))

  const handleAttach = async (documentId: string) => {
    if (!documentId) {
      return
    }
    try {
      await attachDocumentToCorpus(documentId, corpusId)
      refresh()
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : 'Failed to add document')
    }
  }

  const handleRemove = async (documentId: string) => {
    try {
      await removeDocumentFromCorpus(documentId, corpusId)
      refresh()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove document')
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-outline-variant bg-surface-container p-6">
      <h2 className="text-xl font-semibold text-on-surface">Documents in {corpusName}</h2>

      {error && (
        <p role="alert" className="mt-3 text-sm text-error">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-4 text-on-surface-variant" role="status">
          Loading documents…
        </p>
      ) : (
        <>
          {documents.length === 0 ? (
            <p className="mt-4 text-on-surface-variant">No documents in this corpus yet.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2" data-testid="corpus-documents-list">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded border border-outline-variant px-4 py-2"
                >
                  <span className="text-on-surface">{doc.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${doc.name} from this corpus`}
                    onClick={() => handleRemove(doc.id)}
                    className="rounded border border-outline-variant px-3 py-1 text-sm text-on-surface hover:bg-surface-container-high"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4">
            <label htmlFor="add-existing-document" className="sr-only">
              Add existing document to {corpusName}
            </label>
            <select
              id="add-existing-document"
              aria-label={`Add existing document to ${corpusName}`}
              defaultValue=""
              disabled={candidates.length === 0}
              onChange={(event) => {
                void handleAttach(event.target.value)
                event.target.value = ''
              }}
              className="rounded border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-50"
            >
              <option value="" disabled>
                {candidates.length === 0 ? 'No other documents to add' : 'Add existing document…'}
              </option>
              {candidates.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}

export function CorporaScreen({ onNavigate }: CorporaScreenProps) {
  const { corpora, activeCorpusId, isLoading, selectCorpus, createCorpus, deleteCorpus } = useCorpus()
  const [isCreating, setIsCreating] = useState(false)
  const [newCorpusName, setNewCorpusName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const activeCorpus = corpora.find((corpus) => corpus.id === activeCorpusId) ?? null

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
                    role="button"
                    tabIndex={0}
                    onClick={() => selectCorpus(corpus.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        selectCorpus(corpus.id)
                      }
                    }}
                    className={
                      'flex w-full items-center justify-between border-b border-outline-variant px-6 py-4 last:border-b-0 ' +
                      (isActive
                        ? 'bg-primary-container/20 text-on-surface'
                        : 'cursor-pointer text-on-surface hover:bg-surface-container-high')
                    }
                  >
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
                          onClick={(event) => {
                            event.stopPropagation()
                            selectCorpus(corpus.id)
                          }}
                          className="rounded border border-outline-variant px-3 py-1 text-sm text-on-surface hover:bg-surface-container-high"
                        >
                          Make Active
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${corpus.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleDeleteRow(corpus.id, corpus.name)
                        }}
                        className="rounded border border-error/40 px-3 py-1 text-sm text-error hover:bg-error-container/10"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {activeCorpus && (
        <CorpusDocumentsPanel corpusId={activeCorpus.id} corpusName={activeCorpus.name} />
      )}
    </AppShell>
  )
}
