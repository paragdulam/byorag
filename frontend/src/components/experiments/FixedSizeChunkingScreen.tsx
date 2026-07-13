import { useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useFixedSizeChunking } from '../../hooks/useFixedSizeChunking'

export interface FixedSizeChunkingScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function FixedSizeChunkingScreen({ onNavigate }: FixedSizeChunkingScreenProps) {
  const { documents, status, result, run } = useFixedSizeChunking()

  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [chunkSizeInput, setChunkSizeInput] = useState('512')
  const [validationError, setValidationError] = useState<string | null>(null)

  // Reference-design controls (User Story 3): visible for design completeness,
  // but purely local/cosmetic — none of these affect the chunking request,
  // which always runs the "fixed-size" strategy regardless of this selection.
  const [inertAlgorithm, setInertAlgorithm] = useState<
    'recursive-character' | 'semantic-chunking' | 'fixed-size'
  >('fixed-size')
  const [inertOverlap, setInertOverlap] = useState(50)

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
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">Fixed Size Chunking</h1>
        <p className="mt-2 text-on-surface-variant">Configure how documents are partitioned.</p>
      </div>

      {documents.length === 0 ? (
        <p className="mt-8 text-on-surface-variant">
          No documents available. Upload a PDF from the Sources screen first.
        </p>
      ) : (
        <div className="mt-8 flex gap-8">
          <div className="w-80 shrink-0 rounded-lg border border-outline-variant bg-surface-container p-6">
            <div className="font-mono text-xs font-medium tracking-widest text-on-surface-variant">
              ALGORITHM
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {(
                [
                  { id: 'recursive-character', label: 'Recursive Character' },
                  { id: 'semantic-chunking', label: 'Semantic Chunking' },
                  { id: 'fixed-size', label: 'Fixed Size' },
                ] as const
              ).map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 rounded border border-outline-variant px-3 py-2 text-sm text-on-surface"
                >
                  <input
                    type="radio"
                    name="chunking-algorithm"
                    aria-label={option.label}
                    checked={inertAlgorithm === option.id}
                    onChange={() => setInertAlgorithm(option.id)}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            <label
              className="mt-4 block text-sm text-on-surface-variant"
              htmlFor="chunking-document"
            >
              Select document
            </label>
            <select
              id="chunking-document"
              aria-label="Select document"
              value={activeDocumentId}
              onChange={(event) => setSelectedDocumentId(event.target.value)}
              className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>

            <label
              className="mt-4 block text-sm text-on-surface-variant"
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
              className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
            />

            {validationError && (
              <p role="alert" className="mt-2 text-sm text-error">
                {validationError}
              </p>
            )}

            <label className="mt-4 block text-sm text-on-surface-variant" htmlFor="chunking-overlap">
              Overlap
            </label>
            <input
              id="chunking-overlap"
              aria-label="Overlap"
              type="range"
              min={0}
              max={200}
              value={inertOverlap}
              onChange={(event) => setInertOverlap(Number(event.target.value))}
              className="mt-1 w-full"
            />

            <div className="mt-4 font-mono text-xs font-medium tracking-widest text-on-surface-variant">
              SEPARATORS
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {['"\\n\\n"', '"\\n"', '" "', '""'].map((separator) => (
                <button
                  key={separator}
                  type="button"
                  className="rounded border border-outline-variant px-3 py-1 font-mono text-xs text-on-surface"
                >
                  {separator}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRunChunking}
              disabled={status === 'running'}
              className="mt-4 w-full rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
            >
              Re-Calculate Chunks
            </button>
          </div>

          <div className="flex-1">
            {status === 'running' && (
              <p className="text-on-surface-variant" role="status">
                Chunking…
              </p>
            )}

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
              <div className="flex flex-col gap-3">
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
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}
