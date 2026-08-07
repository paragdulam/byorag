import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useVectorView } from '../../hooks/useVectorView'
import { useEmbeddingProjection, MIN_PROJECTION_ENTRIES } from '../../hooks/useEmbeddingProjection'
import type { ProjectionDocumentGroup } from '../../hooks/useEmbeddingProjection'
import { EmbeddingProjectionView } from '../embeddings/EmbeddingProjectionView'
import { useCorpus } from '../../context/CorpusContext'
import { ENTIRE_CORPUS_SELECTION, isEntireCorpusSelection } from '../../lib/entireCorpusSelection'

export interface VectorViewScreenProps {
  onNavigate: (screen: ScreenId) => void
  /** A saved chunk to select directly, per a deep link (034-more-deep-links). */
  linkedChunkId?: string | null
  /** Called whenever the selected chunk changes (deep link open, or a plain in-app click), so
   * the caller can keep the URL in sync. */
  onChunkLinked?: (chunkId: string) => void
}

const VECTOR_GRID_COLUMNS = 8

export function VectorViewScreen({ onNavigate, linkedChunkId, onChunkLinked }: VectorViewScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [selectedChunkId, setSelectedChunkId] = useState<string>('')
  const [selectedEmbeddingId, setSelectedEmbeddingId] = useState<string>('')
  const [selectedProjectionMethodId, setSelectedProjectionMethodId] = useState<string>('')

  const { documents, savedChunks, savedEmbeddings, projectionMethods, isEntireCorpus, chunkGroups } =
    useVectorView(activeCorpusId, selectedDocumentId || null, selectedChunkId || null)

  // Deep link (034-more-deep-links): a linked chunk could belong to a document other than the
  // one currently selected, so force "Entire Corpus" scope to guarantee it's reachable — but
  // only when it actually isn't already in the current single-document scope. Without that
  // check, this fired on *every* click (selecting a chunk pushes its id into the URL via
  // `onChunkLinked`, which becomes the next `linkedChunkId`), yanking the scope back to Entire
  // Corpus after every single click even within one document.
  useEffect(() => {
    if (
      linkedChunkId != null &&
      !isEntireCorpus &&
      !savedChunks.some((chunk) => chunk.id === linkedChunkId)
    ) {
      setSelectedDocumentId(ENTIRE_CORPUS_SELECTION)
    }
  }, [linkedChunkId, savedChunks, isEntireCorpus])

  // Keeps selectedDocumentId/selectedChunkId themselves valid once their source lists load,
  // so the hook call above (and not just the display values below) receives the auto-selected
  // ids — otherwise, with only one document/chunk, nothing ever sets the raw selection state
  // and saved chunks/embeddings never load. See EmbeddingsScreen.tsx for the same pattern.
  // "Entire Corpus" is always a valid selection regardless of the current document list
  // (018-ui-polish-batch) — it must never be reset back to a single document here.
  useEffect(() => {
    setSelectedDocumentId((prev) =>
      documents.some((doc) => doc.id === prev) || isEntireCorpusSelection(prev)
        ? prev
        : (documents[0]?.id ?? ''),
    )
  }, [documents])

  const flatChunks = isEntireCorpus ? chunkGroups.flatMap((group) => group.chunks) : savedChunks

  useEffect(() => {
    setSelectedChunkId((prev) => {
      if (linkedChunkId != null && flatChunks.some((chunk) => chunk.id === linkedChunkId)) {
        return linkedChunkId
      }
      return flatChunks.some((chunk) => chunk.id === prev) ? prev : (flatChunks[0]?.id ?? '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatChunks, linkedChunkId])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
  const activeChunkId = selectedChunkId || flatChunks[0]?.id || ''
  // Falls back to the newest saved embedding (savedEmbeddings[0], per the API's newest-first
  // ordering) whenever the current selection doesn't belong to the active chunk's list —
  // e.g. right after switching chunks — without needing a separate reset effect.
  const activeEmbedding = savedEmbeddings.find((e) => e.id === selectedEmbeddingId) ?? savedEmbeddings[0]
  const activeProjectionMethod =
    projectionMethods.find((m) => m.id === selectedProjectionMethodId) ??
    projectionMethods.find((m) => m.available) ??
    projectionMethods[0]

  // Groups feeding the UMAP/PCA projection (021-sources-chunking-embeddings-refresh US4): every
  // document's chunks in "Entire Corpus" scope, or just the selected document's otherwise —
  // independent of which single chunk happens to be selected in the left-side list.
  const projectionGroups = useMemo<ProjectionDocumentGroup[]>(() => {
    if (isEntireCorpus) {
      return chunkGroups
    }
    if (activeDocumentId === '') {
      return []
    }
    const doc = documents.find((d) => d.id === activeDocumentId)
    return [{ documentId: activeDocumentId, documentName: doc?.name ?? activeDocumentId, chunks: savedChunks }]
  }, [isEntireCorpus, chunkGroups, activeDocumentId, documents, savedChunks])

  const projection = useEmbeddingProjection(projectionGroups, activeProjectionMethod?.id ?? '')
  const isProjectionMethod = activeProjectionMethod?.id === 'umap' || activeProjectionMethod?.id === 'pca'

  const selectChunk = (chunkId: string) => {
    setSelectedChunkId(chunkId)
    setSelectedEmbeddingId('')
    onChunkLinked?.(chunkId)
  }

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
                <option value={ENTIRE_CORPUS_SELECTION}>Entire Corpus</option>
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
                {isEntireCorpus ? (
                  chunkGroups.length === 0 ? (
                    <p className="text-on-surface-variant">
                      No saved chunks for this document yet. Save chunks from the Chunking screen
                      first.
                    </p>
                  ) : (
                    chunkGroups.map((group) => (
                      <div key={group.documentId} data-testid={`vector-view-chunk-group-${group.documentId}`}>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                          {group.documentName}
                        </div>
                        <div className="flex flex-col gap-3">
                          {group.chunks.map((chunk) => (
                            <button
                              key={chunk.id}
                              type="button"
                              data-testid={`vector-view-chunk-${chunk.id}`}
                              aria-label={`Select chunk ${chunk.index}`}
                              aria-pressed={chunk.id === activeChunkId}
                              onClick={() => selectChunk(chunk.id)}
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
                          ))}
                        </div>
                      </div>
                    ))
                  )
                ) : savedChunks.length === 0 ? (
                  <p className="text-on-surface-variant">
                    No saved chunks for this document yet. Save chunks from the Chunking screen
                    first.
                  </p>
                ) : (
                  savedChunks.map((chunk) => (
                    <button
                      key={chunk.id}
                      type="button"
                      data-testid={`vector-view-chunk-${chunk.id}`}
                      aria-label={`Select chunk ${chunk.index}`}
                      aria-pressed={chunk.id === activeChunkId}
                      onClick={() => selectChunk(chunk.id)}
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
                    {projectionMethods.map((method) => {
                      const needsMinimum = method.id === 'umap' || method.id === 'pca'
                      const belowMinimum =
                        needsMinimum &&
                        !projection.isResolvingEntries &&
                        projection.entryCount < MIN_PROJECTION_ENTRIES
                      return (
                        <option key={method.id} value={method.id} disabled={!method.available || belowMinimum}>
                          {method.label}
                          {!method.available ? ' (coming soon)' : ''}
                          {method.available && belowMinimum ? ` (needs ${MIN_PROJECTION_ENTRIES}+ embedded chunks)` : ''}
                        </option>
                      )
                    })}
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
                  ) : isProjectionMethod ? (
                    projection.isResolvingEntries ? (
                      <p className="text-on-surface-variant">Resolving embedded chunks…</p>
                    ) : projection.entryCount < MIN_PROJECTION_ENTRIES ? (
                      <p data-testid="projection-minimum-message" className="text-on-surface-variant">
                        At least {MIN_PROJECTION_ENTRIES} embedded chunks are required to compute a
                        projection ({projection.entryCount} available).
                      </p>
                    ) : projection.isComputing ? (
                      <p className="text-on-surface-variant">Computing projection…</p>
                    ) : projection.error ? (
                      <p role="alert" className="text-error">
                        {projection.error}
                      </p>
                    ) : projection.points ? (
                      <>
                        <EmbeddingProjectionView points={projection.points} groupByDocument={isEntireCorpus} />
                        {projection.excludedDocuments.length > 0 && (
                          <p
                            data-testid="projection-excluded-documents"
                            className="mt-2 text-xs text-on-surface-variant"
                          >
                            Excluded (no saved embeddings):{' '}
                            {projection.excludedDocuments.map((d) => d.documentName).join(', ')}
                          </p>
                        )}
                      </>
                    ) : null
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
            onClick={() => onNavigate('golden-dataset')}
            className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
          >
            Move to Golden Dataset
          </button>
        </div>
      </div>
    </AppShell>
  )
}
