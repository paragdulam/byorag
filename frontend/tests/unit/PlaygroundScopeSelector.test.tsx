import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PlaygroundScreen } from '../../src/components/playground/PlaygroundScreen'
import { usePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'
import type { UsePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'
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

// The Playground's question scope (Entire Corpus vs. individual document) is implemented by
// extending its existing document `<select>` with the shared ENTIRE_CORPUS_SELECTION sentinel
// value, matching the pattern already used by Chunking/Embeddings/Vector View
// (018-ui-polish-batch) — this exercises that behavior through PlaygroundScreen rather than a
// separate scope-selector component.

vi.mock('../../src/hooks/usePlaygroundConversation')

function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

const mockedUsePlaygroundConversation = vi.mocked(usePlaygroundConversation)

function makeDoc(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: 'doc-1',
    name: 'report.pdf',
    sizeBytes: 2048,
    uploadedAt: new Date('2026-07-19T10:00:00Z'),
    status: 'processed',
    ...overrides,
  }
}

function mockState(overrides: Partial<UsePlaygroundConversation> = {}): UsePlaygroundConversation {
  const state: UsePlaygroundConversation = {
    documents: [makeDoc()],
    isLoadingDocuments: false,
    context: { documentId: 'doc-1', corpusId: null, chunkingStrategy: 'fixed-size', embeddingModel: 'bert' },
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

describe('Playground question scope selector (019-metrics-dashboard US4)', () => {
  it('offers "Entire Corpus" alongside individual documents', () => {
    mockState()

    render(<PlaygroundScreen onNavigate={() => {}} />)

    const select = screen.getByLabelText('Select document') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual(['Entire Corpus', 'report.pdf'])
  })

  it('passes the entire-corpus sentinel through to the conversation hook when selected', async () => {
    mockState()
    render(<PlaygroundScreen onNavigate={() => {}} />)

    await userEvent.selectOptions(screen.getByLabelText('Select document'), 'Entire Corpus')

    const lastCall = mockedUsePlaygroundConversation.mock.calls.at(-1)
    expect(lastCall?.[1]).toBe(ENTIRE_CORPUS_SELECTION)
  })

  it('shows a corpus-scoped message when no embeddings are saved and Entire Corpus is selected', async () => {
    mockState({
      context: { documentId: null, corpusId: 'corpus-1', chunkingStrategy: null, embeddingModel: null },
    })
    render(<PlaygroundScreen onNavigate={() => {}} />)

    await userEvent.selectOptions(screen.getByLabelText('Select document'), 'Entire Corpus')

    expect(screen.getByText(/no saved embeddings for this corpus yet/i)).toBeInTheDocument()
  })
})
