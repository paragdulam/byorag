import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FixedSizeChunkingScreen } from '../../src/components/experiments/FixedSizeChunkingScreen'
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
    result: null,
    run: vi.fn(),
    ...overrides,
  }
  mockedUseFixedSizeChunking.mockReturnValue(state)
  return state
}

describe('FixedSizeChunkingScreen — document selection and running (US2)', () => {
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

  it('calls run with the selected document id and chunk size when triggered', async () => {
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
})

describe('FixedSizeChunkingScreen — inert reference-design controls (US3)', () => {
  it('shows the alternate algorithm options, overlap control, and separator options', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByLabelText(/recursive character/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/semantic chunking/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^fixed size$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/overlap/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '"\\n\\n"' })).toBeInTheDocument()
  })

  it('does not change the chunk size input, call run, or alter results when the inert controls are used', async () => {
    const state = mockState({
      status: 'success',
      result: {
        chunks: [{ index: 0, content: 'first chunk text' }],
        totalChunks: 1,
        strategy: 'fixed-size',
        chunkSize: 512,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByLabelText(/recursive character/i))
    await userEvent.click(screen.getByLabelText(/overlap/i))

    expect(screen.getByLabelText(/chunk size/i)).toHaveValue(512)
    expect(state.run).not.toHaveBeenCalled()
    expect(screen.getByText('first chunk text')).toBeInTheDocument()
  })

  it('does not render a Comparison section anywhere on the screen', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByText(/comparison/i)).not.toBeInTheDocument()
  })
})
