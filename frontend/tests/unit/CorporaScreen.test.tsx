import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CorporaScreen } from '../../src/components/corpora/CorporaScreen'
import { CorpusProvider } from '../../src/context/CorpusContext'

// AppShell -> SidebarNav reads Anthropic-key status from AuthContext
// (025-user-profile-anthropic-key) — mocked here since this suite predates it and isn't
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

function jsonResponse(body: unknown, status = 200): Response {
  if (status === 204) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), { status })
}

function renderScreen() {
  render(
    <CorpusProvider>
      <CorporaScreen onNavigate={vi.fn()} />
    </CorpusProvider>,
  )
  // Scoped to <main> for consistency with other screen test suites, even though this one
  // renders CorporaScreen directly without SidebarNav/AppShell around it.
  return within(screen.getByRole('main'))
}

// Routes /api/corpora (list/create) and gives every /api/sources* request an
// empty, well-formed response -- the screen fetches every corpus's documents for its
// row-level preview on mount, regardless of what a given test cares about.
function stubCorporaFetch(
  corpora: Array<{ id: string; name: string; createdAt: string }> = [],
) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = url.toString()
    if (init?.method === 'POST' && href.endsWith('/api/corpora')) {
      const body = JSON.parse(init.body as string) as { name: string }
      return jsonResponse({ id: 'new-id', name: body.name, createdAt: '2026-07-14T11:00:00Z' }, 201)
    }
    if (href.endsWith('/api/corpora')) {
      return jsonResponse({ corpora })
    }
    return jsonResponse({ documents: [] })
  })
}

describe('CorporaScreen (009-corpora-screen US1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an empty/prompt state when no corpora exist', async () => {
    vi.stubGlobal('fetch', stubCorporaFetch([]))
    const main = renderScreen()

    await waitFor(() => expect(main.getByText(/no corpora yet/i)).toBeInTheDocument())
  })

  it('lists all corpora and marks the active one', async () => {
    vi.stubGlobal(
      'fetch',
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ]),
    )
    const main = renderScreen()

    await waitFor(() => expect(main.getByText('Corpus A')).toBeInTheDocument())
    expect(main.getByText('Corpus B')).toBeInTheDocument()
    expect(main.getByTestId('corpus-row-a')).toHaveAttribute('aria-current', 'page')
    expect(main.getByTestId('corpus-row-b')).not.toHaveAttribute('aria-current')
  })

  it('creates a new corpus and marks it active', async () => {
    vi.stubGlobal('fetch', stubCorporaFetch([]))
    const main = renderScreen()
    await waitFor(() => expect(main.getByText(/no corpora yet/i)).toBeInTheDocument())

    await userEvent.click(main.getByRole('button', { name: /new corpus/i }))
    await userEvent.type(main.getByLabelText(/new corpus name/i), 'Research Notes')
    await userEvent.click(main.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(main.getByText('Research Notes')).toBeInTheDocument())
    expect(main.getByTestId('corpus-row-new-id')).toHaveAttribute('aria-current', 'page')
  })

  it('clicking a non-active corpus row does not make it active (018-ui-polish-batch US5)', async () => {
    vi.stubGlobal(
      'fetch',
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ]),
    )
    const main = renderScreen()
    await waitFor(() =>
      expect(main.getByTestId('corpus-row-a')).toHaveAttribute('aria-current', 'page'),
    )

    await userEvent.click(main.getByTestId('corpus-row-b'))

    expect(main.getByTestId('corpus-row-a')).toHaveAttribute('aria-current', 'page')
    expect(main.getByTestId('corpus-row-b')).not.toHaveAttribute('aria-current')
  })

  it('clicking a non-active row\'s "Make Active" button does make it active (018-ui-polish-batch US5)', async () => {
    vi.stubGlobal(
      'fetch',
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ]),
    )
    const main = renderScreen()
    await waitFor(() =>
      expect(main.getByTestId('corpus-row-a')).toHaveAttribute('aria-current', 'page'),
    )

    await userEvent.click(
      within(main.getByTestId('corpus-row-b')).getByRole('button', { name: /make corpus b active/i }),
    )

    expect(main.getByTestId('corpus-row-b')).toHaveAttribute('aria-current', 'page')
    expect(main.getByTestId('corpus-row-a')).not.toHaveAttribute('aria-current')
  })
})

describe('CorporaScreen document management (033-ui-ux-polish US1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetchWithDocuments() {
    return vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()

      if (init?.method === 'POST' && href.endsWith('/api/sources/delete')) {
        return jsonResponse({ results: [{ id: 'doc-in-a', status: 'deleted', reason: null }] })
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [
            { id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' },
            { id: 'corpus-b', name: 'Corpus B', createdAt: '2026-07-14T00:05:00Z' },
          ],
        })
      }
      if (href.includes('corpusId=corpus-a')) {
        return jsonResponse({
          documents: [
            {
              id: 'doc-in-a',
              name: 'already-in-a.pdf',
              sizeBytes: 10,
              uploadedAt: '2026-07-14T01:00:00Z',
              status: 'processed',
            },
          ],
        })
      }
      return jsonResponse({ documents: [] })
    })
  }

  it("lists a corpus's documents under its own row, with no separate \"Documents in X\" panel", async () => {
    vi.stubGlobal('fetch', stubFetchWithDocuments())
    const main = renderScreen()

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).getByText('already-in-a.pdf'),
      ).toBeInTheDocument(),
    )
    expect(main.queryByText(/^documents in /i)).not.toBeInTheDocument()
  })

  it('renders each document name as a link to its Sources deep link', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocuments())
    const main = renderScreen()

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).queryByRole('link'),
      ).toBeInTheDocument(),
    )
    const link = within(main.getByTestId('corpus-row-corpus-a-documents')).getByRole('link', {
      name: 'already-in-a.pdf',
    })
    expect(link).toHaveAttribute('href', '/sources/corpus-a/doc-in-a')
  })

  it('clicking a document name opens it on the Sources screen via onDocumentOpen', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocuments())
    const onDocumentOpen = vi.fn()
    render(
      <CorpusProvider>
        <CorporaScreen onNavigate={vi.fn()} onDocumentOpen={onDocumentOpen} />
      </CorpusProvider>,
    )
    const main = within(screen.getByRole('main'))

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).queryByRole('link'),
      ).toBeInTheDocument(),
    )
    const link = within(main.getByTestId('corpus-row-corpus-a-documents')).getByRole('link', {
      name: 'already-in-a.pdf',
    })

    await userEvent.click(link)

    expect(onDocumentOpen).toHaveBeenCalledWith('corpus-a', 'doc-in-a')
  })

  it('clicking the delete icon opens a confirmation modal without deleting', async () => {
    const fetchMock = stubFetchWithDocuments()
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).getByText('already-in-a.pdf'),
      ).toBeInTheDocument(),
    )

    await userEvent.click(main.getByRole('button', { name: /delete already-in-a\.pdf/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((call) => (call[0] as string).endsWith('/api/sources/delete'))).toBe(false)
  })

  it('confirming the modal deletes the document and removes it from the list', async () => {
    const fetchMock = stubFetchWithDocuments()
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).getByText('already-in-a.pdf'),
      ).toBeInTheDocument(),
    )
    await userEvent.click(main.getByRole('button', { name: /delete already-in-a\.pdf/i }))

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          (call[0] as string).endsWith('/api/sources/delete'),
      )
      expect(deleteCall).toBeDefined()
    })
  })

  it('canceling the modal leaves the document untouched', async () => {
    const fetchMock = stubFetchWithDocuments()
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).getByText('already-in-a.pdf'),
      ).toBeInTheDocument(),
    )
    await userEvent.click(main.getByRole('button', { name: /delete already-in-a\.pdf/i }))

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      within(main.getByTestId('corpus-row-corpus-a-documents')).getByText('already-in-a.pdf'),
    ).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((call) => (call[0] as string).endsWith('/api/sources/delete'))).toBe(false)
  })

  it('no "Remove" button or "attach an existing document" control exists anywhere on the screen', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocuments())
    const main = renderScreen()

    await waitFor(() =>
      expect(
        within(main.getByTestId('corpus-row-corpus-a-documents')).getByText('already-in-a.pdf'),
      ).toBeInTheDocument(),
    )

    expect(main.queryByRole('button', { name: /^remove/i })).not.toBeInTheDocument()
    expect(main.queryByLabelText(/add existing document/i)).not.toBeInTheDocument()
  })
})

describe('CorporaScreen corpus deletion (009-corpora-screen US4, relocated per-row in 011-move-corpus-row-actions)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes an empty corpus via its row\'s own Delete action and removes it from the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let deleted = false
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()
      if (init?.method === 'DELETE' && href.endsWith('/api/corpora/corpus-a')) {
        deleted = true
        return jsonResponse(null, 204)
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: deleted
            ? []
            : [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
        })
      }
      return jsonResponse({ documents: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByRole('button', { name: /delete corpus a/i }))

    await waitFor(() => expect(main.queryByTestId('corpus-row-corpus-a')).not.toBeInTheDocument())
    expect(deleted).toBe(true)
  })

  it('blocks deletion of a non-empty corpus via its row\'s own Delete action, with a clear message', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()
      if (init?.method === 'DELETE' && href.endsWith('/api/corpora/corpus-a')) {
        return jsonResponse({ detail: "Cannot delete corpus 'Corpus A': 1 document(s) still associated." }, 409)
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
        })
      }
      return jsonResponse({ documents: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByRole('button', { name: /delete corpus a/i }))

    await waitFor(() => expect(main.getByRole('alert')).toHaveTextContent(/still associated/i))
    expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument()
  })

  it('cancelling the confirmation leaves the corpus untouched', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()
      if (init?.method === 'DELETE') {
        throw new Error('DELETE should not be called when confirmation is cancelled')
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
        })
      }
      return jsonResponse({ documents: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByRole('button', { name: /delete corpus a/i }))

    expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument()
  })

  it('does not render the old standalone "Delete this corpus" control anymore', async () => {
    vi.stubGlobal(
      'fetch',
      stubCorporaFetch([{ id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' }]),
    )
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-a')).toBeInTheDocument())
    expect(main.queryByRole('button', { name: /^delete this corpus$/i })).not.toBeInTheDocument()
  })
})

describe('CorporaScreen: Make Active per row (011-move-corpus-row-actions US1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a "Make Active" action on non-active rows, and switches the active corpus when clicked', async () => {
    vi.stubGlobal(
      'fetch',
      stubCorporaFetch([
        { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
      ]),
    )
    const main = renderScreen()
    await waitFor(() =>
      expect(main.getByTestId('corpus-row-a')).toHaveAttribute('aria-current', 'page'),
    )

    expect(
      within(main.getByTestId('corpus-row-a')).queryByRole('button', { name: /make corpus a active/i }),
    ).not.toBeInTheDocument()
    const makeActiveB = within(main.getByTestId('corpus-row-b')).getByRole('button', {
      name: /make corpus b active/i,
    })

    await userEvent.click(makeActiveB)

    expect(main.getByTestId('corpus-row-b')).toHaveAttribute('aria-current', 'page')
    expect(main.getByTestId('corpus-row-a')).not.toHaveAttribute('aria-current')
    expect(
      within(main.getByTestId('corpus-row-a')).getByRole('button', { name: /make corpus a active/i }),
    ).toBeInTheDocument()
  })

  it('shows "ACTIVE" instead of a "Make Active" button on the active row', async () => {
    vi.stubGlobal(
      'fetch',
      stubCorporaFetch([{ id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' }]),
    )
    const main = renderScreen()

    await waitFor(() =>
      expect(main.getByTestId('corpus-row-a')).toHaveAttribute('aria-current', 'page'),
    )
    expect(within(main.getByTestId('corpus-row-a')).getByText(/^active$/i)).toBeInTheDocument()
    expect(
      within(main.getByTestId('corpus-row-a')).queryByRole('button', { name: /make corpus a active/i }),
    ).not.toBeInTheDocument()
  })
})

describe('CorporaScreen: per-row document preview (018-ui-polish-batch US7)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function docsFor(corpusId: string, count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `${corpusId}-doc-${i}`,
      name: `${corpusId}-doc-${i}.pdf`,
      sizeBytes: 10,
      uploadedAt: '2026-07-14T01:00:00Z',
      status: 'processed',
    }))
  }

  function stubFetchWithDocumentsForCorpusA(documents: unknown[]) {
    return vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()
      if (init?.method === 'DELETE') {
        return jsonResponse(null, 204)
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [
            { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
            { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
          ],
        })
      }
      if (href.includes('corpusId=a')) {
        return jsonResponse({ documents })
      }
      return jsonResponse({ documents: [] })
    })
  }

  it('shows exactly 5 documents plus a "Show more" control for a corpus with more than 5', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocumentsForCorpusA(docsFor('a', 7)))
    const main = renderScreen()

    await waitFor(() =>
      expect(within(main.getByTestId('corpus-row-a-documents')).queryAllByRole('listitem')).toHaveLength(5),
    )
    const preview = main.getByTestId('corpus-row-a-documents')
    expect(within(preview).getByRole('button', { name: /show more/i })).toBeInTheDocument()
  })

  it('reveals the rest when "Show more" is clicked, and becomes "Show less"', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocumentsForCorpusA(docsFor('a', 7)))
    const main = renderScreen()

    await waitFor(() =>
      expect(within(main.getByTestId('corpus-row-a-documents')).queryAllByRole('listitem')).toHaveLength(5),
    )
    const preview = main.getByTestId('corpus-row-a-documents')
    await userEvent.click(within(preview).getByRole('button', { name: /show more/i }))

    expect(within(preview).getAllByRole('listitem')).toHaveLength(7)
    expect(within(preview).getByRole('button', { name: /show less/i })).toBeInTheDocument()
  })

  it('shows all documents with no "Show more" control for a corpus with 5 or fewer', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocumentsForCorpusA(docsFor('a', 3)))
    const main = renderScreen()

    await waitFor(() =>
      expect(within(main.getByTestId('corpus-row-a-documents')).queryAllByRole('listitem')).toHaveLength(3),
    )
    const preview = main.getByTestId('corpus-row-a-documents')
    expect(within(preview).queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })

  it('shows an empty-state message for a corpus with zero documents', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocumentsForCorpusA([]))
    const main = renderScreen()

    const preview = await waitFor(() => main.getByTestId('corpus-row-a-documents'))
    expect(preview).toHaveTextContent(/no documents in this corpus yet/i)
  })
})
