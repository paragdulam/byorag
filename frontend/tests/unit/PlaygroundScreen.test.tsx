import { render as rtlRender, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PlaygroundScreen } from '../../src/components/playground/PlaygroundScreen'
import { usePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'
import type { UsePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'
import type { SourceDocument } from '../../src/types/sourceDocument'
import type { Turn } from '../../src/types/playground'
import { CorpusProvider } from '../../src/context/CorpusContext'

vi.mock('../../src/hooks/usePlaygroundConversation')

function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

const mockedUsePlaygroundConversation = vi.mocked(usePlaygroundConversation)

function makeDoc(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: 'report.pdf',
    name: 'report.pdf',
    sizeBytes: 2048,
    uploadedAt: new Date('2026-07-15T10:00:00Z'),
    status: 'processed',
    ...overrides,
  }
}

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 'turn-1',
    question: 'What is the refund policy?',
    queryEmbedding: [0.1, 0.2, 0.3],
    chunks: [{ chunkId: 'c1', index: 0, content: 'first chunk', score: 0.9 }],
    llmProvider: null,
    llmModel: null,
    prompt: null,
    answer: null,
    error: null,
    createdAt: '2026-07-15T10:00:00Z',
    answeredAt: null,
    ...overrides,
  }
}

function mockState(overrides: Partial<UsePlaygroundConversation> = {}): UsePlaygroundConversation {
  const state: UsePlaygroundConversation = {
    documents: [makeDoc()],
    isLoadingDocuments: false,
    context: { documentId: 'report.pdf', chunkingStrategy: 'fixed-size', embeddingModel: 'bert' },
    isLoadingContext: false,
    turns: [],
    sendStatus: 'idle',
    generatingTurnId: null,
    isBusy: false,
    selectedTurnId: null,
    send: vi.fn(),
    generate: vi.fn(),
    selectTurn: vi.fn(),
    ...overrides,
  }
  mockedUsePlaygroundConversation.mockReturnValue(state)
  return state
}

describe('PlaygroundScreen — standard navigation shell', () => {
  it('renders within the standard navigation shell', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('SOURCES')).toBeInTheDocument()
  })
})

describe('PlaygroundScreen — split layout shell (017 FR-001)', () => {
  it('renders a left conversation panel and a right retrieval panel', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('playground-conversation-panel')).toBeInTheDocument()
    expect(screen.getByTestId('playground-retrieval-panel')).toBeInTheDocument()
  })
})

describe('PlaygroundScreen — ask a question and get an answer (017 US1)', () => {
  it('renders a question field and a send button pinned in the left panel', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByLabelText('Question')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
  })

  it('disables Send when the question is empty or whitespace-only', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    await userEvent.type(screen.getByLabelText('Question'), '   ')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('never calls send() for an empty or whitespace-only question (FR-011)', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const state = mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Question'), '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(state.send).not.toHaveBeenCalled()
  })

  it('calls send() with the typed question when Send is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const state = mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Question'), 'What is the refund policy?')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(state.send).toHaveBeenCalledWith('What is the refund policy?')
  })

  it('disables Send and Generate while a request is in flight (FR-013)', () => {
    mockState({ turns: [makeTurn()], isBusy: true })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  })

  it('shows a loading indicator and does not show an answer while generating', () => {
    const turn = makeTurn()
    mockState({ turns: [turn], generatingTurnId: turn.id, isBusy: true })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId(`turn-${turn.id}-generating`)).toBeInTheDocument()
  })

  it('calls generate() with the active turn id when Generate is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const turn = makeTurn()
    const state = mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(state.generate).toHaveBeenCalledWith(turn.id)
  })

  it('renders the generated answer as a single block below the question', () => {
    const turn = makeTurn({ answer: 'Refunds are processed within 5 business days.' })
    mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('Refunds are processed within 5 business days.')).toBeInTheDocument()
    expect(screen.getByText('What is the refund policy?')).toBeInTheDocument()
  })

  it('shows a clear error and a retry control when generation fails, without a fabricated answer', () => {
    const turn = makeTurn({ error: 'Answer generation failed.' })
    mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Answer generation failed.')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByText(turn.question)).toBeInTheDocument()
  })

  it('retrying calls generate() again with the same turn id', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const turn = makeTurn({ error: 'Answer generation failed.' })
    const state = mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(state.generate).toHaveBeenCalledWith(turn.id)
  })

  it('disables Generate when the active turn has no retrieved chunks (FR-015)', () => {
    mockState({ turns: [makeTurn({ chunks: [] })] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  })
})

describe('PlaygroundScreen — inspect retrieved chunks and query embedding (017 US2)', () => {
  it('shows each retrieved chunk identified by chunk id only, with a per-chunk Show more control', () => {
    const turn = makeTurn({
      chunks: [
        { chunkId: 'c1', index: 0, content: 'first chunk full content', score: 0.9 },
        { chunkId: 'c2', index: 1, content: 'second chunk full content', score: 0.5 },
      ],
    })
    mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/CHUNK_0/)).toBeInTheDocument()
    expect(screen.getByText(/CHUNK_1/)).toBeInTheDocument()
    expect(screen.queryByText('first chunk full content')).not.toBeInTheDocument()
    expect(screen.queryByText('second chunk full content')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show more for chunk 0/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show more for chunk 1/i })).toBeInTheDocument()
  })

  it("reveals a chunk's full content only after its own Show more is clicked", async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const turn = makeTurn({
      chunks: [
        { chunkId: 'c1', index: 0, content: 'first chunk full content', score: 0.9 },
        { chunkId: 'c2', index: 1, content: 'second chunk full content', score: 0.5 },
      ],
    })
    mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /show more for chunk 0/i }))

    expect(screen.getByText('first chunk full content')).toBeInTheDocument()
    expect(screen.queryByText('second chunk full content')).not.toBeInTheDocument()
  })

  it('shows at most 2 rows of query embedding values by default, with a Show more control', () => {
    const values = Array.from({ length: 24 }, (_, i) => i / 100)
    mockState({ turns: [makeTurn({ queryEmbedding: values })] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    const preview = screen.getByTestId('playground-embedding-preview')
    expect(preview).toHaveTextContent('0.15')
    expect(preview).not.toHaveTextContent('0.16')
    expect(screen.getByRole('button', { name: /show more embedding values/i })).toBeInTheDocument()
  })

  it('reveals the remaining embedding values after Show more is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const values = Array.from({ length: 24 }, (_, i) => i / 100)
    mockState({ turns: [makeTurn({ queryEmbedding: values })] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /show more embedding values/i }))

    expect(screen.getByTestId('playground-embedding-preview')).toHaveTextContent('0.23')
  })

  it('lays out the right panel top-to-bottom as Generate, then chunks, then embedding', () => {
    mockState({ turns: [makeTurn()] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    const panel = screen.getByTestId('playground-retrieval-panel')
    const html = panel.innerHTML
    const generateIndex = html.indexOf('Generate')
    const chunksIndex = html.indexOf('playground-chunk-list')
    const embeddingIndex = html.indexOf('playground-embedding-preview')

    expect(generateIndex).toBeGreaterThanOrEqual(0)
    expect(generateIndex).toBeLessThan(chunksIndex)
    expect(chunksIndex).toBeLessThan(embeddingIndex)
  })

  it('defaults the right panel to the newest turn when no turn is explicitly selected', () => {
    const olderTurn = makeTurn({
      id: 'turn-older',
      question: 'Older question?',
      answer: 'Older answer.',
      chunks: [{ chunkId: 'old-chunk', index: 0, content: 'older chunk content', score: 0.8 }],
    })
    const newerTurn = makeTurn({
      id: 'turn-newer',
      question: 'Newer question?',
      answer: 'Newer answer.',
      chunks: [{ chunkId: 'new-chunk', index: 5, content: 'newer chunk content', score: 0.7 }],
    })
    mockState({ turns: [olderTurn, newerTurn], selectedTurnId: null })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/CHUNK_5/)).toBeInTheDocument()
    expect(screen.queryByText(/CHUNK_0/)).not.toBeInTheDocument()
  })

  it('shows the explicitly selected turn instead of the newest one', () => {
    const olderTurn = makeTurn({
      id: 'turn-older',
      question: 'Older question?',
      answer: 'Older answer.',
      chunks: [{ chunkId: 'old-chunk', index: 0, content: 'older chunk content', score: 0.8 }],
    })
    const newerTurn = makeTurn({
      id: 'turn-newer',
      question: 'Newer question?',
      answer: 'Newer answer.',
      chunks: [{ chunkId: 'new-chunk', index: 5, content: 'newer chunk content', score: 0.7 }],
    })
    mockState({ turns: [olderTurn, newerTurn], selectedTurnId: 'turn-older' })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/CHUNK_0/)).toBeInTheDocument()
    expect(screen.queryByText(/CHUNK_5/)).not.toBeInTheDocument()
  })

  it('calls selectTurn() with that turn\'s id when a past answer is clicked', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const olderTurn = makeTurn({ id: 'turn-older', question: 'Older question?', answer: 'Older answer.' })
    const newerTurn = makeTurn({ id: 'turn-newer', question: 'Newer question?', answer: 'Newer answer.' })
    const state = mockState({ turns: [olderTurn, newerTurn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Answer to Older question?' }))

    expect(state.selectTurn).toHaveBeenCalledWith('turn-older')
  })
})

describe('PlaygroundScreen — playground context display', () => {
  it('displays the selected document, its chunking strategy, and embedding model', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    const context = screen.getByTestId('playground-context')
    expect(context).toHaveTextContent('fixed-size')
    expect(context).toHaveTextContent('bert')
  })

  it('shows a clear message when the document has no saved embeddings', () => {
    mockState({
      context: { documentId: 'report.pdf', chunkingStrategy: 'fixed-size', embeddingModel: null },
    })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByText(/no saved embeddings/i)).toBeInTheDocument()
  })
})
