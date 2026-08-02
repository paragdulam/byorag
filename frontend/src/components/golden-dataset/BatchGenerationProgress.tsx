import { useEffect, useRef, useSyncExternalStore } from 'react'
import { computeCombinedPercent } from '../../lib/batchRunner'
import type { BatchItemResult } from '../../lib/batchRunner'
import { getSnapshot, startBatchGeneration, subscribe } from '../../lib/batchGenerationStore'
import type { GoldenEntry } from '../../types/goldenDataset'

export interface BatchGenerationProgressProps {
  corpusId: string
  documentId: string | null
  count: number
  onComplete: (results: BatchItemResult<GoldenEntry>[]) => void
}

export function BatchGenerationProgress({
  corpusId,
  documentId,
  count,
  onComplete,
}: BatchGenerationProgressProps) {
  const state = useSyncExternalStore(subscribe, getSnapshot)
  const hasReportedCompletion = useRef(false)

  useEffect(() => {
    startBatchGeneration(corpusId, documentId, count)
  }, [corpusId, documentId, count])

  useEffect(() => {
    if (state.results !== null && !hasReportedCompletion.current) {
      hasReportedCompletion.current = true
      onComplete(state.results)
    }
  }, [state.results, onComplete])

  return (
    <div data-testid="batch-generation-progress" className="text-sm text-on-surface-variant">
      {state.isRunning && state.progress !== null && (
        <p>
          Generating entry {state.progress.index + 1} of {state.progress.total} —{' '}
          {computeCombinedPercent(state.progress)}%
        </p>
      )}
      {!state.isRunning && state.results !== null && (
        <p>
          {state.results.filter((r) => r.status === 'success').length} of {state.results.length}{' '}
          entries generated successfully.
        </p>
      )}
    </div>
  )
}
