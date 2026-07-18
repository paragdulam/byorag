import { useEffect, useState } from 'react'
import type { CorpusSummary, PipelineSummary } from '../types/metrics'
import { fetchCorpora, fetchPipelines } from '../lib/metricsApi'

export interface UseMetrics {
  corpora: CorpusSummary[]
  isLoadingCorpora: boolean
  corporaError: string | null
  pipelines: PipelineSummary[]
  isLoadingPipelines: boolean
  pipelinesError: string | null
}

/** Loads the full corpus list once, then that corpus's pipelines whenever the selected corpus
 * changes — the Metrics screen's data source (spec FR-001–FR-009). */
export function useMetrics(selectedCorpusId: string | null): UseMetrics {
  const [corpora, setCorpora] = useState<CorpusSummary[]>([])
  const [isLoadingCorpora, setIsLoadingCorpora] = useState(true)
  const [corporaError, setCorporaError] = useState<string | null>(null)
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([])
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false)
  const [pipelinesError, setPipelinesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoadingCorpora(true)
    setCorporaError(null)

    fetchCorpora()
      .then((response) => {
        if (!cancelled) {
          setCorpora(response.corpora)
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setCorporaError(error.message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCorpora(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedCorpusId === null) {
      setPipelines([])
      setIsLoadingPipelines(false)
      return
    }

    let cancelled = false
    setIsLoadingPipelines(true)
    setPipelinesError(null)

    fetchPipelines(selectedCorpusId)
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
  }, [selectedCorpusId])

  return {
    corpora,
    isLoadingCorpora,
    corporaError,
    pipelines,
    isLoadingPipelines,
    pipelinesError,
  }
}
