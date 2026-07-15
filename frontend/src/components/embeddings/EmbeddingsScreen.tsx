import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useChunkEmbeddings } from '../../hooks/useChunkEmbeddings'
import { useCorpus } from '../../context/CorpusContext'

export interface EmbeddingsScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function EmbeddingsScreen({ onNavigate }: EmbeddingsScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')

  const {
    documents,
    models,
    savedChunks,
    generateStatus,
    progressPercent,
    preview,
    generate,
    saveStatus,
    saveProgressPercent,
    save,
    hasSavedOnce,
  } = useChunkEmbeddings(activeCorpusId, selectedDocumentId || null)

  // Keeps selectedDocumentId itself valid once documents load, so the hook call above
  // (and not just the display value below) receives the auto-selected document — otherwise,
  // with only one document, nothing ever sets selectedDocumentId and saved chunks never load.
  useEffect(() => {
    setSelectedDocumentId((prev) => (documents.some((doc) => doc.id === prev) ? prev : documents[0]?.id ?? ''))
  }, [documents])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
  const activeModel = selectedModel || models[0]?.id || ''

  return (
    <AppShell activeScreen="embeddings" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Embeddings</h1>
          <p className="mt-2 text-on-surface-variant">
            Generate and save embeddings for a document's saved chunks.
          </p>
        </div>

        {documents.length === 0 ? (
          <p className="mt-8 text-on-surface-variant">
            No documents available. Upload a PDF from the Sources screen first.
          </p>
        ) : (
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div
              data-testid="embeddings-control-bar"
              className="flex shrink-0 flex-wrap items-end gap-6 border-b border-outline-variant pb-4"
            >
              <div>
                <label
                  className="block text-sm text-on-surface-variant"
                  htmlFor="embeddings-document"
                >
                  Select Document
                </label>
                <select
                  id="embeddings-document"
                  aria-label="Select document"
                  value={activeDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
                  className="mt-1 rounded border border-outline-variant bg-surface p-2 text-on-surface"
                >
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-sm text-on-surface-variant"
                  htmlFor="embeddings-model"
                >
                  Embedding Model
                </label>
                <select
                  id="embeddings-model"
                  aria-label="Embedding model"
                  value={activeModel}
                  onChange={(event) => setSelectedModel(event.target.value)}
                  className="mt-1 rounded border border-outline-variant bg-surface p-2 text-on-surface"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {generateStatus === 'generating' && (
              <div className="mt-4 shrink-0">
                <div
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded bg-surface-container"
                >
                  <div
                    className="h-full bg-primary-container transition-[width]"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Generating embeddings… {progressPercent}%
                </p>
              </div>
            )}

            {generateStatus === 'error' && (
              <p role="alert" className="mt-2 shrink-0 text-sm text-error">
                Embeddings could not be generated. Please try again.
              </p>
            )}

            <div
              data-testid="embeddings-chunk-list"
              className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
            >
              {savedChunks.length === 0 ? (
                <p className="text-on-surface-variant">
                  No saved chunks for this document yet. Save chunks from the Chunking screen
                  first.
                </p>
              ) : (
                savedChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-lg border border-outline-variant bg-surface-container p-4"
                  >
                    <div className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</div>
                    <p className="mt-2 text-on-surface">{chunk.content}</p>
                  </div>
                ))
              )}

              {generateStatus === 'success' && preview && (
                <p className="text-sm text-on-surface-variant">
                  {preview.vectors.length} embeddings generated (not yet saved).
                </p>
              )}
            </div>

            {saveStatus === 'saving' && (
              <div data-testid="embeddings-save-progress" className="mt-4 shrink-0">
                <div
                  role="progressbar"
                  aria-valuenow={saveProgressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-2 w-full overflow-hidden rounded bg-surface-container"
                >
                  <div
                    className="h-full bg-primary-container transition-[width]"
                    style={{ width: `${saveProgressPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Saving embeddings… {saveProgressPercent}%
                </p>
              </div>
            )}

            {saveStatus === 'error' && (
              <p role="alert" className="mt-2 shrink-0 text-sm text-error">
                Embeddings could not be saved. Please try again.
              </p>
            )}

            <div className="mt-4 flex shrink-0 items-center justify-end gap-3 border-t border-outline-variant pt-4">
              <button
                type="button"
                onClick={() => generate(activeDocumentId, activeModel)}
                disabled={savedChunks.length === 0 || generateStatus === 'generating'}
                className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
              >
                Generate Embeddings
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={preview === null || saveStatus === 'saving'}
                className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => onNavigate('vector-view')}
                disabled={!hasSavedOnce}
                className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
              >
                Move to Vector View
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
