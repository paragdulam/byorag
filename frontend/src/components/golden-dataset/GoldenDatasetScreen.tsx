import { useCallback, useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useCorpus } from '../../context/CorpusContext'
import { ENTIRE_CORPUS_SELECTION, isEntireCorpusSelection } from '../../lib/entireCorpusSelection'
import { deleteEntry, generateEntry, listEntries } from '../../lib/goldenDatasetApi'
import { listSources } from '../../lib/sourcesApi'
import type { SourceDocument } from '../../types/sourceDocument'
import type { GoldenEntry, GoldenEntrySummary } from '../../types/goldenDataset'
import { GoldenEntryEditor } from './GoldenEntryEditor'
import { GoldenEntryList } from './GoldenEntryList'
import { GoldenReviewQueue } from './GoldenReviewQueue'
import { BatchGenerationProgress } from './BatchGenerationProgress'
import { SourceDocumentPreview } from '../sources/SourceDocumentPreview'
import type { BatchItemResult } from '../../lib/batchRunner'

export interface GoldenDatasetScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function GoldenDatasetScreen({ onNavigate }: GoldenDatasetScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [entries, setEntries] = useState<GoldenEntrySummary[]>([])
  const [isCreatingManually, setIsCreatingManually] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [batchCount, setBatchCount] = useState(3)
  const [isBatchRunning, setIsBatchRunning] = useState(false)
  const [lastBatchResults, setLastBatchResults] = useState<BatchItemResult<GoldenEntry>[] | null>(
    null,
  )
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    if (activeCorpusId === null) {
      setDocuments([])
      return
    }
    listSources(activeCorpusId).then(setDocuments)
  }, [activeCorpusId])

  const refreshEntries = useCallback(() => {
    if (activeCorpusId === null) {
      setEntries([])
      return
    }
    listEntries(activeCorpusId).then(setEntries)
  }, [activeCorpusId])

  useEffect(() => {
    refreshEntries()
  }, [refreshEntries])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
  const isEntireCorpus = isEntireCorpusSelection(activeDocumentId)

  // 030-golden-dataset-entry-detail US1: `entries` is always every entry in the corpus —
  // narrow it to the current scope-dropdown selection before rendering anything derived from
  // it, so the Pending Review section and the main list both stay consistent with the
  // dropdown instead of always showing the same unfiltered set.
  const scopedEntries = isEntireCorpus
    ? entries
    : entries.filter((entry) => entry.documentId === activeDocumentId)

  function handleSaved(_entry: GoldenEntry) {
    setIsCreatingManually(false)
    refreshEntries()
  }

  function handleEntryChanged(_entry: GoldenEntry) {
    refreshEntries()
  }

  async function handleGenerate() {
    if (activeCorpusId === null) {
      return
    }
    setGenerateError(null)
    setIsGenerating(true)
    try {
      await generateEntry(activeCorpusId, isEntireCorpus ? null : activeDocumentId)
      refreshEntries()
    } catch {
      setGenerateError('Failed to generate an entry. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  function handleBatchComplete(results: BatchItemResult<GoldenEntry>[]) {
    setIsBatchRunning(false)
    setLastBatchResults(results)
    refreshEntries()
  }

  async function handleDelete(entry: GoldenEntrySummary) {
    if (!window.confirm(`Delete "${entry.question}"?`)) {
      return
    }
    await deleteEntry(entry.id)
    refreshEntries()
  }

  const pendingEntries = scopedEntries.filter((entry) => entry.status === 'pending_review')

  return (
    <AppShell activeScreen="golden-dataset" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Golden Dataset</h1>
          <p className="mt-2 text-on-surface-variant">
            Build a reference set of questions, evidence, and answers for evaluating this
            corpus's RAG pipeline.
          </p>
        </div>

        {activeCorpusId === null ? (
          <p className="mt-8 text-on-surface-variant" role="status">
            Select or create a corpus first.
          </p>
        ) : (
          <div className="mt-6 flex min-h-0 min-w-0 flex-1 gap-6">
            {/* Stays mounted (hidden via CSS, not conditionally unmounted) while fullscreen —
                unlike Sources' left pane, this one holds ephemeral state (unsaved editor text in
                GoldenEntryEditor) that would otherwise be lost and reset on every fullscreen
                toggle, violating FR-012's "unsaved editor input... is preserved, not discarded." */}
            <div
              data-testid="golden-dataset-left-pane"
              className={
                'flex min-h-0 min-w-0 w-1/2 flex-col gap-6 overflow-y-auto ' +
                (isFullscreen ? 'hidden' : '')
              }
            >
              <div className="shrink-0">
                  <label
                    className="block text-sm text-on-surface-variant"
                    htmlFor="golden-dataset-document"
                  >
                    Scope
                  </label>
                  <select
                    id="golden-dataset-document"
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

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingManually(true)}
                    className="rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90"
                  >
                    Write Manually
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Generate with LLM
                  </button>
                  <label htmlFor="golden-dataset-batch-count" className="sr-only">
                    Batch size
                  </label>
                  <input
                    id="golden-dataset-batch-count"
                    type="number"
                    min={1}
                    max={20}
                    value={batchCount}
                    onChange={(event) => setBatchCount(Number(event.target.value) || 1)}
                    disabled={isBatchRunning}
                    className="w-16 rounded border border-outline-variant bg-surface p-2 text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLastBatchResults(null)
                      setIsBatchRunning(true)
                    }}
                    disabled={isBatchRunning}
                    className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Generate a Batch…
                  </button>
                </div>

                {generateError !== null && (
                  <p role="alert" className="shrink-0 text-sm text-error">
                    {generateError}
                  </p>
                )}

                {isBatchRunning && (
                  <div className="shrink-0 rounded-lg border border-outline-variant bg-surface-container p-3">
                    <BatchGenerationProgress
                      corpusId={activeCorpusId}
                      documentId={isEntireCorpus ? null : activeDocumentId}
                      count={batchCount}
                      onComplete={handleBatchComplete}
                    />
                  </div>
                )}

                {/* Captured directly from handleBatchComplete's own argument rather than relying
                    on BatchGenerationProgress's brief pre-unmount render of the same message —
                    that render and this component's unmount (isBatchRunning -> false) both fire
                    from the same effect-flush cycle, close enough together that the browser can
                    commit both without an observable paint in between, making the message
                    effectively invisible. Kept here instead, in state that isn't tied to
                    BatchGenerationProgress's mount lifecycle at all. */}
                {!isBatchRunning && lastBatchResults !== null && (
                  <p className="shrink-0 text-sm text-on-surface-variant">
                    {lastBatchResults.filter((result) => result.status === 'success').length} of{' '}
                    {lastBatchResults.length} entries generated successfully.
                  </p>
                )}

                {isCreatingManually && (
                  <div className="shrink-0 rounded-lg border border-outline-variant bg-surface-container p-4">
                    <GoldenEntryEditor
                      scope={{
                        corpusId: activeCorpusId,
                        documentId: isEntireCorpus ? null : activeDocumentId,
                      }}
                      onSaved={handleSaved}
                    />
                  </div>
                )}

                {pendingEntries.length > 0 && (
                  <div className="shrink-0">
                    <h2 className="text-sm font-medium text-on-surface">
                      Pending Review ({pendingEntries.length})
                    </h2>
                    <div className="mt-2">
                      <GoldenReviewQueue entries={pendingEntries} onEntryChanged={handleEntryChanged} />
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1">
                  {scopedEntries.length === 0 ? (
                    <p className="text-on-surface-variant">No golden dataset entries yet.</p>
                  ) : (
                    <GoldenEntryList entries={scopedEntries} onDelete={handleDelete} />
                  )}
                </div>
              </div>

            <div
              data-testid="golden-dataset-right-pane"
              className={
                'flex min-h-0 min-w-0 flex-col rounded-lg border border-outline-variant bg-surface-container ' +
                (isFullscreen ? 'w-full' : 'w-1/2')
              }
            >
              <SourceDocumentPreview
                documentId={isEntireCorpus ? null : activeDocumentId}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => setIsFullscreen((current) => !current)}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
