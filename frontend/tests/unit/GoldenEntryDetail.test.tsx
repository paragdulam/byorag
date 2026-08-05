import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GoldenEntryDetail } from '../../src/components/golden-dataset/GoldenEntryDetail'
import type { GoldenEntry } from '../../src/types/goldenDataset'

function entry(overrides: Partial<GoldenEntry> = {}): GoldenEntry {
  return {
    id: 'entry-1',
    corpusId: 'corpus-1',
    documentId: 'doc-1',
    question: 'What is the notice period?',
    preferredAnswer: 'Thirty days written notice.',
    status: 'approved',
    source: 'manual',
    chunks: [
      { id: 'gec-1', chunkId: 'chunk-1', documentId: 'doc-1', chunkIndex: 0, content: 'Thirty days.' },
      { id: 'gec-2', chunkId: 'chunk-2', documentId: 'doc-1', chunkIndex: 3, content: 'Written notice required.' },
    ],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    reviewedAt: '2026-08-01T00:05:00Z',
    ...overrides,
  }
}

describe('GoldenEntryDetail (030-golden-dataset-entry-detail US2)', () => {
  it('renders the question and the full preferred answer', () => {
    render(<GoldenEntryDetail entry={entry()} onClose={vi.fn()} />)

    expect(screen.getByText('What is the notice period?')).toBeInTheDocument()
    expect(screen.getByText('Thirty days written notice.')).toBeInTheDocument()
  })

  it('renders zero editable fields or save controls', () => {
    const { container } = render(<GoldenEntryDetail entry={entry()} onClose={vi.fn()} />)

    expect(container.querySelectorAll('input, textarea')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
  })

  it('calls onClose when the close control is clicked', async () => {
    const onClose = vi.fn()
    render(<GoldenEntryDetail entry={entry()} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('lists every evidence chunk with its chunk name, collapsed by default', () => {
    render(<GoldenEntryDetail entry={entry()} onClose={vi.fn()} />)

    expect(screen.getByText('CHUNK_0')).toBeInTheDocument()
    expect(screen.getByText('CHUNK_3')).toBeInTheDocument()
    expect(screen.getByText('Thirty days.')).toHaveClass('line-clamp-2')
    expect(screen.getAllByRole('button', { name: /^show more$/i })).toHaveLength(2)
  })

  it('expands a chunk to its full content when Show more is clicked, and back when Show less is clicked', async () => {
    render(<GoldenEntryDetail entry={entry()} onClose={vi.fn()} />)

    const [firstShowMore] = screen.getAllByRole('button', { name: /^show more$/i })
    await userEvent.click(firstShowMore)

    expect(screen.getByText('Thirty days.')).not.toHaveClass('line-clamp-2')
    expect(screen.getByRole('button', { name: /^show less$/i })).toBeInTheDocument()
    // The second chunk is untouched — still collapsed with its own "Show more".
    expect(screen.getByText('Written notice required.')).toHaveClass('line-clamp-2')

    await userEvent.click(screen.getByRole('button', { name: /^show less$/i }))

    expect(screen.getByText('Thirty days.')).toHaveClass('line-clamp-2')
    expect(screen.getAllByRole('button', { name: /^show more$/i })).toHaveLength(2)
  })

  it('renders no Evidence section when the entry has no chunks', () => {
    render(<GoldenEntryDetail entry={entry({ chunks: [] })} onClose={vi.fn()} />)

    expect(screen.queryByText('Evidence')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })
})
