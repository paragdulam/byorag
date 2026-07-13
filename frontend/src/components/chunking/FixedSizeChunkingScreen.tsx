import { useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useFixedSizeChunking } from '../../hooks/useFixedSizeChunking'

export interface FixedSizeChunkingScreenProps {
  onNavigate: (screen: ScreenId) => void
}

const SEPARATOR_OPTIONS = ['"\\n\\n"', '"\\n"', '" "', '""']

export function FixedSizeChunkingScreen({ onNavigate }: FixedSizeChunkingScreenProps) {
  const { documents, status, progressPercent, result, hasSucceededOnce, run } =
    useFixedSizeChunking()

  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [chunkSizeInput, setChunkSizeInput] = useState('512')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Overlap stays inert/cosmetic (FR-008, spec.md Assumptions) — it is not sent to the backend.
  const [overlapValue, setOverlapValue] = useState(50)

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''

  const handleRunChunking = () => {
    const chunkSize = Number(chunkSizeInput)
    if (!Number.isFinite(chunkSize) || chunkSize <= 0) {
      setValidationError('Enter a chunk size greater than zero.')
      return
    }
    setValidationError(null)
    run(activeDocumentId, chunkSize)
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
                <input
                  id="chunking-overlap"
                  aria-label="Overlap"
                  type="range"
                  min={0}
                  max={200}
                  value={overlapValue}
                  onChange={(event) => setOverlapValue(Number(event.target.value))}
                  className="mt-1"
                />
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

            {status === 'running' && (
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
                  Chunking… {progressPercent}%
                </p>
              </div>
            )}

            <div
              data-testid="chunk-list"
              className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
            >
              {status === 'extraction-failed' && (
                <p role="alert" className="text-error">
                  Text could not be extracted from this document.
                </p>
              )}

              {status === 'error' && (
                <p role="alert" className="text-error">
                  Something went wrong while chunking this document. Please try again.
                </p>
              )}

              {status === 'success' && result && (
                <>
                  {result.chunks.map((chunk) => (
                    <div
                      key={chunk.index}
                      className="rounded-lg border border-outline-variant bg-surface-container p-4"
                    >
                      <div className="font-mono text-xs text-tertiary">CHUNK_{chunk.index}</div>
                      <p className="mt-2 text-on-surface">{chunk.content}</p>
                    </div>
                  ))}

                  {result.totalChunks > result.chunks.length && (
                    <p className="text-sm text-on-surface-variant">
                      More chunks exist beyond the {result.chunks.length} shown here (
                      {result.totalChunks} total).
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 flex shrink-0 justify-end gap-3 border-t border-outline-variant pt-4">
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
                onClick={() => onNavigate('embeddings')}
                disabled={!hasSucceededOnce}
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
