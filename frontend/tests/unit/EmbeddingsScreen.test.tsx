import { render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EmbeddingsScreen } from '../../src/components/embeddings/EmbeddingsScreen'
import { useChunkEmbeddings } from '../../src/hooks/useChunkEmbeddings'
import type { UseChunkEmbeddings } from '../../src/hooks/useChunkEmbeddings'
import type { SourceDocument } from '../../src/types/sourceDocument'
import { CorpusProvider } from '../../src/context/CorpusContext'
import { ENTIRE_CORPUS_SELECTION } from '../../src/lib/entireCorpusSelection'

vi.mock('../../src/hooks/useChunkEmbeddings')

// Renders via CorpusProvider, matching FixedSizeChunkingScreen.test.tsx's convention —
// required because AppShell -> SidebarNav reads the active corpus from context.
function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

const mockedUseChunkEmbeddings = vi.mocked(useChunkEmbeddings)

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

function mockState(overrides: Partial<UseChunkEmbeddings> = {}): UseChunkEmbeddings {
  const state: UseChunkEmbeddings = {
    documents: [makeDoc()],
    isLoadingDocuments: false,
    models: [{ id: 'bert', label: 'BERT (bert-base-uncased)' }],
    activeModel: 'bert',
    savedChunks: [
      { id: 'chunk-1', index: 0, content: 'first chunk text' },
      { id: 'chunk-2', index: 1, content: 'second chunk text' },
    ],
    isLoadingSavedChunks: false,
    generateStatus: 'idle',
    progressPercent: 0,
    preview: null,
    generate: vi.fn(),
    saveStatus: 'idle',
    saveProgressPercent: 0,
    save: vi.fn(),
    hasSavedOnce: false,
    isEntireCorpus: false,
    batchProgress: null,
    generateBatchResults: [],
    saveBatchResults: [],
    existingEmbeddingsSummary: [],
    isLoadingExistingEmbeddings: false,
    ...overrides,
  }
  mockedUseChunkEmbeddings.mockReturnValue(state)
  return state
}

describe('EmbeddingsScreen — standard navigation shell', () => {
  it('renders within the standard navigation shell', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('SOURCES')).toBeInTheDocument()
  })
})

describe('EmbeddingsScreen — saved chunks and model picker (013-bert-pgvector-embeddings US1)', () => {
  it('renders a document dropdown and a model dropdown', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByLabelText(/select document/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/embedding model/i)).toBeInTheDocument()
  })

  it('lists uploaded documents in the document picker', () => {
    mockState({ documents: [makeDoc({ id: 'a.pdf', name: 'a.pdf' })] })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'a.pdf' })).toBeInTheDocument()
  })

  it('pre-selects the first model in the model picker', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const select = screen.getByLabelText(/embedding model/i) as HTMLSelectElement
    expect(select.value).toBe('bert')
    expect(within(select).getByRole('option', { name: /BERT/i })).toBeInTheDocument()
  })

  it('displays the selected document saved chunks with content and position', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('first chunk text')).toBeInTheDocument()
    expect(screen.getByText('second chunk text')).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_0/)).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_1/)).toBeInTheDocument()
  })

  it('shows a clear message when the selected document has no saved chunks', () => {
    mockState({ savedChunks: [] })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/no saved chunks/i)).toBeInTheDocument()
  })

  it('shows a message when there are no documents at all', () => {
    mockState({ documents: [] })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/no documents available/i)).toBeInTheDocument()
  })
})

describe('EmbeddingsScreen — Generate Embeddings (013-bert-pgvector-embeddings US2)', () => {
  it('disables Generate Embeddings when the selected document has no saved chunks', () => {
    mockState({ savedChunks: [] })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /generate embeddings/i })).toBeDisabled()
  })

  it('calls generate() with the selected document and model when clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const state = mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /generate embeddings/i }))

    expect(state.generate).toHaveBeenCalledWith('report.pdf', 'bert')
  })

  it('shows a progress indicator while generating', () => {
    mockState({ generateStatus: 'generating', progressPercent: 40 })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '40')
  })

  it('shows a completed-but-unsaved preview after a successful generate', () => {
    mockState({
      generateStatus: 'success',
      preview: {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [
          { chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] },
          { chunkId: 'chunk-2', model: 'bert', dims: 768, vector: [0.2] },
        ],
      },
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText(/2 embeddings generated/i)).toBeInTheDocument()
  })

  it('shows a clear error message when generation fails', () => {
    mockState({ generateStatus: 'error' })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be generated|failed to generate/i)
  })
})

describe('EmbeddingsScreen — Save (013-bert-pgvector-embeddings US3)', () => {
  it('disables Save when there is no generated preview', () => {
    mockState({ generateStatus: 'idle', preview: null })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('enables Save after a successful generate and calls save() when clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const state = mockState({
      generateStatus: 'success',
      preview: {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      },
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const button = screen.getByRole('button', { name: /^save$/i })
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(state.save).toHaveBeenCalled()
  })

  it('shows its own progress indicator while saving, independent of generate progress', () => {
    mockState({
      generateStatus: 'success',
      preview: {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      },
      saveStatus: 'saving',
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
    expect(screen.getByTestId('embeddings-save-progress')).toBeInTheDocument()
  })

  it('shows a clear error message when saving fails', () => {
    mockState({
      generateStatus: 'success',
      preview: {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      },
      saveStatus: 'error',
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be saved|failed to save/i)
  })

  it("saving embeddings never disables or otherwise affects Generate Embeddings' own state", () => {
    mockState({
      generateStatus: 'success',
      preview: {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      },
      saveStatus: 'saving',
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /generate embeddings/i })).toBeEnabled()
  })
})

describe('EmbeddingsScreen — Move to Vector View (014-vector-view-screen US1)', () => {
  it('renders a "Move to Vector View" button next to "Save" in the bottom bar', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /move to vector view/i })).toBeInTheDocument()
  })

  it('disables Move to Vector View until a save has succeeded once', () => {
    mockState({ hasSavedOnce: false })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /move to vector view/i })).toBeDisabled()
  })

  it('enables Move to Vector View once hasSavedOnce is true and navigates to vector-view when clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const onNavigate = vi.fn()
    mockState({ hasSavedOnce: true })

    render(<EmbeddingsScreen onNavigate={onNavigate} />)

    const button = screen.getByRole('button', { name: /move to vector view/i })
    expect(button).toBeEnabled()

    await userEvent.click(button)

    expect(onNavigate).toHaveBeenCalledWith('vector-view')
  })
})

function lastDocumentIdArg(): string | null {
  const calls = mockedUseChunkEmbeddings.mock.calls
  return calls[calls.length - 1]?.[1] ?? null
}

describe('EmbeddingsScreen — auto-selected document loads saved chunks (015-fix-saved-chunks-not-showing US1)', () => {
  it('calls useChunkEmbeddings with the auto-selected document id, not null, once documents load', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(lastDocumentIdArg()).toBe('report.pdf')
  })

  it('re-selects the new first document when the document list changes (e.g. corpus switch)', () => {
    mockState()

    const { rerender } = render(<EmbeddingsScreen onNavigate={vi.fn()} />)
    expect(lastDocumentIdArg()).toBe('report.pdf')

    mockState({ documents: [makeDoc({ id: 'other.pdf', name: 'other.pdf' })] })
    rerender(<CorpusProvider><EmbeddingsScreen onNavigate={vi.fn()} /></CorpusProvider>)

    expect(lastDocumentIdArg()).toBe('other.pdf')
  })

  it('still calls useChunkEmbeddings with a manually-selected document id', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({
      documents: [makeDoc({ id: 'a.pdf', name: 'a.pdf' }), makeDoc({ id: 'b.pdf', name: 'b.pdf' })],
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)
    expect(lastDocumentIdArg()).toBe('a.pdf')

    await userEvent.selectOptions(screen.getByLabelText(/select document/i), 'b.pdf')

    expect(lastDocumentIdArg()).toBe('b.pdf')
  })
})

describe('EmbeddingsScreen — Entire Corpus (018-ui-polish-batch US2)', () => {
  it('renders an Entire Corpus option in the document selector', () => {
    mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('option', { name: 'Entire Corpus' })).toBeInTheDocument()
  })

  it('does not disable Generate Embeddings for an empty savedChunks list while Entire Corpus is selected', () => {
    mockState({ isEntireCorpus: true, savedChunks: [] })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /generate embeddings/i })).toBeEnabled()
  })

  it('calls generate with the Entire Corpus sentinel when selected and clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const state = mockState()

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText(/select document/i), 'Entire Corpus')
    await userEvent.click(screen.getByRole('button', { name: /generate embeddings/i }))

    expect(state.generate).toHaveBeenCalledWith(ENTIRE_CORPUS_SELECTION, 'bert')
  })

  it('shows combined progress while an Entire Corpus generate is in progress', () => {
    mockState({
      generateStatus: 'generating',
      isEntireCorpus: true,
      batchProgress: { index: 1, total: 3, documentId: 'doc-b', documentName: 'b.pdf', documentPercent: 0 },
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/processing document 2 of 3 \(b\.pdf\)/i)).toBeInTheDocument()
  })

  it('shows a per-document summary after an Entire Corpus generate completes, including a failed/skipped document\'s error message', () => {
    mockState({
      generateStatus: 'success',
      isEntireCorpus: true,
      generateBatchResults: [
        {
          documentId: 'doc-a',
          documentName: 'a.pdf',
          status: 'success',
          result: { documentId: 'doc-a', model: 'bert', vectors: [{ chunkId: 'c1', model: 'bert', dims: 768, vector: [] }] },
        },
        {
          documentId: 'doc-b',
          documentName: 'b.pdf',
          status: 'failed',
          errorMessage: 'Failed to generate embeddings',
        },
      ],
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const summary = screen.getByTestId('entire-corpus-summary')
    expect(within(summary).getByText('a.pdf')).toBeInTheDocument()
    expect(within(summary).getByText(/1 embeddings generated/i)).toBeInTheDocument()
    expect(within(summary).getByText('b.pdf')).toBeInTheDocument()
    expect(within(summary).getByText(/failed to generate embeddings/i)).toBeInTheDocument()
  })

  it('shows the correct saved counts (not 0) in the per-document summary after an Entire Corpus save completes', () => {
    mockState({
      generateStatus: 'success',
      saveStatus: 'success',
      isEntireCorpus: true,
      generateBatchResults: [
        {
          documentId: 'doc-a',
          documentName: 'a.pdf',
          status: 'success',
          result: { documentId: 'doc-a', model: 'bert', vectors: [{ chunkId: 'c1', model: 'bert', dims: 768, vector: [] }] },
        },
      ],
      saveBatchResults: [
        {
          documentId: 'doc-a',
          documentName: 'a.pdf',
          status: 'success',
          result: { documentId: 'doc-a', model: 'bert', savedCount: 4 },
        },
        {
          documentId: 'doc-b',
          documentName: 'b.pdf',
          status: 'failed',
          errorMessage: 'Failed to save embeddings',
        },
      ],
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const summary = screen.getByTestId('entire-corpus-summary')
    // The regression this guards: the summary must read the save result's `savedCount`, not the
    // unrelated `vectors` field from a generate result — which previously always showed 0.
    expect(within(summary).getByText(/4 embeddings saved/i)).toBeInTheDocument()
    expect(within(summary).queryByText(/0 embeddings/i)).not.toBeInTheDocument()
    expect(within(summary).getByText(/failed to save embeddings/i)).toBeInTheDocument()
  })

  it('enables Save once an Entire Corpus generate has succeeded', () => {
    mockState({ generateStatus: 'success', isEntireCorpus: true, preview: null })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: /^save$/i })).toBeEnabled()
  })
})

describe('EmbeddingsScreen — existing saved embeddings (adjacent fix, post-021-sources-chunking-embeddings-refresh)', () => {
  it('shows the shared already-done indicator for the selected document, before any action this session', () => {
    mockState({
      existingEmbeddingsSummary: [
        { documentId: 'report.pdf', documentName: 'report.pdf', existingCount: 2, totalChunks: 2 },
      ],
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const indicator = screen.getByTestId('already-done-indicator')
    expect(indicator).toHaveTextContent(/embedding generation already performed for this document/i)
  })

  it('shows the shared already-done indicator under Entire Corpus scope when any document already has embeddings', () => {
    mockState({
      isEntireCorpus: true,
      existingEmbeddingsSummary: [
        { documentId: 'doc-a', documentName: 'a.pdf', existingCount: 1, totalChunks: 2 },
        { documentId: 'doc-b', documentName: 'b.pdf', existingCount: 0, totalChunks: 2 },
      ],
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const indicator = screen.getByTestId('already-done-indicator')
    expect(indicator).toHaveTextContent(/embedding generation already performed for this corpus/i)
  })

  it('does not show the already-done indicator once a fresh generate/save has happened this session', () => {
    mockState({
      existingEmbeddingsSummary: [
        { documentId: 'report.pdf', documentName: 'report.pdf', existingCount: 2, totalChunks: 2 },
      ],
      generateStatus: 'success',
      generateBatchResults: [
        {
          documentId: 'report.pdf',
          documentName: 'report.pdf',
          status: 'success',
          result: { documentId: 'report.pdf', model: 'bert', vectors: [] },
        },
      ],
      isEntireCorpus: true,
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('already-done-indicator')).not.toBeInTheDocument()
  })

  it('does not show the already-done indicator when nothing already exists', () => {
    mockState({ existingEmbeddingsSummary: [] })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('already-done-indicator')).not.toBeInTheDocument()
  })

  it('does not fall back to the single-document "no saved chunks" message under Entire Corpus scope', () => {
    // Regression: this document/single-doc-scoped fallback (savedChunks/preview) rendered
    // unconditionally whenever neither batch-results array had data yet, including under Entire
    // Corpus scope before any fresh run this session — showing a confusing "No saved chunks for
    // this document yet" message alongside the correct per-corpus already-done indicator.
    mockState({
      isEntireCorpus: true,
      existingEmbeddingsSummary: [
        { documentId: 'doc-a', documentName: 'a.pdf', existingCount: 1, totalChunks: 2 },
      ],
      savedChunks: [],
    })

    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('already-done-indicator')).toBeInTheDocument()
    expect(screen.queryByText(/no saved chunks for this document yet/i)).not.toBeInTheDocument()
  })
})
