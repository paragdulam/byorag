// Shared sequential "Entire Corpus" batch runner (018-ui-polish-batch research.md §2,
// contracts/entire-corpus-batch-orchestration.md) — used by useFixedSizeChunking and
// useChunkEmbeddings to run today's existing per-document streaming operations once per
// document, one at a time, without introducing any new backend batch endpoint.

export interface BatchDocument {
  id: string
  name: string
}

export interface BatchProgress {
  index: number
  total: number
  documentId: string
  documentName: string
  documentPercent: number
}

export interface BatchItemResult<TResult> {
  documentId: string
  documentName: string
  status: 'success' | 'failed'
  result?: TResult
  errorMessage?: string
}

/**
 * Runs `runOne` for every document in `documents`, strictly one at a time (never
 * concurrently), in list order. `onProgress` is called before each document starts (with
 * `documentPercent: 0`) and again whenever `runOne` reports its own progress via the
 * `reportDocumentProgress` callback it's given. A document whose `runOne` call rejects is
 * recorded as `'failed'` and the batch continues with the next document — it is never
 * aborted (spec FR-007/FR-021).
 */
export async function runSequentialBatch<TDoc extends BatchDocument, TResult>(
  documents: TDoc[],
  runOne: (doc: TDoc, reportDocumentProgress: (percent: number) => void) => Promise<TResult>,
  onProgress: (progress: BatchProgress) => void,
): Promise<BatchItemResult<TResult>[]> {
  const total = documents.length
  const results: BatchItemResult<TResult>[] = []

  for (let index = 0; index < total; index += 1) {
    const doc = documents[index]
    const reportDocumentProgress = (percent: number) => {
      onProgress({ index, total, documentId: doc.id, documentName: doc.name, documentPercent: percent })
    }
    reportDocumentProgress(0)

    try {
      const result = await runOne(doc, reportDocumentProgress)
      results.push({ documentId: doc.id, documentName: doc.name, status: 'success', result })
    } catch (error) {
      results.push({
        documentId: doc.id,
        documentName: doc.name,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Failed',
      })
    }
  }

  return results
}

/** Overall percent across the whole batch — resolved format from `/speckit-clarify`. */
export function computeCombinedPercent(progress: BatchProgress): number {
  return Math.round(((progress.index + progress.documentPercent / 100) / progress.total) * 100)
}

/** "Processing document X of N (name)" — resolved format from `/speckit-clarify`. */
export function formatBatchProgressLabel(progress: BatchProgress): string {
  return `Processing document ${progress.index + 1} of ${progress.total} (${progress.documentName})`
}
