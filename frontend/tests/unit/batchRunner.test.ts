import { describe, expect, it, vi } from 'vitest'
import {
  computeCombinedPercent,
  formatBatchProgressLabel,
  runSequentialBatch,
  type BatchProgress,
} from '../../src/lib/batchRunner'

interface Doc {
  id: string
  name: string
}

const DOCS: Doc[] = [
  { id: 'doc-a', name: 'a.pdf' },
  { id: 'doc-b', name: 'b.pdf' },
  { id: 'doc-c', name: 'c.pdf' },
]

describe('runSequentialBatch', () => {
  it('processes documents strictly one at a time, in order', async () => {
    const order: string[] = []

    await runSequentialBatch(
      DOCS,
      async (doc) => {
        order.push(`start:${doc.id}`)
        await new Promise((resolve) => setTimeout(resolve, 1))
        order.push(`end:${doc.id}`)
        return doc.id
      },
      () => {},
    )

    expect(order).toEqual([
      'start:doc-a',
      'end:doc-a',
      'start:doc-b',
      'end:doc-b',
      'start:doc-c',
      'end:doc-c',
    ])
  })

  it('calls onProgress with index/total/documentId/documentName before each document starts', async () => {
    const progressCalls: BatchProgress[] = []

    await runSequentialBatch(
      DOCS,
      async (doc) => doc.id,
      (progress) => progressCalls.push(progress),
    )

    expect(progressCalls[0]).toMatchObject({ index: 0, total: 3, documentId: 'doc-a', documentName: 'a.pdf' })
    expect(progressCalls.some((p) => p.index === 1 && p.documentId === 'doc-b')).toBe(true)
    expect(progressCalls.some((p) => p.index === 2 && p.documentId === 'doc-c')).toBe(true)
  })

  it('forwards a document-level progress callback into onProgress for that document', async () => {
    const progressCalls: BatchProgress[] = []

    await runSequentialBatch(
      [DOCS[0]],
      async (_doc, reportDocumentProgress) => {
        reportDocumentProgress(50)
        reportDocumentProgress(100)
        return 'ok'
      },
      (progress) => progressCalls.push(progress),
    )

    const percents = progressCalls.map((p) => p.documentPercent)
    expect(percents).toContain(50)
    expect(percents).toContain(100)
  })

  it('records a failure for one document and continues processing the rest', async () => {
    const results = await runSequentialBatch(
      DOCS,
      async (doc) => {
        if (doc.id === 'doc-b') {
          throw new Error('extraction failed')
        }
        return `result-${doc.id}`
      },
      () => {},
    )

    expect(results).toEqual([
      { documentId: 'doc-a', documentName: 'a.pdf', status: 'success', result: 'result-doc-a' },
      { documentId: 'doc-b', documentName: 'b.pdf', status: 'failed', errorMessage: 'extraction failed' },
      { documentId: 'doc-c', documentName: 'c.pdf', status: 'success', result: 'result-doc-c' },
    ])
  })

  it('returns results in document order, matching an all-success run', async () => {
    const runOne = vi.fn(async (doc: Doc) => doc.id.toUpperCase())

    const results = await runSequentialBatch(DOCS, runOne, () => {})

    expect(runOne).toHaveBeenCalledTimes(3)
    expect(results.map((r) => r.documentId)).toEqual(['doc-a', 'doc-b', 'doc-c'])
    expect(results.every((r) => r.status === 'success')).toBe(true)
  })

  it('resolves with an empty array for an empty document list, without calling runOne', async () => {
    const runOne = vi.fn(async () => 'unused')

    const results = await runSequentialBatch([], runOne, () => {})

    expect(results).toEqual([])
    expect(runOne).not.toHaveBeenCalled()
  })
})

describe('computeCombinedPercent', () => {
  it('combines document index/total with that document\'s own percent', () => {
    expect(computeCombinedPercent({ index: 0, total: 4, documentId: 'a', documentName: 'a', documentPercent: 0 })).toBe(0)
    expect(computeCombinedPercent({ index: 0, total: 4, documentId: 'a', documentName: 'a', documentPercent: 100 })).toBe(25)
    expect(computeCombinedPercent({ index: 2, total: 4, documentId: 'c', documentName: 'c', documentPercent: 50 })).toBe(63)
  })

  it('reaches 100 when the final document completes', () => {
    expect(computeCombinedPercent({ index: 3, total: 4, documentId: 'd', documentName: 'd', documentPercent: 100 })).toBe(100)
  })
})

describe('formatBatchProgressLabel', () => {
  it('formats as "Processing document X of N (name)"', () => {
    const label = formatBatchProgressLabel({
      index: 2,
      total: 12,
      documentId: 'doc-x',
      documentName: 'name.pdf',
      documentPercent: 42,
    })
    expect(label).toBe('Processing document 3 of 12 (name.pdf)')
  })
})
