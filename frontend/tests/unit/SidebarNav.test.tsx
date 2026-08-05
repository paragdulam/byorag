import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorpusProvider } from '../../src/context/CorpusContext'
import { SidebarNav } from '../../src/components/layout/SidebarNav'
import { useAuth } from '../../src/context/AuthContext'

vi.mock('../../src/context/AuthContext')

const mockedUseAuth = vi.mocked(useAuth)

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockedUseAuth.mockReturnValue({
    currentUser: { id: 'user-1', email: 'person@example.com', createdAt: '2026-07-14T00:00:00Z' },
    hasAnthropicKey: true,
    isLoading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshAnthropicKeyStatus: vi.fn(),
    ...overrides,
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function stubCorporaFetch(
  corpora: Array<{ id: string; name: string; createdAt: string }> = [],
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(init.body as string) as { name: string }
      return jsonResponse({ id: 'new-id', name: body.name, createdAt: '2026-07-14T12:00:00Z' }, 201)
    }
    return jsonResponse({ corpora })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderWithProvider(ui: ReactNode) {
  return render(<CorpusProvider>{ui}</CorpusProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
  mockAuth()
})

describe('SidebarNav', () => {
  it('renders all five top-level sections, labeled "Chunking" (not "Experiments"), with Sources marked active by default', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

    expect(screen.getByText('SOURCES')).toBeInTheDocument()
    expect(screen.getByText('CHUNKING')).toBeInTheDocument()
    expect(screen.queryByText('EXPERIMENTS')).not.toBeInTheDocument()
    expect(screen.getByText('PLAYGROUND')).toBeInTheDocument()
    expect(screen.getByText('VECTOR VIEW')).toBeInTheDocument()
    expect(screen.getByText('METRICS')).toBeInTheDocument()

    expect(screen.getByText('SOURCES')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('CHUNKING')).not.toHaveAttribute('aria-current')
  })

  it('reveals "Fixed Size Chunking" when Chunking is expanded', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

    expect(screen.queryByText('FIXED SIZE CHUNKING')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
  })

  it('calls onNavigate with the fixed-size-chunking screen id when its sub-option is selected', async () => {
    stubCorporaFetch([])
    const onNavigate = vi.fn()
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(onNavigate).toHaveBeenCalledWith('fixed-size-chunking')
  })

  it('marks the Fixed Size Chunking sub-option as active when it is the active screen', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('SOURCES')).not.toHaveAttribute('aria-current')
  })

  it('also lists "Embeddings" alongside "Fixed Size Chunking" when Chunking is expanded', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('EMBEDDINGS')).toBeInTheDocument()
  })

  it('calls onNavigate with the embeddings screen id when Embeddings is selected, regardless of run state', async () => {
    stubCorporaFetch([])
    const onNavigate = vi.fn()
    renderWithProvider(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('EMBEDDINGS'))

    expect(onNavigate).toHaveBeenCalledWith('embeddings')
  })

  describe('Corpora nav item shows the active corpus inline (no sidebar dropdown)', () => {
    it('shows the active corpus name in a subtitle under the CORPORA label', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Research Notes', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

      await waitFor(() =>
        expect(screen.getByTestId('corpora-nav-active-corpus')).toHaveTextContent('Research Notes'),
      )

      const corporaLink = screen.getByText('CORPORA').closest('a') as HTMLElement
      expect(within(corporaLink).getByTestId('corpora-nav-active-corpus')).toBeInTheDocument()
    })

    it('shows a "No corpus selected" subtitle when no corpora exist', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

      await waitFor(() =>
        expect(screen.getByTestId('corpora-nav-active-corpus')).toHaveTextContent(/no corpus selected/i),
      )
    })

    it('no longer renders the sidebar corpus-switcher dropdown anywhere', async () => {
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('corpora-nav-active-corpus')).toHaveTextContent(/corpus a/i),
      )

      expect(screen.queryByTestId('active-corpus-dropdown-toggle')).not.toBeInTheDocument()
      expect(screen.queryByTestId('active-corpus-dropdown-panel')).not.toBeInTheDocument()
      expect(screen.queryByTestId('dropdown-corpus-row-a')).not.toBeInTheDocument()
      expect(screen.queryByTestId('dropdown-corpus-row-b')).not.toBeInTheDocument()
    })

    it('clicking Corpora still navigates to the corpora screen rather than switching corpus in place', async () => {
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ])
      const onNavigate = vi.fn()
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
      await waitFor(() =>
        expect(screen.getByTestId('corpora-nav-active-corpus')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByText('CORPORA'))

      expect(onNavigate).toHaveBeenCalledWith('corpora')
    })
  })

  describe('Chevron indicator (008-corpora-management US4, 029-corpora-nav-redesign)', () => {
    it('shows a chevron next to Chunking and next to Corpora, and no chevron next to other items', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      const navChevrons = screen.getAllByTestId('chevron-icon').filter((el) => el.closest('a'))
      expect(navChevrons).toHaveLength(2)

      const corporaLink = screen.getByText('CORPORA').closest('a')
      const sourcesLink = screen.getByText('SOURCES').closest('a')
      const embeddingsLink = screen.getByText('EMBEDDINGS').closest('a')
      expect(corporaLink?.querySelector('[data-testid="chevron-icon"]')).not.toBeNull()
      expect(sourcesLink?.querySelector('[data-testid="chevron-icon"]')).toBeNull()
      expect(embeddingsLink?.querySelector('[data-testid="chevron-icon"]')).toBeNull()
    })

    it('rotates the chevron and updates aria-expanded when Chunking is expanded and collapsed', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      const chunkingLink = screen.getByText('CHUNKING').closest('a') as HTMLElement
      expect(chunkingLink).toHaveAttribute('aria-expanded', 'false')

      await userEvent.click(screen.getByText('CHUNKING'))

      expect(chunkingLink).toHaveAttribute('aria-expanded', 'true')

      await userEvent.click(screen.getByText('CHUNKING'))

      expect(chunkingLink).toHaveAttribute('aria-expanded', 'false')
    })
  })

  describe('Corpora nav item (009-corpora-screen)', () => {
    it('renders "Corpora" as its own clickable nav item, positioned above "Sources"', async () => {
      stubCorporaFetch([])
      const { container } = renderWithProvider(
        <SidebarNav activeScreen="sources" onNavigate={vi.fn()} />,
      )
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      expect(screen.getByText('CORPORA')).toBeInTheDocument()
      const text = container.textContent ?? ''
      expect(text.indexOf('CORPORA')).toBeLessThan(text.indexOf('SOURCES'))
    })

    it('calls onNavigate with the corpora screen id when clicked', async () => {
      stubCorporaFetch([])
      const onNavigate = vi.fn()
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      await userEvent.click(screen.getByText('CORPORA'))

      expect(onNavigate).toHaveBeenCalledWith('corpora')
    })

    it('marks the Corpora nav item as active when it is the active screen', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="corpora" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      expect(screen.getByText('CORPORA').closest('a')).toHaveAttribute('aria-current', 'page')
      expect(screen.getByText('SOURCES')).not.toHaveAttribute('aria-current')
    })

    it('renders exactly one "CORPORA" label, with the active corpus name as its own subtitle text', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Research Notes', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

      await waitFor(() =>
        expect(screen.getByTestId('corpora-nav-active-corpus')).toHaveTextContent('Research Notes'),
      )
      expect(screen.getAllByText('CORPORA')).toHaveLength(1)
      expect(screen.queryByText('RESEARCH NOTES')).not.toBeInTheDocument()
    })
  })

  describe('Anthropic key gating (025-user-profile-anthropic-key)', () => {
    it('disables Playground and Metrics with an explanatory tooltip when there is no key', async () => {
      mockAuth({ hasAnthropicKey: false })
      stubCorporaFetch([])
      const onNavigate = vi.fn()
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      const playgroundLink = screen.getByText('PLAYGROUND').closest('a') as HTMLElement
      const metricsLink = screen.getByText('METRICS').closest('a') as HTMLElement

      expect(playgroundLink).toHaveAttribute('aria-disabled', 'true')
      expect(metricsLink).toHaveAttribute('aria-disabled', 'true')
      expect(playgroundLink).toHaveAttribute('title', expect.stringMatching(/anthropic key/i))
      expect(metricsLink).toHaveAttribute('title', expect.stringMatching(/anthropic key/i))

      await userEvent.click(playgroundLink)
      await userEvent.click(metricsLink)
      expect(onNavigate).not.toHaveBeenCalled()
    })

    it('leaves every other nav item enabled when there is no key', async () => {
      mockAuth({ hasAnthropicKey: false })
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      for (const label of ['CORPORA', 'SOURCES', 'CHUNKING', 'EMBEDDINGS', 'VECTOR VIEW']) {
        const link = screen.getByText(label).closest('a') as HTMLElement
        expect(link).not.toHaveAttribute('aria-disabled')
      }
    })

    it('enables Playground and Metrics, with no tooltip, once a key is on file', async () => {
      mockAuth({ hasAnthropicKey: true })
      stubCorporaFetch([])
      const onNavigate = vi.fn()
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
      await waitFor(() => expect(screen.getByTestId('corpora-nav-active-corpus')).toBeInTheDocument())

      const playgroundLink = screen.getByText('PLAYGROUND').closest('a') as HTMLElement
      const metricsLink = screen.getByText('METRICS').closest('a') as HTMLElement

      expect(playgroundLink).not.toHaveAttribute('aria-disabled')
      expect(metricsLink).not.toHaveAttribute('aria-disabled')
      expect(playgroundLink).not.toHaveAttribute('title')

      await userEvent.click(playgroundLink)
      expect(onNavigate).toHaveBeenCalledWith('playground')
    })
  })
})
