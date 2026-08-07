import { useEffect, useState } from 'react'
import type { PipelineSummary } from '../types/metrics'
import { fetchPipelines } from '../lib/metricsApi'

export interface UseMetrics {
  pipelines: PipelineSummary[]
  isLoadingPipelines: boolean
  pipelinesError: string | null
}

/** Loads every RAG pipeline for the given corpus (031-playground-metrics-redesign US2) — the
 * corpus itself is the app-wide active corpus from `useCorpus()`, passed in by the caller, not
 * a corpus list this hook manages itself (that in-screen picker is removed, FR-009). */
export function useMetrics(corpusId: string | null): UseMetrics {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([])
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false)
  const [pipelinesError, setPipelinesError] = useState<string | null>(null)

  useEffect(() => {
    if (corpusId === null) {
      setPipelines([])
      setIsLoadingPipelines(false)
      return
    }

    let cancelled = false
    setIsLoadingPipelines(true)
    setPipelinesError(null)

    fetchPipelines(corpusId)
      .then((response) => {
        if (!cancelled) {
          setPipelines(response.pipelines)
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setPipelinesError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPipelines(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [corpusId])

  return {
    pipelines,
    isLoadingPipelines,
    pipelinesError,
  }
}
