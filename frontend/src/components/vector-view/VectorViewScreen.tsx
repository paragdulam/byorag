import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useVectorView } from '../../hooks/useVectorView'
import { useCorpus } from '../../context/CorpusContext'

export interface VectorViewScreenProps {
  onNavigate: (screen: ScreenId) => void
}

const VECTOR_GRID_COLUMNS = 8

export function VectorViewScreen({ onNavigate }: VectorViewScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [selectedChunkId, setSelectedChunkId] = useState<string>('')
  const [selectedEmbeddingId, setSelectedEmbeddingId] = useState<string>('')
  const [selectedProjectionMethodId, setSelectedProjectionMethodId] = useState<string>('')

  const { documents, savedChunks, savedEmbeddings, projectionMethods } = useVectorView(
    activeCorpusId,
    selectedDocumentId || null,
    selectedChunkId || null,
  )

  // Keeps selectedDocumentId/selectedChunkId themselves valid once their source lists load,
  // so the hook call above (and not just the display values below) receives the auto-selected
  // ids — otherwise, with only one document/chunk, nothing ever sets the raw selection state
  // and saved chunks/embeddings never load. See EmbeddingsScreen.tsx for the same pattern.
  useEffect(() => {
    setSelectedDocumentId((prev) => (documents.some((doc) => doc.id === prev) ? prev : documents[0]?.id ?? ''))
  }, [documents])

  useEffect(() => {
    setSelectedChunkId((prev) => (savedChunks.some((chunk) => chunk.id === prev) ? prev : savedChunks[0]?.id ?? ''))
  }, [savedChunks])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
  const activeChunkId = selectedChunkId || savedChunks[0]?.id || ''
  // Falls back to the newest saved embedding (savedEmbeddings[0], per the API's newest-first
  // ordering) whenever the current selection doesn't belong to the active chunk's list —
  // e.g. right after switching chunks — without needing a separate reset effect.
  const activeEmbedding = savedEmbeddings.find((e) => e.id === selectedEmbeddingId) ?? savedEmbeddings[0]
  const activeProjectionMethod =
    projectionMethods.find((m) => m.id === selectedProjectionMethodId) ??
    projectionMethods.find((m) => m.available) ??
    projectionMethods[0]

  return (
    <AppShell activeScreen="vector-view" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Vector View</h1>
          <p className="mt-2 text-on-surface-variant">
            Inspect the actual vector values saved for a document's chunks.
          </p>
        </div>

        {documents.length === 0 ? (
          <p className="mt-8 text-on-surface-variant">
            No documents available. Upload a PDF from the Sources screen first.
          </p>
        ) : (
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="shrink-0">
              <label className="block text-sm text-on-surface-variant" htmlFor="vector-view-document">
                Select Document
              </label>
              <select
                id="vector-view-document"
                aria-label="Select document"
                value={activeDocumentId}
                onChange={(event) => {
                  setSelectedDocumentId(event.target.value)
                  setSelectedChunkId('')
                  setSelectedEmbeddingId('')
                }}
                className="mt-1 rounded border border-outline-variant bg-surface p-2 text-on-surface"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 gap-6">
              <div
                data-testid="vector-view-chunk-list"
                className="flex w-1/2 min-h-0 flex-col gap-3 overflow-y-auto"
              >
                {savedChunks.length === 0 ? (
                  <p className="text-on-surface-variant">
                    No saved chunks for this document yet. Save chunks from the Chunking screen
                    first.
                  </p>
                ) : (
                  savedChunks.map((chunk) => (
                    <button
                      key={chunk.id}
                      type="button"
                      aria-label={`Select chunk ${chunk.index}`}
                      aria-pressed={chunk.id === activeChunkId}
                      onClick={() => {
                        setSelectedChunkId(chunk.id)
                        setSelectedEmbeddingId('')
                      }}
                      className={
                        'rounded-lg border p-4 text-left ' +
                        (chunk.id === activeChunkId
                          ? 'border-primary-container bg-primary-container/20'
                          : 'border-outline-variant bg-surface-container')
                      }
                    >
                      <div className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</div>
                      <p className="mt-2 text-on-surface">{chunk.content}</p>
                    </button>
                  ))
                )}
              </div>

              <div className="flex w-1/2 min-h-0 flex-col">
                <div className="mb-3 shrink-0">
                  <label className="block text-sm text-on-surface-variant" htmlFor="vector-view-projection-method">
                    Projection Method
                  </label>
                  <select
                    id="vector-view-projection-method"
                    aria-label="Projection method"
                    value={activeProjectionMethod?.id ?? ''}
                    onChange={(event) => setSelectedProjectionMethodId(event.target.value)}
                    className="mt-1 rounded border border-outline-variant bg-surface p-2 text-on-surface"
                  >
                    {projectionMethods.map((method) => (
                      <option key={method.id} value={method.id}>
                        {method.label}
                        {method.available ? '' : ' (coming soon)'}
                      </option>
                    ))}
                  </select>
                </div>

                {savedEmbeddings.length > 1 && (
                  <div className="mb-3 shrink-0">
                    <label className="block text-sm text-on-surface-variant" htmlFor="vector-view-embedding">
                      Saved Embedding
                    </label>
                    <select
                      id="vector-view-embedding"
                      aria-label="Saved embedding"
                      value={activeEmbedding?.id ?? ''}
                      onChange={(event) => setSelectedEmbeddingId(event.target.value)}
                      className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
                    >
                      {savedEmbeddings.map((embedding) => (
                        <option key={embedding.id} value={embedding.id}>
                          {embedding.model} — {embedding.createdAt}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-auto">
                  {activeProjectionMethod && !activeProjectionMethod.available ? (
                    <p className="text-on-surface-variant">
                      {activeProjectionMethod.label} is not available yet.
                    </p>
                  ) : activeEmbedding ? (
                    <div
                      data-testid="vector-grid"
                      className="grid gap-1 font-mono text-xs text-on-surface"
                      style={{ gridTemplateColumns: `repeat(${VECTOR_GRID_COLUMNS}, minmax(0, 1fr))` }}
                    >
                      {activeEmbedding.vector.map((value, index) => (
                        <span
                          key={index}
                          className="rounded bg-surface-container px-1 py-0.5 text-right"
                        >
                          {value}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-on-surface-variant">
                      No saved embeddings for this chunk yet. Generate and save embeddings from the
                      Embeddings screen first.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex shrink-0 items-center justify-end gap-3 border-t border-outline-variant pt-4">
          <button
            type="button"
            onClick={() => onNavigate('playground')}
            className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
          >
            Move to Playground
          </button>
        </div>
      </div>
    </AppShell>
  )
}
