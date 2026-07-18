import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useMetrics } from '../../hooks/useMetrics'
import { fetchComparison } from '../../lib/metricsApi'
import type { PipelineSummary } from '../../types/metrics'
import { ComparisonModal } from './ComparisonModal'
import { PipelineSelector } from './PipelineSelector'
import { ScoreSummary } from './ScoreSummary'

export interface MetricsScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function MetricsScreen({ onNavigate }: MetricsScreenProps) {
  const [selectedCorpusId, setSelectedCorpusId] = useState<string | null>(null)
  const [selectedPipelineIndex, setSelectedPipelineIndex] = useState(0)
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)
  const [comparisonPipelines, setComparisonPipelines] = useState<PipelineSummary[] | null>(null)
  const { corpora, isLoadingCorpora, corporaError, pipelines, isLoadingPipelines, pipelinesError } =
    useMetrics(selectedCorpusId)

  // Auto-selects the first corpus once the list loads, and keeps the selection valid if the
  // list changes — mirrors VectorViewScreen's document auto-select pattern.
  useEffect(() => {
    setSelectedCorpusId((prev) =>
      prev !== null && corpora.some((corpus) => corpus.corpusId === prev)
        ? prev
        : (corpora[0]?.corpusId ?? null),
    )
  }, [corpora])

  // A new corpus's pipeline list always starts back at its first (often only) pipeline
  // (spec US2 Acceptance Scenario 1) rather than carrying over a stale index from whatever
  // was selected on the previous corpus.
  useEffect(() => {
    setSelectedPipelineIndex(0)
  }, [selectedCorpusId])

  const selectedCorpus = corpora.find((corpus) => corpus.corpusId === selectedCorpusId) ?? null
  const pipeline = pipelines[selectedPipelineIndex] ?? null

  const openComparison = () => {
    if (selectedCorpusId === null) {
      return
    }
    // Fetches fresh data for the modal rather than reusing `pipelines` (SC-003: every pipeline
    // for the corpus, in one interaction); falls back to what's already loaded if the request
    // fails, so a transient error doesn't leave the modal empty.
    fetchComparison(selectedCorpusId)
      .then((response) => setComparisonPipelines(response.pipelines))
      .catch(() => setComparisonPipelines(pipelines))
    setIsComparisonOpen(true)
  }

  const closeComparison = () => {
    // Deliberately leaves `selectedPipelineIndex` untouched — closing the modal returns to
    // whichever pipeline was selected before it opened (spec US3 Acceptance Scenario 3).
    setIsComparisonOpen(false)
    setComparisonPipelines(null)
  }

  return (
    <AppShell activeScreen="metrics" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Metrics</h1>
          <p className="mt-2 text-on-surface-variant">
            Compare chunking techniques and RAG pipeline quality across your corpora.
          </p>
        </div>

        {isLoadingCorpora ? (
          <p className="mt-8 text-on-surface-variant">Loading corpora…</p>
        ) : corporaError ? (
          <p className="mt-8 text-error" role="alert">
            {corporaError}
          </p>
        ) : corpora.length === 0 ? (
          <p className="mt-8 text-on-surface-variant">
            No corpora yet. Create one from the Corpora screen first.
          </p>
        ) : (
          <div className="mt-6 grid min-h-0 flex-1 grid-cols-[240px_1fr] gap-6">
            <ul data-testid="metrics-corpus-list" className="flex flex-col gap-1">
              {corpora.map((corpus) => (
                <li key={corpus.corpusId}>
                  <button
                    type="button"
                    data-testid={`metrics-corpus-${corpus.corpusId}`}
                    aria-pressed={corpus.corpusId === selectedCorpusId}
                    onClick={() => setSelectedCorpusId(corpus.corpusId)}
                    className={
                      'w-full rounded px-3 py-2 text-left text-sm ' +
                      (corpus.corpusId === selectedCorpusId
                        ? 'bg-primary-container text-on-primary-container'
                        : 'text-on-surface-variant hover:bg-surface-variant')
                    }
                  >
                    {corpus.name}
                  </button>
                </li>
              ))}
            </ul>

            <div data-testid="metrics-detail">
              {selectedCorpus === null ? null : !selectedCorpus.hasPipelines ? (
                <p data-testid="metrics-no-pipeline" className="text-on-surface-variant">
                  No chunking pipeline has been established yet for this corpus — save chunks
                  from the Chunking screen first.
                </p>
              ) : isLoadingPipelines ? (
                <p className="text-on-surface-variant">Loading pipeline…</p>
              ) : pipelinesError ? (
                <p className="text-error" role="alert">
                  {pipelinesError}
                </p>
              ) : pipeline === null ? (
                <p data-testid="metrics-no-embeddings" className="text-on-surface-variant">
                  Chunks are saved, but no embeddings have been generated yet — generate
                  embeddings from the Embeddings screen to see pipeline metrics.
                </p>
              ) : (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <PipelineSelector
                      pipelines={pipelines}
                      selectedIndex={selectedPipelineIndex}
                      onSelect={setSelectedPipelineIndex}
                    />
                    {pipelines.length >= 2 && (
                      <button
                        type="button"
                        data-testid="metrics-compare-button"
                        onClick={openComparison}
                        className="rounded border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-variant"
                      >
                        Compare
                      </button>
                    )}
                  </div>
                  <ScoreSummary pipeline={pipeline} />
                </div>
              )}
            </div>
          </div>
        )}

        {isComparisonOpen && (
          <ComparisonModal pipelines={comparisonPipelines ?? pipelines} onClose={closeComparison} />
        )}
      </div>
    </AppShell>
  )
}
