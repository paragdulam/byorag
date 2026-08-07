import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GoldenEntryList } from '../../src/components/golden-dataset/GoldenEntryList'
import * as goldenDatasetApi from '../../src/lib/goldenDatasetApi'
import type { GoldenEntry, GoldenEntrySummary } from '../../src/types/goldenDataset'

vi.mock('../../src/lib/goldenDatasetApi')

const approvedA: GoldenEntrySummary = {
  id: 'entry-a',
  corpusId: 'corpus-1',
  documentId: 'doc-1',
  question: 'What is the notice period?',
  status: 'approved',
  source: 'manual',
  createdAt: '2026-08-01T00:00:00Z',
}

const approvedB: GoldenEntrySummary = {
  id: 'entry-b',
  corpusId: 'corpus-1',
  documentId: 'doc-1',
  question: 'What is the fee?',
  status: 'approved',
  source: 'manual',
  createdAt: '2026-08-01T00:05:00Z',
}

const pendingEntry: GoldenEntrySummary = {
  id: 'entry-c',
  corpusId: 'corpus-1',
  documentId: 'doc-1',
  question: 'What does the passage say?',
  status: 'pending_review',
  source: 'llm_generated',
  createdAt: '2026-08-01T00:10:00Z',
}

const rejectedEntry: GoldenEntrySummary = {
  id: 'entry-d',
  corpusId: 'corpus-1',
  documentId: 'doc-1',
  question: 'A rejected question?',
  status: 'rejected',
  source: 'manual',
  createdAt: '2026-08-01T00:15:00Z',
}

function fullEntry(summary: GoldenEntrySummary, preferredAnswer: string): GoldenEntry {
  return {
    id: summary.id,
    corpusId: summary.corpusId,
    documentId: summary.documentId,
    question: summary.question,
    preferredAnswer,
    status: summary.status,
    source: summary.source,
    chunks: [],
    createdAt: summary.createdAt,
    updatedAt: summary.createdAt,
    reviewedAt: null,
  }
}

beforeEach(() => {
  vi.mocked(goldenDatasetApi.getEntry).mockReset()
  vi.mocked(goldenDatasetApi.getEntry).mockImplementation(async (id: string) => {
    if (id === approvedA.id) return fullEntry(approvedA, 'Thirty days written notice.')
    if (id === approvedB.id) return fullEntry(approvedB, 'Fifty dollars per month.')
    throw new Error(`Unexpected getEntry call for ${id}`)
  })
})

describe('GoldenEntryList (030-golden-dataset-entry-detail US2)', () => {
  it('lists every entry passed in, regardless of status', () => {
    render(<GoldenEntryList entries={[approvedA, pendingEntry, rejectedEntry]} onDelete={vi.fn()} />)

    expect(screen.getByText('What is the notice period?')).toBeInTheDocument()
    expect(screen.getByText('What does the passage say?')).toBeInTheDocument()
    expect(screen.getByText('A rejected question?')).toBeInTheDocument()
  })

  it('fetches and shows the full answer when an approved entry\'s question is clicked', async () => {
    render(<GoldenEntryList entries={[approvedA]} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))

    await waitFor(() =>
      expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument(),
    )
    expect(goldenDatasetApi.getEntry).toHaveBeenCalledWith('entry-a')
    expect(goldenDatasetApi.getEntry).toHaveBeenCalledTimes(1)
  })

  it('collapses on a second click without refetching', async () => {
    render(<GoldenEntryList entries={[approvedA]} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))
    await waitFor(() => expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))

    expect(screen.queryByText('Thirty days written notice.')).not.toBeInTheDocument()
    expect(goldenDatasetApi.getEntry).toHaveBeenCalledTimes(1)

    // Re-expanding doesn't refetch either — the entry is already cached.
    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))
    await waitFor(() => expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument())
    expect(goldenDatasetApi.getEntry).toHaveBeenCalledTimes(1)
  })

  it('does not open anything when a pending-review entry\'s question is clicked', async () => {
    render(<GoldenEntryList entries={[pendingEntry]} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'What does the passage say?' }))

    expect(goldenDatasetApi.getEntry).not.toHaveBeenCalled()
  })

  it('does not open anything when a rejected entry\'s question is clicked', async () => {
    render(<GoldenEntryList entries={[rejectedEntry]} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'A rejected question?' }))

    expect(goldenDatasetApi.getEntry).not.toHaveBeenCalled()
  })

  it('expanding a second approved entry does not collapse or alter the first', async () => {
    render(<GoldenEntryList entries={[approvedA, approvedB]} onDelete={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))
    await waitFor(() => expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'What is the fee?' }))
    await waitFor(() => expect(screen.getByText('Fifty dollars per month.')).toBeInTheDocument())

    expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument()
  })

  it('removes both the row and its expanded answer when the entry is deleted', async () => {
    const onDelete = vi.fn()
    const { rerender } = render(<GoldenEntryList entries={[approvedA]} onDelete={onDelete} />)

    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))
    await waitFor(() => expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledWith(approvedA)

    // Simulates the parent removing the now-deleted entry from the list it passes down.
    rerender(<GoldenEntryList entries={[]} onDelete={onDelete} />)

    expect(screen.queryByText('What is the notice period?')).not.toBeInTheDocument()
    expect(screen.queryByText('Thirty days written notice.')).not.toBeInTheDocument()
  })

  describe('grouped under a document-name header (shown only when "Entire Corpus" is selected)', () => {
    const entryOnDocOne: GoldenEntrySummary = { ...approvedA, documentId: 'doc-1' }
    const anotherEntryOnDocOne: GoldenEntrySummary = {
      ...approvedB,
      id: 'entry-e',
      question: 'A second question on doc one?',
      documentId: 'doc-1',
    }
    const entryOnDocTwo: GoldenEntrySummary = { ...approvedB, documentId: 'doc-2' }
    const entryWithNoDocument: GoldenEntrySummary = { ...pendingEntry, documentId: null }
    const documentNames = new Map([
      ['doc-1', 'contract.pdf'],
      ['doc-2', 'appendix.pdf'],
    ])

    it('renders a document-name header above the group of questions belonging to it', () => {
      render(
        <GoldenEntryList
          entries={[entryOnDocOne, entryOnDocTwo]}
          onDelete={vi.fn()}
          documentNames={documentNames}
        />,
      )

      const groupOne = screen.getByTestId('golden-entry-group-doc-1')
      expect(within(groupOne).getByText('contract.pdf')).toBeInTheDocument()
      expect(within(groupOne).getByText('What is the notice period?')).toBeInTheDocument()
      expect(within(groupOne).queryByText('What is the fee?')).not.toBeInTheDocument()

      const groupTwo = screen.getByTestId('golden-entry-group-doc-2')
      expect(within(groupTwo).getByText('appendix.pdf')).toBeInTheDocument()
      expect(within(groupTwo).getByText('What is the fee?')).toBeInTheDocument()
    })

    it('lists every question for a document under its single shared header, not one header per question', () => {
      render(
        <GoldenEntryList
          entries={[entryOnDocOne, anotherEntryOnDocOne]}
          onDelete={vi.fn()}
          documentNames={documentNames}
        />,
      )

      expect(screen.getAllByText('contract.pdf')).toHaveLength(1)
      const group = screen.getByTestId('golden-entry-group-doc-1')
      expect(within(group).getByText('What is the notice period?')).toBeInTheDocument()
      expect(within(group).getByText('A second question on doc one?')).toBeInTheDocument()
    })

    it('falls back to an "Entire Corpus" header for an entry with no owning document', () => {
      render(
        <GoldenEntryList
          entries={[entryWithNoDocument]}
          onDelete={vi.fn()}
          documentNames={documentNames}
        />,
      )

      const group = screen.getByTestId('golden-entry-group-entire-corpus')
      expect(within(group).getByText('Entire Corpus')).toBeInTheDocument()
    })

    it('shows no headers or grouping at all when documentNames is not provided (a specific document is selected)', () => {
      render(<GoldenEntryList entries={[entryOnDocOne, entryOnDocTwo]} onDelete={vi.fn()} />)

      expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument()
      expect(screen.queryByText('appendix.pdf')).not.toBeInTheDocument()
      expect(screen.queryByTestId('golden-entry-group-doc-1')).not.toBeInTheDocument()
    })
  })
})
