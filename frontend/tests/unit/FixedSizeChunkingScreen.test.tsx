import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FixedSizeChunkingScreen } from '../../src/components/chunking/FixedSizeChunkingScreen'
import { useFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'
import type { UseFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'
import type { SourceDocument } from '../../src/types/sourceDocument'
import { CorpusProvider } from '../../src/context/CorpusContext'

// AppShell -> SidebarNav reads Anthropic-key status from AuthContext
// (025-user-profile-anthropic-key) -- mocked here since this suite predates it and isn't
// exercising that gating.
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'user-1', email: 'person@example.com', createdAt: '2026-07-14T00:00:00Z' },
    hasAnthropicKey: true,
    isLoading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshAnthropicKeyStatus: vi.fn(),
  }),
}))
import { ENTIRE_CORPUS_SELECTION } from '../../src/lib/entireCorpusSelection'

vi.mock('../../src/hooks/useFixedSizeChunking')

vi.mock('../../src/components/chunking/ChunkInContextPreview', () => ({
  ChunkInContextPreview: ({
    documentId,
    selectedChunkIndex,
    hasUnsavedChanges,
  }: {
    documentId: string
    selectedChunkIndex: number
    hasUnsavedChanges: boolean
  }) => (
    <div data-testid="mock-chunk-context-preview">
      {documentId} / {selectedChunkIndex} / {hasUnsavedChanges ? 'unsaved' : 'saved'}
    </div>
  ),
}))

// Every call site below renders <FixedSizeChunkingScreen /> via this local
// `render`, which wraps in CorpusProvider — required because AppShell ->
// SidebarNav reads the active corpus from context (008-corpora-management).
function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

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
    activeDocumentId: 'report.pdf',
    status: 'idle',
    progressPercent: 0,
    result: null,
    chunkOrigin: null,
    saveStatus: 'idle',
    saveProgressPercent: 0,
    hasSavedOnce: false,
    isSaved: false,
    isEntireCorpus: false,
    batchProgress: null,
    batchResults: [],
    run: vi.fn(),
    save: vi.fn(),
    ...overrides,
  }
  // Reactive rather than a static mockReturnValue: activeDocumentId reflects whatever
  // selectedDocumentId the screen currently passes in (mirroring the real hook), unless a test
  // explicitly overrides activeDocumentId to pin a specific scenario.
  mockedUseFixedSizeChunking.mockImplementation((_corpusId, selectedDocumentId = '') => ({
    ...state,
    activeDocumentId: overrides.activeDocumentId ?? (selectedDocumentId || state.documents[0]?.id || ''),
  }))
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

  it('calls run with the selected document id, chunk size, and overlap when Re-calculate Chunks is clicked', async () => {
    const state = mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText(/select document/i), 'report.pdf')
    await userEvent.clear(screen.getByLabelText(/chunk size/i))
    await userEvent.type(screen.getByLabelText(/chunk size/i), '50')
    fireEvent.change(screen.getByLabelText(/^overlap$/i), { target: { value: '10' } })
    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(state.run).toHaveBeenCalledWith('report.pdf', 50, 10)
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

  it('shows a validation message and does not call run when overlap equals chunk size', async () => {
    const state = mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText(/chunk size/i))
    await userEvent.type(screen.getByLabelText(/chunk size/i), '50')
    fireEvent.change(screen.getByLabelText(/^overlap$/i), { target: { value: '50' } })
    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(screen.getByText(/overlap must be smaller than chunk size/i)).toBeInTheDocument()
    expect(state.run).not.toHaveBeenCalled()
  })

  it('shows a validation message and does not call run when overlap exceeds chunk size', async () => {
    const state = mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText(/chunk size/i))
    await userEvent.type(screen.getByLabelText(/chunk size/i), '30')
    fireEvent.change(screen.getByLabelText(/^overlap$/i), { target: { value: '75' } })
    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(screen.getByText(/overlap must be smaller than chunk size/i)).toBeInTheDocument()
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
        overlap: 0,
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
        overlap: 0,
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
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
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
        overlap: 0,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const chunkList = screen.getByTestId('chunk-list')
    expect(chunkList.className).toMatch(/overflow-y-auto/)
    expect(chunkList.className).toMatch(/flex-1/)
  })
})

describe('FixedSizeChunkingScreen — overlap readout (007-chunking-overlap-controls US1)', () => {
  it('shows the current overlap value as a visible number next to the slider', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const slider = screen.getByLabelText(/^overlap$/i)
    expect(screen.getByText(slider.getAttribute('value') ?? '')).toBeInTheDocument()
  })

  it('updates the displayed overlap number immediately when the slider changes', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const slider = screen.getByLabelText(/^overlap$/i)
    fireEvent.change(slider, { target: { value: '120' } })

    expect(screen.getByText('120')).toBeInTheDocument()
  })
})

describe('FixedSizeChunkingScreen — chunk count below overlap (007-chunking-overlap-controls US2)', () => {
  it('shows no chunk count before any chunking run has completed', () => {
    mockState({ status: 'idle', result: null })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('overlap-chunk-count')).not.toBeInTheDocument()
  })

  it('shows the total chunk count below the Overlap slider, right-aligned, after a successful run', () => {
    mockState({
      status: 'success',
      result: {
        chunks: [{ index: 0, content: 'first chunk text' }],
        totalChunks: 42,
        strategy: 'fixed-size',
        chunkSize: 50,
        overlap: 0,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const count = screen.getByTestId('overlap-chunk-count')
    expect(count).toHaveTextContent('42')
    expect(count.className).toMatch(/text-right/)

    const bar = screen.getByTestId('chunking-control-bar')
    expect(within(bar).getByTestId('overlap-chunk-count')).toBeInTheDocument()
  })

  it('updates the displayed chunk count after a subsequent successful re-run', () => {
    const { rerender } = render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 10, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
    })
    rerender(<CorpusProvider><FixedSizeChunkingScreen onNavigate={vi.fn()} /></CorpusProvider>)

    expect(screen.getByTestId('overlap-chunk-count')).toHaveTextContent('10')

    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 25, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
    })
    rerender(<CorpusProvider><FixedSizeChunkingScreen onNavigate={vi.fn()} /></CorpusProvider>)

    expect(screen.getByTestId('overlap-chunk-count')).toHaveTextContent('25')
  })
})

describe('FixedSizeChunkingScreen — bottom action bar and Move to Embeddings gating (US3)', () => {
  it('shows exactly three buttons in the bottom bar', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /re-calculate chunks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save chunks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move to embeddings/i })).toBeInTheDocument()
  })

  it('disables Move to Embeddings until a chunk save has succeeded once', () => {
    mockState({ hasSavedOnce: false })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /move to embeddings/i })).toBeDisabled()
  })

  it('keeps Move to Embeddings disabled after a successful preview alone, before any save', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      hasSavedOnce: false,
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /move to embeddings/i })).toBeDisabled()
  })

  it('enables Move to Embeddings once hasSavedOnce is true and navigates to embeddings when clicked', async () => {
    const onNavigate = vi.fn()
    mockState({ hasSavedOnce: true })

    render(<FixedSizeChunkingScreen onNavigate={onNavigate} />)

    const button = screen.getByRole('button', { name: /move to embeddings/i })
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(onNavigate).toHaveBeenCalledWith('embeddings')
  })
})

describe('FixedSizeChunkingScreen — Save Chunks button (012-save-chunks-button US2)', () => {
  it('disables Save Chunks when there is no successful preview yet', () => {
    mockState({ status: 'idle', result: null })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /save chunks/i })).toBeDisabled()
  })

  it('enables Save Chunks after a successful preview and calls save() when clicked', async () => {
    const state = mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const button = screen.getByRole('button', { name: /save chunks/i })
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(state.save).toHaveBeenCalled()
  })

  it('disables Save Chunks while a save is in flight', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      saveStatus: 'saving',
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /save chunks/i })).toBeDisabled()
  })

  it('shows a clear error message when saving fails', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      saveStatus: 'error',
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved|failed to save/i)
  })
})

describe('FixedSizeChunkingScreen — saved/unsaved indicator (012-save-chunks-button US3)', () => {
  it('shows an unsaved indicator when the current preview has not been saved', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      isSaved: false,
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('save-status-indicator')).toHaveTextContent(/not saved|unsaved/i)
  })

  it('shows a saved indicator when the current preview matches what was saved', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      isSaved: true,
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('save-status-indicator')).toHaveTextContent(/^saved$/i)
  })
})

describe('FixedSizeChunkingScreen — Entire Corpus (018-ui-polish-batch US1)', () => {
  it('renders an Entire Corpus option in the document selector', () => {
    mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Entire Corpus' })).toBeInTheDocument()
  })

  it('calls run with the Entire Corpus sentinel when selected and Re-Calculate Chunks is clicked', async () => {
    const state = mockState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText(/select document/i), 'Entire Corpus')
    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(state.run).toHaveBeenCalledWith(ENTIRE_CORPUS_SELECTION, 512, 50)
  })

  it('shows combined progress and the current document while an Entire Corpus run is in progress', () => {
    mockState({
      status: 'running',
      isEntireCorpus: true,
      batchProgress: { index: 2, total: 12, documentId: 'doc-x', documentName: 'name.pdf', documentPercent: 42 },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByText(/processing document 3 of 12 \(name\.pdf\)/i)).toBeInTheDocument()
  })

  it('shows a per-document summary after an Entire Corpus run completes', () => {
    mockState({
      status: 'success',
      isEntireCorpus: true,
      batchResults: [
        {
          documentId: 'doc-a',
          documentName: 'a.pdf',
          status: 'success',
          result: {
            extractionFailed: false,
            result: { chunks: [], totalChunks: 8, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
          },
        },
        {
          documentId: 'doc-b',
          documentName: 'b.pdf',
          status: 'failed',
          errorMessage: 'Chunking failed',
        },
      ],
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const summary = screen.getByTestId('entire-corpus-summary')
    expect(within(summary).getByText('a.pdf')).toBeInTheDocument()
    expect(within(summary).getByText(/8 chunks/)).toBeInTheDocument()
    expect(within(summary).getByText('b.pdf')).toBeInTheDocument()
    expect(within(summary).getByText(/chunking failed/i)).toBeInTheDocument()
  })
})

describe('FixedSizeChunkingScreen — Save Chunks progress (018-ui-polish-batch US4)', () => {
  it('shows a progress bar and percentage while saveStatus is saving', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      saveStatus: 'saving',
      saveProgressPercent: 65,
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const saveProgress = screen.getByTestId('save-progress')
    expect(within(saveProgress).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65')
    expect(within(saveProgress).getByText(/65%/)).toBeInTheDocument()
  })

  it('replaces the save progress bar with the Saved indicator once saving succeeds', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      saveStatus: 'success',
      isSaved: true,
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('save-progress')).not.toBeInTheDocument()
    expect(screen.getByTestId('save-status-indicator')).toHaveTextContent(/^saved$/i)
  })

  it('disables Save Chunks while saveStatus is saving', () => {
    mockState({
      status: 'success',
      result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50, overlap: 0 },
      saveStatus: 'saving',
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /save chunks/i })).toBeDisabled()
  })
})

describe('FixedSizeChunkingScreen — auto-loaded chunk indicator (021-sources-chunking-embeddings-refresh)', () => {
  it('shows an "already chunked" indicator when the displayed result was auto-loaded', () => {
    mockState({
      status: 'success',
      chunkOrigin: 'auto-loaded',
      result: {
        chunks: [{ index: 0, content: 'saved chunk' }],
        totalChunks: 1,
        strategy: 'fixed-size',
        chunkSize: 0,
        overlap: 0,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('already-done-indicator')).toBeInTheDocument()
  })

  it('does not show the "already chunked" indicator for a freshly computed result', () => {
    mockState({
      status: 'success',
      chunkOrigin: 'computed',
      result: {
        chunks: [{ index: 0, content: 'fresh chunk' }],
        totalChunks: 1,
        strategy: 'fixed-size',
        chunkSize: 50,
        overlap: 0,
      },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('already-done-indicator')).not.toBeInTheDocument()
  })

  it('does not show the indicator while nothing has been loaded or computed yet', () => {
    mockState({ status: 'idle', chunkOrigin: null, result: null })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('already-done-indicator')).not.toBeInTheDocument()
  })

  it('shows the "already chunked" indicator for an auto-loaded Entire Corpus summary', () => {
    mockState({
      status: 'success',
      isEntireCorpus: true,
      activeDocumentId: ENTIRE_CORPUS_SELECTION,
      chunkOrigin: 'auto-loaded',
      batchResults: [
        {
          documentId: 'doc-a',
          documentName: 'a.pdf',
          status: 'success',
          result: {
            extractionFailed: false,
            result: { chunks: [], totalChunks: 3, strategy: 'fixed-size', chunkSize: 0, overlap: 0 },
          },
        },
      ],
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('already-done-indicator')).toBeInTheDocument()
  })

  it('calling Re-Calculate Chunks is unaffected by chunkOrigin and still calls run()', async () => {
    const state = mockState({
      status: 'success',
      chunkOrigin: 'auto-loaded',
      result: { chunks: [{ index: 0, content: 'x' }], totalChunks: 1, strategy: 'fixed-size', chunkSize: 0, overlap: 0 },
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /re-calculate chunks/i }))

    expect(state.run).toHaveBeenCalledWith('report.pdf', 512, 50)
  })
})

describe('FixedSizeChunkingScreen — in-context chunk preview (023-pdf-fullscreen-chunk-view US2)', () => {
  function successState(overrides: Partial<UseFixedSizeChunking> = {}) {
    return mockState({
      status: 'success',
      result: {
        chunks: [
          { index: 0, content: 'first chunk text' },
          { index: 1, content: 'second chunk text' },
        ],
        totalChunks: 2,
        strategy: 'fixed-size',
        chunkSize: 50,
        overlap: 0,
      },
      ...overrides,
    })
  }

  it('renders a chunk-context-preview pane alongside the chunk list, defaulting to the first chunk', () => {
    successState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const preview = screen.getByTestId('mock-chunk-context-preview')
    expect(preview).toHaveTextContent('report.pdf / 0 / saved')
  })

  it('updates the in-context preview to the clicked chunk', async () => {
    successState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByText(/CHUNK_1/))

    expect(screen.getByTestId('mock-chunk-context-preview')).toHaveTextContent(
      'report.pdf / 1 / saved',
    )
  })

  it('visually marks the selected chunk card', async () => {
    successState()

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    const firstCard = screen.getByText(/CHUNK_0/).closest('button')
    const secondCard = screen.getByText(/CHUNK_1/).closest('button')
    expect(firstCard).toHaveAttribute('aria-current', 'true')
    expect(secondCard).not.toHaveAttribute('aria-current', 'true')

    await userEvent.click(screen.getByText(/CHUNK_1/))

    expect(screen.getByText(/CHUNK_0/).closest('button')).not.toHaveAttribute('aria-current', 'true')
    expect(screen.getByText(/CHUNK_1/).closest('button')).toHaveAttribute('aria-current', 'true')
  })

  it('passes hasUnsavedChanges=true to the in-context preview for a fresh, unsaved computed result', () => {
    successState({ chunkOrigin: 'computed', isSaved: false })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('mock-chunk-context-preview')).toHaveTextContent('unsaved')
  })

  it('passes hasUnsavedChanges=false to the in-context preview for an auto-loaded result', () => {
    successState({ chunkOrigin: 'auto-loaded', isSaved: true })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('mock-chunk-context-preview')).toHaveTextContent('saved')
  })

  it('does not render the in-context preview in Entire Corpus scope', () => {
    mockState({
      status: 'success',
      isEntireCorpus: true,
      activeDocumentId: ENTIRE_CORPUS_SELECTION,
      batchResults: [
        {
          documentId: 'doc-a',
          documentName: 'a.pdf',
          status: 'success',
          result: {
            extractionFailed: false,
            result: { chunks: [], totalChunks: 3, strategy: 'fixed-size', chunkSize: 0, overlap: 0 },
          },
        },
      ],
    })

    render(<FixedSizeChunkingScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('mock-chunk-context-preview')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chunk-context-preview')).not.toBeInTheDocument()
  })
})
