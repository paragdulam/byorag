import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BatchGenerationProgress } from '../../src/components/golden-dataset/BatchGenerationProgress'
import { resetBatchGenerationStore } from '../../src/lib/batchGenerationStore'
import * as goldenDatasetApi from '../../src/lib/goldenDatasetApi'
import type { GoldenEntry } from '../../src/types/goldenDataset'

vi.mock('../../src/lib/goldenDatasetApi')

const entry: GoldenEntry = {
  id: 'entry-1',
  corpusId: 'corpus-1',
  documentId: null,
  question: 'Generated question?',
  preferredAnswer: 'Generated answer.',
  status: 'pending_review',
  source: 'llm_generated',
  chunks: [{ id: 'gec-1', chunkId: 'chunk-1', documentId: 'doc-1', chunkIndex: 0, content: 'text' }],
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  reviewedAt: null,
}

beforeEach(() => {
  resetBatchGenerationStore()
  vi.mocked(goldenDatasetApi.generateEntry).mockReset()
})

describe('BatchGenerationProgress (026-golden-dataset US3)', () => {
  it('generates the requested number of entries sequentially and reports completion', async () => {
    vi.mocked(goldenDatasetApi.generateEntry).mockResolvedValue(entry)
    const onComplete = vi.fn()

    render(
      <BatchGenerationProgress corpusId="corpus-1" documentId={null} count={3} onComplete={onComplete} />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    expect(goldenDatasetApi.generateEntry).toHaveBeenCalledTimes(3)
  })

  it('keeps successful results when some items in the batch fail (FR-010b)', async () => {
    vi.mocked(goldenDatasetApi.generateEntry)
      .mockResolvedValueOnce(entry)
      .mockRejectedValueOnce(new Error('generation failed'))
      .mockResolvedValueOnce(entry)
    const onComplete = vi.fn()

    render(
      <BatchGenerationProgress corpusId="corpus-1" documentId={null} count={3} onComplete={onComplete} />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    const results = onComplete.mock.calls[0][0]
    expect(results.filter((r: { status: string }) => r.status === 'success')).toHaveLength(2)
    expect(results.filter((r: { status: string }) => r.status === 'failed')).toHaveLength(1)
  })

  it('keeps progress visible after the owning screen unmounts and remounts', async () => {
    let resolveFirst: (value: GoldenEntry) => void = () => {}
    const firstCall = new Promise<GoldenEntry>((resolve) => {
      resolveFirst = resolve
    })
    vi.mocked(goldenDatasetApi.generateEntry).mockImplementationOnce(() => firstCall)
    vi.mocked(goldenDatasetApi.generateEntry).mockResolvedValue(entry)

    const { unmount } = render(
      <BatchGenerationProgress corpusId="corpus-1" documentId={null} count={2} onComplete={vi.fn()} />,
    )
    await waitFor(() => expect(screen.getByText(/entry 1 of 2/i)).toBeInTheDocument())

    unmount()
    resolveFirst(entry)

    render(
      <BatchGenerationProgress corpusId="corpus-1" documentId={null} count={2} onComplete={vi.fn()} />,
    )

    await waitFor(() => expect(screen.getByText(/entry 2 of 2/i)).toBeInTheDocument())
  })
})
