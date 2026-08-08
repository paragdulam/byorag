import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GoldenReviewQueue } from '../../src/components/golden-dataset/GoldenReviewQueue'
import * as goldenDatasetApi from '../../src/lib/goldenDatasetApi'
import type { GoldenEntry, GoldenEntrySummary } from '../../src/types/goldenDataset'

vi.mock('../../src/lib/goldenDatasetApi')

const pendingSummary: GoldenEntrySummary = {
  id: 'entry-1',
  corpusId: 'corpus-1',
  documentId: 'doc-1',
  question: 'What does the passage say?',
  status: 'pending_review',
  source: 'llm_generated',
  createdAt: '2026-08-01T00:00:00Z',
}

function fullEntry(overrides: Partial<GoldenEntry> = {}): GoldenEntry {
  return {
    id: 'entry-1',
    corpusId: 'corpus-1',
    documentId: 'doc-1',
    question: 'What does the passage say?',
    preferredAnswer: 'It says some words.',
    status: 'pending_review',
    source: 'llm_generated',
    chunks: [
      { id: 'gec-1', chunkId: 'chunk-1', documentId: 'doc-1', chunkIndex: 0, content: 'Some words.' },
    ],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    reviewedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(goldenDatasetApi.getEntry).mockResolvedValue(fullEntry())
})

describe('GoldenReviewQueue (026-golden-dataset US2)', () => {
  it('lists pending-review entries', () => {
    render(<GoldenReviewQueue entries={[pendingSummary]} onEntryChanged={vi.fn()} />)

    expect(screen.getByText('What does the passage say?')).toBeInTheDocument()
  })

  it('opens a pending entry pre-filled in the shared editor', async () => {
    render(<GoldenReviewQueue entries={[pendingSummary]} onEntryChanged={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /review/i }))

    await waitFor(() => expect(screen.getByLabelText(/question/i)).toHaveValue('What does the passage say?'))
    expect(screen.getByLabelText(/preferred answer/i)).toHaveValue('It says some words.')
    expect(screen.getByRole('checkbox', { name: /some words/i })).toBeChecked()
  })

  it('approves a pending entry', async () => {
    const onEntryChanged = vi.fn()
    vi.mocked(goldenDatasetApi.updateEntry).mockResolvedValue(fullEntry({ status: 'approved' }))
    render(<GoldenReviewQueue entries={[pendingSummary]} onEntryChanged={onEntryChanged} />)

    await userEvent.click(screen.getByRole('button', { name: /review/i }))
    await waitFor(() => expect(screen.getByLabelText(/question/i)).toHaveValue('What does the passage say?'))
    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }))

    await waitFor(() => expect(onEntryChanged).toHaveBeenCalled())
    expect(goldenDatasetApi.updateEntry).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ status: 'approved' }),
    )
  })

  it('rejects a pending entry', async () => {
    const onEntryChanged = vi.fn()
    vi.mocked(goldenDatasetApi.updateEntry).mockResolvedValue(fullEntry({ status: 'rejected' }))
    render(<GoldenReviewQueue entries={[pendingSummary]} onEntryChanged={onEntryChanged} />)

    await userEvent.click(screen.getByRole('button', { name: /review/i }))
    await waitFor(() => expect(screen.getByLabelText(/question/i)).toHaveValue('What does the passage say?'))
    await userEvent.click(screen.getByRole('button', { name: /^reject$/i }))

    await waitFor(() => expect(onEntryChanged).toHaveBeenCalled())
    expect(goldenDatasetApi.updateEntry).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({ status: 'rejected' }),
    )
  })

  it('offers reopen actions for a rejected entry instead of approve/reject', async () => {
    vi.mocked(goldenDatasetApi.getEntry).mockResolvedValue(fullEntry({ status: 'rejected' }))
    const rejectedSummary: GoldenEntrySummary = { ...pendingSummary, status: 'rejected' }
    render(<GoldenReviewQueue entries={[rejectedSummary]} onEntryChanged={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /review/i }))
    await waitFor(() => expect(screen.getByLabelText(/question/i)).toHaveValue('What does the passage say?'))

    expect(screen.getByRole('button', { name: /move to pending review/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^approve$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument()
  })

  it('returns to the list without saving when Cancel is clicked (033-ui-ux-polish)', async () => {
    render(<GoldenReviewQueue entries={[pendingSummary]} onEntryChanged={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /review/i }))
    await waitFor(() => expect(screen.getByLabelText(/question/i)).toHaveValue('What does the passage say?'))
    const updateEntryCallsBefore = vi.mocked(goldenDatasetApi.updateEntry).mock.calls.length

    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.getByText('What does the passage say?')).toBeInTheDocument()
    expect(screen.queryByLabelText(/preferred answer/i)).not.toBeInTheDocument()
    expect(goldenDatasetApi.updateEntry).toHaveBeenCalledTimes(updateEntryCallsBefore)
  })
})
