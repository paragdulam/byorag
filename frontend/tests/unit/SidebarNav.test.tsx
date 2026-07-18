import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorpusProvider } from '../../src/context/CorpusContext'
import { SidebarNav } from '../../src/components/layout/SidebarNav'

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
})

describe('SidebarNav', () => {
  it('renders all five top-level sections, labeled "Chunking" (not "Experiments"), with Sources marked active by default', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

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
    await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

    expect(screen.queryByText('FIXED SIZE CHUNKING')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
  })

  it('calls onNavigate with the fixed-size-chunking screen id when its sub-option is selected', async () => {
    stubCorporaFetch([])
    const onNavigate = vi.fn()
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(onNavigate).toHaveBeenCalledWith('fixed-size-chunking')
  })

  it('marks the Fixed Size Chunking sub-option as active when it is the active screen', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('SOURCES')).not.toHaveAttribute('aria-current')
  })

  it('also lists "Embeddings" alongside "Fixed Size Chunking" when Chunking is expanded', async () => {
    stubCorporaFetch([])
    renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('EMBEDDINGS')).toBeInTheDocument()
  })

  it('calls onNavigate with the embeddings screen id when Embeddings is selected, regardless of run state', async () => {
    stubCorporaFetch([])
    const onNavigate = vi.fn()
    renderWithProvider(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={onNavigate} />)
    await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('EMBEDDINGS'))

    expect(onNavigate).toHaveBeenCalledWith('embeddings')
  })

  describe('Corpora section (010-corpora-dropdown-nav)', () => {
    it('renders a closed dropdown toggle, positioned above Sources, labeled with the active corpus name', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Research Notes', createdAt: '2026-07-14T10:00:00Z' }])
      const { container } = renderWithProvider(
        <SidebarNav activeScreen="sources" onNavigate={vi.fn()} />,
      )
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/research notes/i),
      )

      expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('active-corpus-dropdown-panel')).not.toBeInTheDocument()

      const text = container.textContent ?? ''
      expect(text.indexOf('RESEARCH NOTES')).toBeLessThan(text.indexOf('SOURCES'))
    })

    it('shows a "No corpus selected" prompt in the closed toggle when no corpora exist', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/no corpus selected/i),
      )
    })

    it('opens the panel on click, revealing an empty-state message when no corpora exist', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

      expect(screen.queryByTestId('active-corpus-dropdown-panel')).not.toBeInTheDocument()

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))

      expect(screen.getByTestId('active-corpus-dropdown-panel')).toBeInTheDocument()
      expect(screen.getByText(/no corpora yet/i)).toBeInTheDocument()
    })

    it('reveals every corpus as a row in the open panel, marking the active one', async () => {
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))

      const rowA = screen.getByTestId('dropdown-corpus-row-a')
      const rowB = screen.getByTestId('dropdown-corpus-row-b')
      expect(within(rowA).getByText('Corpus A')).toBeInTheDocument()
      expect(within(rowB).getByText('Corpus B')).toBeInTheDocument()
      expect(rowA).toHaveAttribute('aria-current', 'page')
      expect(rowB).not.toHaveAttribute('aria-current')
    })

    it('closes the panel when the toggle is clicked again', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))
      expect(screen.getByTestId('active-corpus-dropdown-panel')).toBeInTheDocument()

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))
      expect(screen.queryByTestId('active-corpus-dropdown-panel')).not.toBeInTheDocument()
    })

    it('closes the panel when clicking outside it', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(
        <div>
          <SidebarNav activeScreen="sources" onNavigate={vi.fn()} />
          <div data-testid="outside-target">Outside</div>
        </div>,
      )
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))
      expect(screen.getByTestId('active-corpus-dropdown-panel')).toBeInTheDocument()

      await userEvent.click(screen.getByTestId('outside-target'))
      expect(screen.queryByTestId('active-corpus-dropdown-panel')).not.toBeInTheDocument()
    })

    it('closes the panel when the Escape key is pressed', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))
      expect(screen.getByTestId('active-corpus-dropdown-panel')).toBeInTheDocument()

      await userEvent.keyboard('{Escape}')
      expect(screen.queryByTestId('active-corpus-dropdown-panel')).not.toBeInTheDocument()
    })

    it('does not render a create-corpus control anywhere in the sidebar, closed or open', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      expect(screen.queryByRole('button', { name: /new corpus/i })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/new corpus name/i)).not.toBeInTheDocument()

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))

      expect(screen.queryByRole('button', { name: /new corpus/i })).not.toBeInTheDocument()
      expect(screen.queryByLabelText(/new corpus name/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^create$/i })).not.toBeInTheDocument()
    })
  })

  describe('Corpora dropdown: no action buttons, click-to-select (011-move-corpus-row-actions US2)', () => {
    it('renders zero "Make Active" or "Delete" buttons anywhere in the open panel', async () => {
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))
      const panel = screen.getByTestId('active-corpus-dropdown-panel')

      expect(within(panel).queryByRole('button', { name: /make .* active/i })).not.toBeInTheDocument()
      expect(within(panel).queryByRole('button', { name: /^delete/i })).not.toBeInTheDocument()
    })

    it('clicking a non-active corpus\'s row switches the active corpus app-wide', async () => {
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus a/i),
      )

      await userEvent.click(screen.getByTestId('active-corpus-dropdown-toggle'))
      await userEvent.click(screen.getByTestId('dropdown-corpus-row-b'))

      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/corpus b/i),
      )
      expect(screen.getByTestId('dropdown-corpus-row-b')).toHaveAttribute('aria-current', 'page')
      expect(screen.getByTestId('dropdown-corpus-row-a')).not.toHaveAttribute('aria-current')
    })
  })

  describe('Chevron indicator (008-corpora-management US4)', () => {
    it('shows a chevron next to Chunking, and no chevron next to non-expandable items', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

      const navChevrons = screen.getAllByTestId('chevron-icon').filter((el) => el.closest('a'))
      expect(navChevrons).toHaveLength(1)

      const sourcesLink = screen.getByText('SOURCES').closest('a')
      const embeddingsLink = screen.getByText('EMBEDDINGS').closest('a')
      expect(sourcesLink?.querySelector('[data-testid="chevron-icon"]')).toBeNull()
      expect(embeddingsLink?.querySelector('[data-testid="chevron-icon"]')).toBeNull()
    })

    it('rotates the chevron and updates aria-expanded when Chunking is expanded and collapsed', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

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
      await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

      expect(screen.getByText('CORPORA')).toBeInTheDocument()
      const text = container.textContent ?? ''
      expect(text.indexOf('CORPORA')).toBeLessThan(text.indexOf('SOURCES'))
    })

    it('calls onNavigate with the corpora screen id when clicked', async () => {
      stubCorporaFetch([])
      const onNavigate = vi.fn()
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)
      await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

      await userEvent.click(screen.getByText('CORPORA'))

      expect(onNavigate).toHaveBeenCalledWith('corpora')
    })

    it('marks the Corpora nav item as active when it is the active screen', async () => {
      stubCorporaFetch([])
      renderWithProvider(<SidebarNav activeScreen="corpora" onNavigate={vi.fn()} />)
      await waitFor(() => expect(screen.getByTestId('active-corpus-dropdown-toggle')).toBeInTheDocument())

      expect(screen.getByText('CORPORA')).toHaveAttribute('aria-current', 'page')
      expect(screen.getByText('SOURCES')).not.toHaveAttribute('aria-current')
    })

    it('does not duplicate the "CORPORA" label between the nav item and the dropdown toggle', async () => {
      stubCorporaFetch([{ id: 'a', name: 'Research Notes', createdAt: '2026-07-14T10:00:00Z' }])
      renderWithProvider(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

      await waitFor(() =>
        expect(screen.getByTestId('active-corpus-dropdown-toggle')).toHaveTextContent(/research notes/i),
      )
      // Exactly one "CORPORA" text node should remain: the nav item's label.
      expect(screen.getAllByText('CORPORA')).toHaveLength(1)
    })
  })
})
