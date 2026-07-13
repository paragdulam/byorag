import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FixedSizeChunkingScreen } from '../../src/components/chunking/FixedSizeChunkingScreen'
import { useFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'
import type { UseFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'
import type { SourceDocument } from '../../src/types/sourceDocument'

vi.mock('../../src/hooks/useFixedSizeChunking')

const mockedUseFixedSizeChunking = vi.mocked(useFixedSizeChunking)

function makeDoc(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: 'report.pdf',
    name: 'report.pdf',
    sizeBytes: 2048,
    uploadedAt: new Date('2026-07-13T10:00:00Z'),
    status: 'processed',
    ...overrides,
  }
}

function mockState(overrides: Partial<UseFixedSizeChunking> = {}): UseFixedSizeChunking {
  const state: UseFixedSizeChunking = {
    documents: [makeDoc()],
    isLoadingDocuments: false,
    status: 'idle',
    progressPercent: 0,
    result: null,
    hasSucceededOnce: false,
    run: vi.fn(),
    ...overrides,
  }
  mockedUseFixedSizeChunking.mockReturnValue(state)
  return state
}

describe('FixedSizeChunkingScreen — horizontal control bar (US1)', () => {
  it('renders Select Document, Chunk Size, Overlap, and Separators in one bar, in that order, below the sub-header', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/configure how documents are partitioned/i)).toBeInTheDocument()

    const bar = screen.getByTestId('chunking-control-bar')
    const text = bar.textContent ?? ''
    const docIdx = text.indexOf('Select Document')
    const chunkIdx = text.indexOf('Chunk Size')
    const overlapIdx = text.indexOf('Overlap')
    const separatorsIdx = text.indexOf('Separators')

    expect(docIdx).toBeGreaterThanOrEqual(0)
    expect(chunkIdx).toBeGreaterThan(docIdx)
    expect(overlapIdx).toBeGreaterThan(chunkIdx)
    expect(separatorsIdx).toBeGreaterThan(overlapIdx)

    expect(within(bar).getByLabelText(/select document/i)).toBeInTheDocument()
    expect(within(bar).getByLabelText(/chunk size/i)).toBeInTheDocument()
    expect(within(bar).getByLabelText(/^overlap$/i)).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: '"\\n\\n"' })).toBeInTheDocument()
  })

  it('does not render any algorithm-selection control anywhere on the screen', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByLabelText(/recursive character/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/semantic chunking/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^algorithm$/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('lists uploaded documents in the picker', () => {
    mockState({ documents: [makeDoc({ id: 'a.pdf', name: 'a.pdf' })] })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'a.pdf' })).toBeInTheDocument()
  })

  it('shows an empty-corpus message and no chunking controls when no documents exist', () => {
    mockState({ documents: [] })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/no documents available/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/chunk size/i)).not.toBeInTheDocument()
  })

  it('calls run with the selected document id and chunk size when Re-calculate Chunks is clicked', async () => {
    const state = mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText(/select document/i), 'report.pdf')
    await userEvent.clear(screen.getByLabelText(/chunk size/i))
    await userEvent.type(screen.getByLabelText(/chunk size/i), '50')
    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(state.run).toHaveBeenCalledWith('report.pdf', 50)
  })

  it('shows a validation message and does not call run for an invalid chunk size', async () => {
    const state = mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText(/chunk size/i))
    await userEvent.type(screen.getByLabelText(/chunk size/i), '0')
    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(screen.getByText(/enter a chunk size greater than zero/i)).toBeInTheDocument()
    expect(state.run).not.toHaveBeenCalled()
  })

  it('renders the resulting chunks with their position and content', () => {
    mockState({
      status: 'success',
      result: {
        chunks: [
          { index: 0, content: 'first chunk text' },
          { index: 1, content: 'second chunk text' },
        ],
        totalChunks: 2,
        strategy: 'fixed-size',
        chunkSize: 50,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('first chunk text')).toBeInTheDocument()
    expect(screen.getByText('second chunk text')).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_0/)).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_1/)).toBeInTheDocument()
  })

  it('shows a clear error message when text extraction failed', () => {
    mockState({ status: 'extraction-failed', result: null })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/text could not be extracted/i)).toBeInTheDocument()
  })

  it('shows a "more chunks exist" note when the result is capped', () => {
    mockState({
      status: 'success',
      result: {
        chunks: Array.from({ length: 200 }, (_, i) => ({ index: i, content: `chunk ${i}` })),
        totalChunks: 812,
        strategy: 'fixed-size',
        chunkSize: 5,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/more chunks exist/i)).toBeInTheDocument()
  })

  it('does not render a Comparison section anywhere on the screen', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByText(/comparison/i)).not.toBeInTheDocument()
  })
})

describe('FixedSizeChunkingScreen — live progress and scroll containment (US2)', () => {
  it('shows a progress bar reflecting progressPercent while a run is in progress', () => {
    mockState({ status: 'running', progressPercent: 45 })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '45')
  })

  it('hides the progress bar once a terminal status is reached', () => {
    mockState({
      status: 'success',
      progressPercent: 100,
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50 },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders the chunk list in an independently-scrollable container', () => {
    mockState({
      status: 'success',
      result: {
        chunks: [{ index: 0, content: 'first chunk text' }],
        totalChunks: 1,
        strategy: 'fixed-size',
        chunkSize: 50,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const chunkList = screen.getByTestId('chunk-list')
    expect(chunkList.className).toMatch(/overflow-y-auto/)
    expect(chunkList.className).toMatch(/flex-1/)
  })
})

describe('FixedSizeChunkingScreen — bottom action bar and Move to Embeddings gating (US3)', () => {
  it('shows exactly two buttons in the bottom bar', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /re-calculate chunks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move to embeddings/i })).toBeInTheDocument()
  })

  it('disables Move to Embeddings until a chunk run has succeeded once', () => {
    mockState({ hasSucceededOnce: false })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /move to embeddings/i })).toBeDisabled()
  })

  it('enables Move to Embeddings once hasSucceededOnce is true and navigates to embeddings when clicked', async () => {
    const onNavigate = vi.fn()
    mockState({ hasSucceededOnce: true })

    render(<FixedSizeChunkingScreen onNavigate={onNavigate} />)

    const button = screen.getByRole('button', { name: /move to embeddings/i })
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(onNavigate).toHaveBeenCalledWith('embeddings')
  })
})
