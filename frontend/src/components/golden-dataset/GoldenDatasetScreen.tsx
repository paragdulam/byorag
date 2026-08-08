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
  /** An entry to open directly, per a deep link (032-deep-linking FR-007). */
  linkedEntryId?: string | null
  /** Called when the linked entry above is collapsed, so the caller can drop `entryId` from
   * the URL. */
  onCloseLinkedEntry?: () => void
  /** Called whenever a *different* entry is expanded via a plain in-app click, so the caller
   * can keep the URL in sync (034-more-deep-links). */
  onEntryOpened?: (entryId: string) => void
  /** Whether the "Write Manually" creation form should be open directly, per a deep link
   * (034-more-deep-links). */
  isCreatingEntry?: boolean
  /** Called whenever the "Write Manually" form opens or closes, so the caller can keep the URL
   * in sync. */
  onCreatingEntryChanged?: (isCreating: boolean) => void
  /** A document/scope to select directly, per a deep link (035-document-scope-deep-links) — a
   * real document id or the `ENTIRE_CORPUS_SELECTION` sentinel. */
  linkedDocumentId?: string | null
  /** Called whenever the "Scope" dropdown changes, so the caller can keep the URL in sync. */
  onDocumentSelected?: (documentId: string) => void
}

export function GoldenDatasetScreen({
  onNavigate,
  linkedEntryId,
  onCloseLinkedEntry,
  onEntryOpened,
  isCreatingEntry,
  onCreatingEntryChanged,
  linkedDocumentId,
  onDocumentSelected,
}: GoldenDatasetScreenProps) {
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

  // Deep link (034-more-deep-links): opens the "Write Manually" form directly.
  useEffect(() => {
    if (isCreatingEntry) {
      setIsCreatingManually(true)
    }
  }, [isCreatingEntry])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
  const isEntireCorpus = isEntireCorpusSelection(activeDocumentId)

  // 032-deep-linking FR-007: a deep-linked entry may belong to a document other than the one
  // currently selected, so force "Entire Corpus" scope to guarantee it's among the rows
  // GoldenEntryList renders — but only when it actually isn't already in the current
  // single-document scope. Without that check, this fired on *every* click too (expanding an
  // entry pushes its id into the URL via `onEntryOpened`, which becomes the next
  // `linkedEntryId`), yanking the scope back to Entire Corpus after every single click even
  // within one document (034-more-deep-links).
  useEffect(() => {
    if (linkedEntryId == null || isEntireCorpus) {
      return
    }
    const entry = entries.find((candidate) => candidate.id === linkedEntryId)
    if (entry !== undefined && entry.documentId !== activeDocumentId) {
      setSelectedDocumentId(ENTIRE_CORPUS_SELECTION)
    }
  }, [linkedEntryId, entries, activeDocumentId, isEntireCorpus])

  // Deep link (035-document-scope-deep-links): selects the linked document/scope — runs after
  // the linkedEntryId effect above so an explicit ?documentId= wins over the entry's own forced
  // Entire Corpus fallback. Guarded on "not already selected" so it doesn't refire every time
  // `selectDocument` echoes its own choice back in as the next `linkedDocumentId` (same
  // self-triggering-loop fix as the linkedEntryId effect above).
  useEffect(() => {
    if (
      linkedDocumentId != null &&
      linkedDocumentId !== activeDocumentId &&
      (isEntireCorpusSelection(linkedDocumentId) || documents.some((doc) => doc.id === linkedDocumentId))
    ) {
      setSelectedDocumentId(linkedDocumentId)
    }
  }, [linkedDocumentId, documents, activeDocumentId])

  // 030-golden-dataset-entry-detail US1: `entries` is always every entry in the corpus —
  // narrow it to the current scope-dropdown selection before rendering anything derived from
  // it, so the Pending Review section and the main list both stay consistent with the
  // dropdown instead of always showing the same unfiltered set.
  const scopedEntries = isEntireCorpus
    ? entries
    : entries.filter((entry) => entry.documentId === activeDocumentId)

  // Only built/passed when "Entire Corpus" is selected — GoldenEntryList shows each row's
  // owning document name in that case, since the list is otherwise a mix of documents.
  const documentNameById =
    isEntireCorpus ? new Map(documents.map((doc) => [doc.id, doc.name])) : undefined

  function handleSaved(_entry: GoldenEntry) {
    setIsCreatingManually(false)
    onCreatingEntryChanged?.(false)
    refreshEntries()
  }

  function openManualCreation() {
    setIsCreatingManually(true)
    onCreatingEntryChanged?.(true)
  }

  function cancelManualCreation() {
    setIsCreatingManually(false)
    onCreatingEntryChanged?.(false)
  }

  function selectDocument(documentId: string) {
    setSelectedDocumentId(documentId)
    onDocumentSelected?.(documentId)
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
                    onChange={(event) => selectDocument(event.target.value)}
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
                    onClick={openManualCreation}
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
                      onCancel={cancelManualCreation}
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
                  {/* Still render the list (rather than the empty message) when a specific entry
                      is linked, even if `scopedEntries` is momentarily/genuinely empty — that's
                      what lets GoldenEntryList's own not-found fetch surface the precise
                      "this entry no longer exists" message (032-deep-linking FR-009) instead of
                      the generic empty-corpus message below. */}
                  {scopedEntries.length === 0 && linkedEntryId == null ? (
                    <p className="text-on-surface-variant">No golden dataset entries yet.</p>
                  ) : (
                    <GoldenEntryList
                      entries={scopedEntries}
                      corpusId={activeCorpusId}
                      onDelete={handleDelete}
                      documentNames={documentNameById}
                      linkedEntryId={linkedEntryId}
                      onCloseLinkedEntry={onCloseLinkedEntry}
                      onEntryOpened={onEntryOpened}
                    />
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
