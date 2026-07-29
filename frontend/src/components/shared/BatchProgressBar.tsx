import { computeCombinedPercent, formatBatchProgressLabel } from '../../lib/batchRunner'
import type { BatchProgress } from '../../lib/batchRunner'

export interface BatchProgressBarProps {
  progress: BatchProgress
}

/**
 * Combined "Entire Corpus" batch progress bar + "Processing document X of N (name)" label —
 * shared between Fixed Size Chunking and Embeddings so both screens present an in-progress
 * batch identically (022-chunk-preview-ui-fixes research.md §6).
 */
export function BatchProgressBar({ progress }: BatchProgressBarProps) {
  const percent = computeCombinedPercent(progress)

  return (
    <>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded bg-surface-container"
      >
        <div
          className="h-full bg-primary-container transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-on-surface-variant">
        {formatBatchProgressLabel(progress)}… {percent}%
      </p>
    </>
  )
}
