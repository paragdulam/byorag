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
  // Scoped to <main> throughout -- the sidebar's own quick-switcher list
  // (CorporaSection) renders the same corpora/labels alongside the screen,
  // so unscoped queries would be ambiguous.
  return within(screen.getByRole('main'))
}

// Routes /api/corpora (list/create) and gives every /api/sources* request an
// empty, well-formed response -- once any corpus is active, CorpusDocumentsPanel
// mounts and fetches both, regardless of what a given test cares about.
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

describe('CorporaScreen document management (009-corpora-screen US3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetchWithDocuments() {
    return vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()

      if (init?.method === 'POST' && href.includes('/corpora') && !href.endsWith('/api/corpora')) {
        return jsonResponse(null, 204)
      }
      if (init?.method === 'DELETE') {
        return jsonResponse(null, 204)
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [
            { id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' },
            { id: 'corpus-b', name: 'Corpus B', createdAt: '2026-07-14T00:05:00Z' },
          ],
        })
      }
      if (href.includes('/api/sources/all')) {
        return jsonResponse({
          documents: [
            {
              id: 'doc-in-a',
              name: 'already-in-a.pdf',
              sizeBytes: 10,
              uploadedAt: '2026-07-14T01:00:00Z',
              status: 'processed',
              corpusIds: ['corpus-a'],
            },
            {
              id: 'doc-in-b',
              name: 'in-b-only.pdf',
              sizeBytes: 20,
              uploadedAt: '2026-07-14T01:05:00Z',
              status: 'processed',
              corpusIds: ['corpus-b'],
            },
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

  it("lists the selected corpus's documents", async () => {
    vi.stubGlobal('fetch', stubFetchWithDocuments())
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByTestId('corpus-row-corpus-a'))

    await waitFor(() =>
      expect(within(main.getByTestId('corpus-documents-list')).getByText('already-in-a.pdf')).toBeInTheDocument(),
    )
  })

  it('the "add existing document" picker excludes documents already in the selected corpus', async () => {
    vi.stubGlobal('fetch', stubFetchWithDocuments())
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByTestId('corpus-row-corpus-a'))
    await waitFor(() =>
      expect(within(main.getByTestId('corpus-documents-list')).getByText('already-in-a.pdf')).toBeInTheDocument(),
    )

    const picker = (await main.findByLabelText(/add existing document/i)) as HTMLSelectElement
    expect(picker).toHaveTextContent('in-b-only.pdf')
    expect(picker).not.toHaveTextContent('already-in-a.pdf')
  })

  it('attaches an existing document to the selected corpus via the picker', async () => {
    const fetchMock = stubFetchWithDocuments()
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByTestId('corpus-row-corpus-a'))
    const picker = await main.findByLabelText(/add existing document/i)
    await waitFor(() => expect(picker).toHaveTextContent('in-b-only.pdf'))

    await userEvent.selectOptions(picker, 'doc-in-b')

    await waitFor(() => {
      const attachCall = fetchMock.mock.calls.find(
        (call) =>
          (call[1] as RequestInit | undefined)?.method === 'POST' &&
          (call[0] as string).includes('doc-in-b/corpora'),
      )
      expect(attachCall).toBeDefined()
    })
  })

  it('removes a document from the selected corpus', async () => {
    let removed = false
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = url.toString()

      if (init?.method === 'DELETE' && href.includes('doc-in-a/corpora/corpus-a')) {
        removed = true
        return jsonResponse(null, 204)
      }
      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
        })
      }
      if (href.includes('/api/sources/all')) {
        return jsonResponse({
          documents: removed
            ? []
            : [
                {
                  id: 'doc-in-a',
                  name: 'already-in-a.pdf',
                  sizeBytes: 10,
                  uploadedAt: '2026-07-14T01:00:00Z',
                  status: 'processed',
                  corpusIds: ['corpus-a'],
                },
              ],
        })
      }
      if (href.includes('corpusId=corpus-a')) {
        return jsonResponse({
          documents: removed
            ? []
            : [
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
    vi.stubGlobal('fetch', fetchMock)
    const main = renderScreen()

    await waitFor(() => expect(main.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    await userEvent.click(main.getByTestId('corpus-row-corpus-a'))
    await waitFor(() =>
      expect(within(main.getByTestId('corpus-documents-list')).getByText('already-in-a.pdf')).toBeInTheDocument(),
    )

    await userEvent.click(main.getByRole('button', { name: /remove already-in-a\.pdf/i }))

    await waitFor(() => expect(main.queryByTestId('corpus-documents-list')).not.toBeInTheDocument())
    await waitFor(() =>
      expect(main.getByTestId('corpus-row-corpus-a-documents')).toHaveTextContent(
        /no documents in this corpus yet/i,
      ),
    )
    expect(removed).toBe(true)
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
      corpusIds: [corpusId],
    }))
  }

  function stubFetchWithAllDocuments(allDocuments: unknown[]) {
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
      if (href.includes('/api/sources/all')) {
        return jsonResponse({ documents: allDocuments })
      }
      return jsonResponse({ documents: [] })
    })
  }

  it('shows exactly 5 documents plus a "Show more" control for a corpus with more than 5', async () => {
    vi.stubGlobal('fetch', stubFetchWithAllDocuments(docsFor('a', 7)))
    const main = renderScreen()

    const preview = await waitFor(() => main.getByTestId('corpus-row-a-documents'))
    expect(within(preview).getAllByRole('listitem')).toHaveLength(5)
    expect(within(preview).getByRole('button', { name: /show more/i })).toBeInTheDocument()
  })

  it('reveals the rest when "Show more" is clicked, and becomes "Show less"', async () => {
    vi.stubGlobal('fetch', stubFetchWithAllDocuments(docsFor('a', 7)))
    const main = renderScreen()

    const preview = await waitFor(() => main.getByTestId('corpus-row-a-documents'))
    await userEvent.click(within(preview).getByRole('button', { name: /show more/i }))

    expect(within(preview).getAllByRole('listitem')).toHaveLength(7)
    expect(within(preview).getByRole('button', { name: /show less/i })).toBeInTheDocument()
  })

  it('shows all documents with no "Show more" control for a corpus with 5 or fewer', async () => {
    vi.stubGlobal('fetch', stubFetchWithAllDocuments(docsFor('a', 3)))
    const main = renderScreen()

    const preview = await waitFor(() => main.getByTestId('corpus-row-a-documents'))
    expect(within(preview).getAllByRole('listitem')).toHaveLength(3)
    expect(within(preview).queryByRole('button', { name: /show more/i })).not.toBeInTheDocument()
  })

  it('shows an empty-state message for a corpus with zero documents', async () => {
    vi.stubGlobal('fetch', stubFetchWithAllDocuments([]))
    const main = renderScreen()

    const preview = await waitFor(() => main.getByTestId('corpus-row-a-documents'))
    expect(preview).toHaveTextContent(/no documents in this corpus yet/i)
  })
})
