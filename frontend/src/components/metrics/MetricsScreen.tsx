import { useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useMetrics } from '../../hooks/useMetrics'
import { useCorpus } from '../../context/CorpusContext'
import { fetchComparison } from '../../lib/metricsApi'
import type { PipelineSummary } from '../../types/metrics'
import { ComparisonModal } from './ComparisonModal'
import { ScoreSummary } from './ScoreSummary'

export interface MetricsScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function MetricsScreen({ onNavigate }: MetricsScreenProps) {
  // 031-playground-metrics-redesign US2 (FR-009): the corpus is the app-wide active corpus,
  // selected only from the Corpora section — no in-screen corpus picker here anymore.
  const { activeCorpusId } = useCorpus()
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)
  const [comparisonPipelines, setComparisonPipelines] = useState<PipelineSummary[] | null>(null)
  const { pipelines, isLoadingPipelines, pipelinesError } = useMetrics(activeCorpusId)

  const openComparison = () => {
    if (activeCorpusId === null) {
      return
    }
    // Fetches fresh data for the modal rather than reusing `pipelines` (SC-003: every pipeline
    // for the corpus, in one interaction); falls back to what's already loaded if the request
    // fails, so a transient error doesn't leave the modal empty.
    fetchComparison(activeCorpusId)
      .then((response) => setComparisonPipelines(response.pipelines))
      .catch(() => setComparisonPipelines(pipelines))
    setIsComparisonOpen(true)
  }

  const closeComparison = () => {
    setIsComparisonOpen(false)
    setComparisonPipelines(null)
  }

  return (
    <AppShell activeScreen="metrics" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Metrics</h1>
          <p className="mt-2 text-on-surface-variant">
            Every RAG pipeline (chunking technique, embedding model, and generation model
            combination) tried on this corpus, with its own quality metrics.
          </p>
        </div>

        {activeCorpusId === null ? (
          <p className="mt-8 text-on-surface-variant" role="status">
            Select or create a corpus first.
          </p>
        ) : pipelinesError !== null ? (
          <p className="mt-8 text-error" role="alert">
            {pipelinesError}
          </p>
        ) : isLoadingPipelines ? (
          <p className="mt-8 text-on-surface-variant">Loading pipeline…</p>
        ) : pipelines.length === 0 ? (
          <p data-testid="metrics-no-pipeline" className="mt-8 text-on-surface-variant">
            No chunking pipeline has been established yet for this corpus — save chunks from
            the Chunking screen first.
          </p>
        ) : (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            {pipelines.length >= 2 && (
              <div className="mb-4 flex justify-end">
                <button
                  type="button"
                  data-testid="metrics-compare-button"
                  onClick={openComparison}
                  className="rounded border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-variant"
                >
                  Compare
                </button>
              </div>
            )}
            <ul data-testid="metrics-pipeline-list" className="flex flex-col gap-6">
              {pipelines.map((pipeline) => (
                <li
                  key={`${pipeline.chunkingStrategy}-${pipeline.embeddingModel}`}
                  data-testid={`metrics-pipeline-${pipeline.chunkingStrategy}-${pipeline.embeddingModel}`}
                  className="rounded-lg border border-outline-variant bg-surface-container p-4"
                >
                  <ScoreSummary pipeline={pipeline} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {isComparisonOpen && (
          <ComparisonModal pipelines={comparisonPipelines ?? pipelines} onClose={closeComparison} />
        )}
      </div>
    </AppShell>
  )
}
