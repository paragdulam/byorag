import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GoldenEntryEditor } from '../../src/components/golden-dataset/GoldenEntryEditor'
import * as goldenDatasetApi from '../../src/lib/goldenDatasetApi'
import type { GoldenCandidate, GoldenEntry } from '../../src/types/goldenDataset'

vi.mock('../../src/lib/goldenDatasetApi')

const candidate: GoldenCandidate = {
  chunkId: 'chunk-1',
  documentId: 'doc-1',
  chunkIndex: 0,
  content: 'Either party may terminate with 30 days notice.',
  matchedQuestion: true,
  matchedAnswer: true,
}

const savedEntry: GoldenEntry = {
  id: 'entry-1',
  corpusId: 'corpus-1',
  documentId: 'doc-1',
  question: 'What is the notice period?',
  preferredAnswer: '30 days.',
  status: 'approved',
  source: 'manual',
  chunks: [
    { id: 'gec-1', chunkId: 'chunk-1', documentId: 'doc-1', chunkIndex: 0, content: candidate.content },
  ],
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  reviewedAt: null,
}

beforeEach(() => {
  vi.mocked(goldenDatasetApi.searchCandidates).mockResolvedValue([candidate])
  vi.mocked(goldenDatasetApi.draftAnswer).mockResolvedValue('Drafted answer text.')
  vi.mocked(goldenDatasetApi.createEntry).mockResolvedValue(savedEntry)
})

describe('GoldenEntryEditor (026-golden-dataset US1)', () => {
  it('renders question and answer fields', () => {
    render(
      <GoldenEntryEditor scope={{ corpusId: 'corpus-1', documentId: 'doc-1' }} onSaved={vi.fn()} />,
    )

    expect(screen.getByLabelText(/question/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/preferred answer/i)).toBeInTheDocument()
  })

  it('fills the answer field with a draft grounded in the selected chunks', async () => {
    render(
      <GoldenEntryEditor scope={{ corpusId: 'corpus-1', documentId: 'doc-1' }} onSaved={vi.fn()} />,
    )

    await userEvent.type(screen.getByLabelText(/question/i), 'What is the notice period?')
    // The candidate matches both question and answer, so FR-005 pre-checks it automatically —
    // no explicit click needed (clicking an already-checked box would uncheck it).
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /30 days notice/i })).toBeChecked())

    await userEvent.click(screen.getByRole('button', { name: /draft from selected chunks/i }))

    await waitFor(() =>
      expect(screen.getByLabelText(/preferred answer/i)).toHaveValue('Drafted answer text.'),
    )
    expect(goldenDatasetApi.draftAnswer).toHaveBeenCalledWith(
      'What is the notice period?',
      [{ chunkIndex: 0, content: candidate.content }],
    )
  })

  it('blocks saving with an explanatory message when zero chunks are selected', async () => {
    render(
      <GoldenEntryEditor scope={{ corpusId: 'corpus-1', documentId: 'doc-1' }} onSaved={vi.fn()} />,
    )

    await userEvent.type(screen.getByLabelText(/question/i), 'What is the notice period?')
    await userEvent.type(screen.getByLabelText(/preferred answer/i), '30 days.')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(screen.getByText(/at least one evidence chunk/i)).toBeInTheDocument()
    expect(goldenDatasetApi.createEntry).not.toHaveBeenCalled()
  })

  it('saves once at least one chunk is selected', async () => {
    const onSaved = vi.fn()
    render(
      <GoldenEntryEditor scope={{ corpusId: 'corpus-1', documentId: 'doc-1' }} onSaved={onSaved} />,
    )

    await userEvent.type(screen.getByLabelText(/question/i), 'What is the notice period?')
    await userEvent.type(screen.getByLabelText(/preferred answer/i), '30 days.')
    // Pre-checked automatically (FR-005) — matches both the question and answer searches.
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /30 days notice/i })).toBeChecked())

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedEntry))
    expect(goldenDatasetApi.createEntry).toHaveBeenCalledWith({
      corpusId: 'corpus-1',
      documentId: 'doc-1',
      question: 'What is the notice period?',
      preferredAnswer: '30 days.',
      chunks: [
        { chunkId: 'chunk-1', documentId: 'doc-1', chunkIndex: 0, content: candidate.content },
      ],
    })
  })
})
