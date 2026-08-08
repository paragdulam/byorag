import { render as rtlRender, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PlaygroundScreen } from '../../src/components/playground/PlaygroundScreen'
import { usePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'
import type { UsePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'
import type { SourceDocument } from '../../src/types/sourceDocument'
import type { Turn } from '../../src/types/playground'
import { CorpusProvider } from '../../src/context/CorpusContext'
import { ENTIRE_CORPUS_SELECTION } from '../../src/lib/entireCorpusSelection'

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
    scope: 'document',
    documentId: 'report.pdf',
    corpusId: null,
    question: 'What is the refund policy?',
    queryEmbedding: [0.1, 0.2, 0.3],
    chunks: [{ chunkId: 'c1', documentId: 'report.pdf', index: 0, content: 'first chunk', score: 0.9 }],
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
    send: vi.fn(),
    generate: vi.fn(),
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

describe('PlaygroundScreen — typography parity with Corpora (033-ui-ux-polish US6)', () => {
  it('uses the Corpora-reference heading scale for the page title', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Playground' }).className).toContain('text-4xl')
  })
})

describe('PlaygroundScreen — single full-width sequential layout (031-playground-metrics-redesign US1)', () => {
  it('renders one full-width column instead of a left/right panel split', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId('playground-turns')).toBeInTheDocument()
    expect(screen.queryByTestId('playground-conversation-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('playground-retrieval-panel')).not.toBeInTheDocument()
  })

  it('renders no button labeled "Generate" anywhere on the screen', () => {
    mockState({ turns: [makeTurn()] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^generate$/i })).not.toBeInTheDocument()
  })
})

describe('PlaygroundScreen — ask a question and get an answer automatically (031-playground-metrics-redesign US1)', () => {
  it('renders a question field and a send button pinned below the turn history', () => {
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

  it('disables Send while a request is in flight (FR-013)', () => {
    mockState({ turns: [makeTurn()], isBusy: true })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  it('shows a loading indicator and does not show an answer while generating', () => {
    const turn = makeTurn()
    mockState({ turns: [turn], generatingTurnId: turn.id, isBusy: true })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.getByTestId(`turn-${turn.id}-generating`)).toBeInTheDocument()
  })

  it('renders the generated answer as a single block below the question, with no manual step (FR-005)', () => {
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

  it('retrying calls generate() again with the same turn id (FR-008)', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const turn = makeTurn({ error: 'Answer generation failed.' })
    const state = mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(state.generate).toHaveBeenCalledWith(turn.id)
  })
})

describe('PlaygroundScreen — every turn shows its own retrieved chunks and query embedding behind Actions (033-ui-ux-polish US6)', () => {
  async function openQueryEmbedding(question: RegExp) {
    const userEvent = (await import('@testing-library/user-event')).default
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`actions for `, 'i') }))
    await userEvent.click(screen.getByRole('menuitem', { name: /query embedding/i }))
    void question
  }

  async function openRetrievedChunks(question: RegExp) {
    const userEvent = (await import('@testing-library/user-event')).default
    await userEvent.click(screen.getByRole('button', { name: new RegExp(`actions for `, 'i') }))
    await userEvent.click(screen.getByRole('menuitem', { name: /retrieved chunks/i }))
    void question
  }

  it('shows each retrieved chunk with its cosine similarity once Retrieved Chunks is chosen', async () => {
    const turn = makeTurn({
      chunks: [
        { chunkId: 'c1', documentId: 'report.pdf', index: 0, content: 'first chunk full content', score: 0.9 },
        { chunkId: 'c2', documentId: 'report.pdf', index: 1, content: 'second chunk full content', score: 0.5 },
      ],
    })
    mockState({ turns: [turn] })
    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    expect(screen.queryByTestId('playground-retrieved-chunks')).not.toBeInTheDocument()

    await openRetrievedChunks(/refund/i)

    const chunkList = screen.getByTestId('playground-retrieved-chunks')
    expect(within(chunkList).getByText(/CHUNK_0/)).toBeInTheDocument()
    expect(within(chunkList).getByText(/CHUNK_1/)).toBeInTheDocument()
    expect(within(chunkList).getByText('first chunk full content')).toBeInTheDocument()
    expect(within(chunkList).getByText('second chunk full content')).toBeInTheDocument()
    expect(within(chunkList).getByText(/0\.900/)).toBeInTheDocument()
    expect(within(chunkList).getByText(/0\.500/)).toBeInTheDocument()
  })

  it('shows at most 2 rows of query embedding values by default, with a Show more control, once Query Embedding is chosen', async () => {
    const values = Array.from({ length: 24 }, (_, i) => i / 100)
    mockState({ turns: [makeTurn({ queryEmbedding: values })] })
    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    await openQueryEmbedding(/refund/i)

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
    await openQueryEmbedding(/refund/i)

    await userEvent.click(screen.getByRole('button', { name: /show more embedding values/i }))

    expect(screen.getByTestId('playground-embedding-preview')).toHaveTextContent('0.23')
  })

  it('keeps every turn fully visible and independently detailed at once — an older turn is not hidden or replaced by a newer one', () => {
    const olderTurn = makeTurn({
      id: 'turn-older',
      question: 'Older question?',
      answer: 'Older answer.',
      chunks: [{ chunkId: 'old-chunk', documentId: 'report.pdf', index: 0, content: 'older chunk content', score: 0.8 }],
    })
    const newerTurn = makeTurn({
      id: 'turn-newer',
      question: 'Newer question?',
      answer: 'Newer answer.',
      chunks: [{ chunkId: 'new-chunk', documentId: 'report.pdf', index: 5, content: 'newer chunk content', score: 0.7 }],
    })
    mockState({ turns: [olderTurn, newerTurn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)

    const olderTurnEl = screen.getByTestId('turn-turn-older')
    const newerTurnEl = screen.getByTestId('turn-turn-newer')
    expect(within(olderTurnEl).getByText('Older question?')).toBeInTheDocument()
    expect(within(olderTurnEl).getByText('Older answer.')).toBeInTheDocument()
    expect(within(newerTurnEl).getByText('Newer question?')).toBeInTheDocument()
    expect(within(newerTurnEl).getByText('Newer answer.')).toBeInTheDocument()
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

describe('PlaygroundScreen — deep linking (034-more-deep-links)', () => {
  it('scrolls the linked turn into view and highlights it, per a deep link', () => {
    Element.prototype.scrollIntoView = vi.fn()
    const turnOne = makeTurn({ id: 'turn-1', question: 'First question?' })
    const turnTwo = makeTurn({ id: 'turn-2', question: 'Second question?' })
    mockState({ turns: [turnOne, turnTwo] })

    render(<PlaygroundScreen onNavigate={vi.fn()} linkedTurnId="turn-2" />)

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    expect(screen.getByTestId('turn-turn-2').className).toContain('border-primary')
    expect(screen.getByTestId('turn-turn-1').className).not.toContain('border-primary')
  })

  it('writes the expected shareable URL to the clipboard from a turn\'s "Copy link"', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const turn = makeTurn({ id: 'turn-9', question: 'What is the refund policy?' })
    mockState({ turns: [turn] })

    render(<PlaygroundScreen onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /actions for what is the refund policy/i }))
    await userEvent.click(screen.getByRole('menuitem', { name: /copy link/i }))

    expect(writeText.mock.calls[0][0]).toMatch(/\/playground\/[^/]*\/turn-9$/)
  })
})

describe('PlaygroundScreen — document dropdown deep link (035-document-scope-deep-links)', () => {
  it('calls onDocumentSelected when the Select Document dropdown changes', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({ documents: [makeDoc({ id: 'report.pdf' }), makeDoc({ id: 'other.pdf', name: 'other.pdf' })] })
    const onDocumentSelected = vi.fn()

    render(<PlaygroundScreen onNavigate={vi.fn()} onDocumentSelected={onDocumentSelected} />)
    await userEvent.selectOptions(screen.getByLabelText('Select document'), 'other.pdf')

    expect(onDocumentSelected).toHaveBeenCalledWith('other.pdf')
  })

  it('calls onDocumentSelected with the Entire Corpus sentinel when that option is chosen', async () => {
    const userEvent = (await import('@testing-library/user-event')).default
    mockState({ documents: [makeDoc({ id: 'report.pdf' })] })
    const onDocumentSelected = vi.fn()

    render(<PlaygroundScreen onNavigate={vi.fn()} onDocumentSelected={onDocumentSelected} />)
    await userEvent.selectOptions(screen.getByLabelText('Select document'), ENTIRE_CORPUS_SELECTION)

    expect(onDocumentSelected).toHaveBeenCalledWith(ENTIRE_CORPUS_SELECTION)
  })

  it('selects the linked document from a deep link', () => {
    mockState({ documents: [makeDoc({ id: 'report.pdf' }), makeDoc({ id: 'other.pdf', name: 'other.pdf' })] })

    render(<PlaygroundScreen onNavigate={vi.fn()} linkedDocumentId="other.pdf" />)

    expect(screen.getByLabelText('Select document')).toHaveValue('other.pdf')
  })

  it('selects Entire Corpus from a linkedDocumentId deep link', () => {
    mockState({ documents: [makeDoc({ id: 'report.pdf' })] })

    render(<PlaygroundScreen onNavigate={vi.fn()} linkedDocumentId={ENTIRE_CORPUS_SELECTION} />)

    expect(screen.getByLabelText('Select document')).toHaveValue(ENTIRE_CORPUS_SELECTION)
  })
})
