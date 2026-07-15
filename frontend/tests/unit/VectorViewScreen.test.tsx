import { render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VectorViewScreen } from '../../src/components/vector-view/VectorViewScreen'
import { useVectorView } from '../../src/hooks/useVectorView'
import type { UseVectorView } from '../../src/hooks/useVectorView'
import type { SourceDocument } from '../../src/types/sourceDocument'
import { CorpusProvider } from '../../src/context/CorpusContext'

vi.mock('../../src/hooks/useVectorView')

// Renders via CorpusProvider, matching every other screen test's convention — required
// because AppShell -> SidebarNav reads the active corpus from context.
function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

const mockedUseVectorView = vi.mocked(useVectorView)

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

function mockState(overrides: Partial<UseVectorView> = {}): UseVectorView {
  const state: UseVectorView = {
    documents: [makeDoc()],
    isLoadingDocuments: false,
    savedChunks: [
      { id: 'chunk-1', index: 0, content: 'first chunk text' },
      { id: 'chunk-2', index: 1, content: 'second chunk text' },
    ],
    isLoadingSavedChunks: false,
    savedEmbeddings: [],
    isLoadingSavedEmbeddings: false,
    projectionMethods: [
      { id: 'vector', label: 'Vector', available: true },
      { id: 'umap', label: 'UMAP', available: false },
      { id: 'pca', label: 'PCA', available: false },
    ],
    ...overrides,
  }
  mockedUseVectorView.mockReturnValue(state)
  return state
}

describe('VectorViewScreen — standard navigation shell (014-vector-view-screen US1)', () => {
  it('renders within the standard navigation shell with a "Vector View" heading', () => {
    mockState()

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Vector View' })).toBeInTheDocument()
    expect(screen.getByText('CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('SOURCES')).toBeInTheDocument()
  })
})

describe('VectorViewScreen — two-pane chunk browsing and vector display (014-vector-view-screen US2)', () => {
  it('lists the saved chunks with content and position on the left', () => {
    mockState()

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('first chunk text')).toBeInTheDocument()
    expect(screen.getByText('second chunk text')).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_0/)).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_1/)).toBeInTheDocument()
  })

  it('shows the exact stored vector as a grid for a chunk with exactly one saved embedding', () => {
    mockState({
      savedEmbeddings: [
        { id: 'emb-1', model: 'bert', createdAt: '2026-07-15T10:03:00Z', dims: 3, vector: [0.1, 0.2, 0.3] },
      ],
    })

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const grid = screen.getByTestId('vector-grid')
    expect(within(grid).getByText('0.1')).toBeInTheDocument()
    expect(within(grid).getByText('0.2')).toBeInTheDocument()
    expect(within(grid).getByText('0.3')).toBeInTheDocument()
  })

  it('offers a picker when a chunk has more than one saved embedding, defaulting to the newest, and shows only the chosen one', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({
      savedEmbeddings: [
        { id: 'emb-newest', model: 'bert', createdAt: '2026-07-15T10:05:00Z', dims: 1, vector: [0.9] },
        { id: 'emb-oldest', model: 'bert', createdAt: '2026-07-15T10:03:00Z', dims: 1, vector: [0.1] },
      ],
    })

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const picker = screen.getByLabelText(/saved embedding/i) as HTMLSelectElement
    expect(picker.value).toBe('emb-newest')
    expect(within(screen.getByTestId('vector-grid')).getByText('0.9')).toBeInTheDocument()
    expect(within(screen.getByTestId('vector-grid')).queryByText('0.1')).not.toBeInTheDocument()

    await userEvent.selectOptions(picker, 'emb-oldest')

    expect(within(screen.getByTestId('vector-grid')).getByText('0.1')).toBeInTheDocument()
    expect(within(screen.getByTestId('vector-grid')).queryByText('0.9')).not.toBeInTheDocument()
  })

  it('shows a clear message when the selected chunk has no saved embeddings', () => {
    mockState({ savedEmbeddings: [] })

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/no saved embeddings|nothing saved/i)).toBeInTheDocument()
    expect(screen.queryByTestId('vector-grid')).not.toBeInTheDocument()
  })
})

describe('VectorViewScreen — projection method dropdown (014-vector-view-screen US3)', () => {
  it('shows a dropdown above the vector display with "Vector" pre-selected', () => {
    mockState({
      savedEmbeddings: [
        { id: 'emb-1', model: 'bert', createdAt: '2026-07-15T10:03:00Z', dims: 1, vector: [0.5] },
      ],
    })

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const select = screen.getByLabelText(/projection method/i) as HTMLSelectElement
    expect(select.value).toBe('vector')
  })

  it('shows a "not available yet" message instead of the grid when an unavailable method is selected', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({
      savedEmbeddings: [
        { id: 'emb-1', model: 'bert', createdAt: '2026-07-15T10:03:00Z', dims: 1, vector: [0.5] },
      ],
    })

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const select = screen.getByLabelText(/projection method/i)
    await userEvent.selectOptions(select, 'umap')

    expect(screen.getByText(/not available yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId('vector-grid')).not.toBeInTheDocument()
  })

  it('restores the grid when switching back to "Vector"', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({
      savedEmbeddings: [
        { id: 'emb-1', model: 'bert', createdAt: '2026-07-15T10:03:00Z', dims: 1, vector: [0.5] },
      ],
    })

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const select = screen.getByLabelText(/projection method/i)
    await userEvent.selectOptions(select, 'umap')
    await userEvent.selectOptions(select, 'vector')

    expect(screen.getByTestId('vector-grid')).toBeInTheDocument()
    expect(screen.queryByText(/not available yet/i)).not.toBeInTheDocument()
  })
})

describe('VectorViewScreen — Move to Playground (014-vector-view-screen US4)', () => {
  it('renders a "Move to Playground" button in the bottom bar and navigates when clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const onNavigate = vi.fn()
    mockState()

    render(<VectorViewScreen onNavigate={onNavigate} />)

    const button = screen.getByRole('button', { name: /move to playground/i })
    await userEvent.click(button)

    expect(onNavigate).toHaveBeenCalledWith('playground')
  })
})

function lastHookCallArgs(): [unknown, string | null, string | null] {
  const calls = mockedUseVectorView.mock.calls
  const last = calls[calls.length - 1]
  return [last?.[0] ?? null, last?.[1] ?? null, last?.[2] ?? null]
}

describe('VectorViewScreen — auto-selected document/chunk load saved data (015-fix-saved-chunks-not-showing US2)', () => {
  it('calls useVectorView with the auto-selected document id, not null, once documents load', () => {
    mockState()

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const [, documentId] = lastHookCallArgs()
    expect(documentId).toBe('report.pdf')
  })

  it('calls useVectorView with the auto-selected chunk id, not null, once saved chunks load', () => {
    mockState()

    render(<VectorViewScreen onNavigate={vi.fn()} />)

    const [, , chunkId] = lastHookCallArgs()
    expect(chunkId).toBe('chunk-1')
  })

  it('re-selects the new first document and chunk when the lists change (e.g. corpus switch)', () => {
    mockState()

    const { rerender } = render(<VectorViewScreen onNavigate={vi.fn()} />)
    expect(lastHookCallArgs().slice(1)).toEqual(['report.pdf', 'chunk-1'])

    mockState({
      documents: [makeDoc({ id: 'other.pdf', name: 'other.pdf' })],
      savedChunks: [{ id: 'chunk-9', index: 0, content: 'other chunk text' }],
    })
    rerender(<CorpusProvider><VectorViewScreen onNavigate={vi.fn()} /></CorpusProvider>)

    expect(lastHookCallArgs().slice(1)).toEqual(['other.pdf', 'chunk-9'])
  })

  it('still calls useVectorView with manually-selected document and chunk ids', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({
      documents: [makeDoc({ id: 'a.pdf', name: 'a.pdf' }), makeDoc({ id: 'b.pdf', name: 'b.pdf' })],
      savedChunks: [
        { id: 'chunk-1', index: 0, content: 'first chunk text' },
        { id: 'chunk-2', index: 1, content: 'second chunk text' },
      ],
    })

    render(<VectorViewScreen onNavigate={vi.fn()} />)
    expect(lastHookCallArgs().slice(1)).toEqual(['a.pdf', 'chunk-1'])

    await userEvent.click(screen.getByLabelText(/select chunk 1/i))
    expect(lastHookCallArgs().slice(1)).toEqual(['a.pdf', 'chunk-2'])

    await userEvent.selectOptions(screen.getByLabelText(/select document/i), 'b.pdf')
    expect(lastHookCallArgs()[1]).toBe('b.pdf')
  })
})
