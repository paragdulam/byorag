import type { BatchItemResult } from '../../lib/batchRunner'

export interface EntireCorpusSummaryListProps<T> {
  results: BatchItemResult<T>[]
  formatSuccessLabel: (result: T) => string
}

/**
 * Per-document "Entire Corpus" results summary — shared between Fixed Size Chunking and
 * Embeddings so both screens present batch results (and per-document failures) identically
 * (022-chunk-preview-ui-fixes research.md §6, FR-013/FR-014). The caller supplies
 * `formatSuccessLabel` to render its own result shape's success count (e.g. "N chunks" vs.
 * "N embeddings saved").
 */
export function EntireCorpusSummaryList<T>({
  results,
  formatSuccessLabel,
}: EntireCorpusSummaryListProps<T>) {
  return (
    <ul data-testid="entire-corpus-summary" className="flex flex-col gap-2">
      {results.map((item) => (
        <li
          key={item.documentId}
          className="flex items-center justify-between rounded-lg border border-outline-variant bg-surface-container p-4"
        >
          <span className="text-on-surface">{item.documentName}</span>
          {item.status === 'success' ? (
            <span className="text-sm text-on-surface-variant">
              {item.result ? formatSuccessLabel(item.result) : ''}
            </span>
          ) : (
            <span role="alert" className="text-sm text-error">
              {item.errorMessage ?? 'Failed'}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
