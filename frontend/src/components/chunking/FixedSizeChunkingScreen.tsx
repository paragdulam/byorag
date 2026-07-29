import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useFixedSizeChunking } from '../../hooks/useFixedSizeChunking'
import { useCorpus } from '../../context/CorpusContext'
import { ENTIRE_CORPUS_SELECTION } from '../../lib/entireCorpusSelection'
import { BatchProgressBar } from '../shared/BatchProgressBar'
import { AlreadyDoneIndicator } from '../shared/AlreadyDoneIndicator'
import { EntireCorpusSummaryList } from '../shared/EntireCorpusSummaryList'
import { ChunkInContextPreview } from './ChunkInContextPreview'

export interface FixedSizeChunkingScreenProps {
  onNavigate: (screen: ScreenId) => void
}

const SEPARATOR_OPTIONS = ['"\\n\\n"', '"\\n"', '" "', '""']

export function FixedSizeChunkingScreen({ onNavigate }: FixedSizeChunkingScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const {
    documents,
    activeDocumentId,
    status,
    progressPercent,
    result,
    chunkOrigin,
    saveStatus,
    saveProgressPercent,
    hasSavedOnce,
    isSaved,
    isEntireCorpus,
    batchProgress,
    batchResults,
    run,
    save,
  } = useFixedSizeChunking(activeCorpusId, selectedDocumentId)

  const [chunkSizeInput, setChunkSizeInput] = useState('512')
  const [validationError, setValidationError] = useState<string | null>(null)

  const [overlapValue, setOverlapValue] = useState(50)
  const [selectedChunkIndex, setSelectedChunkIndex] = useState(0)

  // Re-defaults to the first chunk whenever a new saved-chunks result loads
  // (023-pdf-fullscreen-chunk-view FR-007).
  useEffect(() => {
    setSelectedChunkIndex(0)
  }, [result])

  const isAutoLoaded = chunkOrigin === 'auto-loaded' && status === 'success'

  const handleRunChunking = () => {
    const chunkSize = Number(chunkSizeInput)
    if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
      setValidationError('Enter a chunk size greater than zero.')
      return
    }
    if (overlapValue >= chunkSize) {
      setValidationError('Overlap must be smaller than Chunk Size.')
      return
    }
    setValidationError(null)
    run(activeDocumentId, chunkSize, overlapValue)
  }

  return (
    <AppShell activeScreen="fixed-size-chunking" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Fixed Size Chunking
          </h1>
          <p className="mt-2 text-on-surface-variant">Configure how documents are partitioned.</p>
        </div>

        {documents.length === 0 ? (
          <p className="mt-8 text-on-surface-variant">
            No documents available. Upload a PDF from the Sources screen first.
          </p>
        ) : (
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div
              data-testid="chunking-control-bar"
              className="flex shrink-0 flex-wrap items-end gap-6 border-b border-outline-variant pb-4"
            >
              <div>
                <label
                  className="block text-sm text-on-surface-variant"
                  htmlFor="chunking-document"
                >
                  Select Document
                </label>
                <select
                  id="chunking-document"
                  aria-label="Select document"
                  value={activeDocumentId}
                  onChange={(event) => setSelectedDocumentId(event.target.value)}
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

              <div>
                <label
                  className="block text-sm text-on-surface-variant"
                  htmlFor="chunking-chunk-size"
                >
                  Chunk Size
                </label>
                <input
                  id="chunking-chunk-size"
                  aria-label="Chunk size"
                  type="number"
                  value={chunkSizeInput}
                  onChange={(event) => setChunkSizeInput(event.target.value)}
                  className="mt-1 w-28 rounded border border-outline-variant bg-surface p-2 text-on-surface"
                />
              </div>

              <div>
                <label
                  className="block text-sm text-on-surface-variant"
                  htmlFor="chunking-overlap"
                >
                  Overlap
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="chunking-overlap"
                    aria-label="Overlap"
                    type="range"
                    min={0}
                    max={200}
                    value={overlapValue}
                    onChange={(event) => setOverlapValue(Number(event.target.value))}
                  />
                  <span
                    data-testid="overlap-value"
                    className="w-8 text-right text-sm tabular-nums text-on-surface"
                  >
                    {overlapValue}
                  </span>
                </div>
                {status === 'success' && result && (
                  <div
                    data-testid="overlap-chunk-count"
                    className="mt-1 text-right text-xs text-on-surface-variant"
                  >
                    {result.totalChunks} chunks
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm text-on-surface-variant">Separators</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SEPARATOR_OPTIONS.map((separator) => (
                    <button
                      key={separator}
                      type="button"
                      className="rounded border border-outline-variant px-3 py-1 font-mono text-xs text-on-surface"
                    >
                      {separator}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {validationError && (
              <p role="alert" className="mt-2 shrink-0 text-sm text-error">
                {validationError}
              </p>
            )}

            {isAutoLoaded && (
              <AlreadyDoneIndicator
                verb="Chunking"
                noun="chunks"
                scope={isEntireCorpus ? 'corpus' : 'document'}
              />
            )}

            {status === 'running' && (
              <div className="mt-4 shrink-0">
                {isEntireCorpus && batchProgress ? (
                  <BatchProgressBar progress={batchProgress} />
                ) : (
                  <>
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
                      Chunking… {progressPercent}%
                    </p>
                  </>
                )}
              </div>
            )}

            <div
              data-testid="chunk-list"
              className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
            >
              {isEntireCorpus && batchResults.length > 0 ? (
                <EntireCorpusSummaryList
                  results={batchResults}
                  formatSuccessLabel={(result) => `${result.result?.totalChunks ?? 0} chunks`}
                />
              ) : (
                <>
                  {status === 'extraction-failed' && (
                    <p role="alert" className="text-error">
                      Text could not be extracted from this document.
                    </p>
                  )}

                  {status === 'error' && !isEntireCorpus && (
                    <p role="alert" className="text-error">
                      Something went wrong while chunking this document. Please try again.
                    </p>
                  )}

                  {status === 'success' && result && (
                    <div className="flex min-h-0 flex-1 gap-4">
                      <div className="flex w-1/2 flex-col gap-3 overflow-y-auto">
                        {result.chunks.map((chunk) => (
                          <button
                            key={chunk.index}
                            type="button"
                            aria-current={chunk.index === selectedChunkIndex ? 'true' : undefined}
                            onClick={() => setSelectedChunkIndex(chunk.index)}
                            className={
                              'rounded-lg border p-4 text-left ' +
                              (chunk.index === selectedChunkIndex
                                ? 'border-primary bg-surface-container-high'
                                : 'border-outline-variant bg-surface-container')
                            }
                          >
                            <div className="font-mono text-xs text-tertiary">
                              CHUNK_{chunk.index}
                            </div>
                            <p className="mt-2 text-on-surface">{chunk.content}</p>
                          </button>
                        ))}

                        {result.totalChunks > result.chunks.length && (
                          <p className="text-sm text-on-surface-variant">
                            More chunks exist beyond the {result.chunks.length} shown here (
                            {result.totalChunks} total).
                          </p>
                        )}
                      </div>

                      <div
                        data-testid="chunk-context-preview"
                        className="w-1/2 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container"
                      >
                        <ChunkInContextPreview
                          documentId={activeDocumentId}
                          selectedChunkIndex={selectedChunkIndex}
                          hasUnsavedChanges={chunkOrigin === 'computed' && !isSaved}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {saveStatus === 'saving' && (
              <div data-testid="save-progress" className="mt-4 shrink-0">
                {isEntireCorpus && batchProgress ? (
                  <BatchProgressBar progress={batchProgress} />
                ) : (
                  <>
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
                      Saving chunks… {saveProgressPercent}%
                    </p>
                  </>
                )}
              </div>
            )}

            {saveStatus === 'error' && (
              <p role="alert" className="mt-2 shrink-0 text-sm text-error">
                Chunks could not be saved. Please try again.
              </p>
            )}

            <div className="mt-4 flex shrink-0 items-center justify-end gap-3 border-t border-outline-variant pt-4">
              {status === 'success' && !isEntireCorpus && (
                <span
                  data-testid="save-status-indicator"
                  className="text-sm text-on-surface-variant"
                >
                  {isSaved ? 'Saved' : 'Not saved yet'}
                </span>
              )}
              <button
                type="button"
                onClick={handleRunChunking}
                disabled={status === 'running'}
                className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
              >
                Re-Calculate Chunks
              </button>
              <button
                type="button"
                onClick={() => save()}
                disabled={status !== 'success' || saveStatus === 'saving'}
                className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
              >
                Save Chunks
              </button>
              <button
                type="button"
                onClick={() => onNavigate('embeddings')}
                disabled={!hasSavedOnce}
                className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface disabled:opacity-50"
              >
                Move to Embeddings
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
