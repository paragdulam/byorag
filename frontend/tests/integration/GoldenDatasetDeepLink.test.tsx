import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoldenDatasetScreen } from '../../src/components/golden-dataset/GoldenDatasetScreen'
import { CorpusProvider } from '../../src/context/CorpusContext'

// 032-deep-linking US2: opening `/golden-dataset/:corpusId/:entryId` should render that entry
// expanded and scrolled into view (FR-007), a 404'd entryId should render the shared not-found
// state instead of the list (FR-009), and each row's "Copy link" action should write the
// expected shareable URL to the clipboard (FR-006).

// AppShell -> SidebarNav reads Anthropic-key status from AuthContext, matching every other
// screen's integration test in this suite.
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

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: () => null,
  Page: () => null,
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function render(ui: ReactElement) {
  return rtlRender(
    <MemoryRouter>
      <CorpusProvider>{ui}</CorpusProvider>
    </MemoryRouter>,
  )
}

const approvedEntrySummary = {
  id: 'entry-1',
  corpusId: 'corpus-a',
  documentId: 'doc-a',
  question: 'What is the notice period?',
  status: 'approved',
  source: 'manual',
  createdAt: '2026-08-01T00:00:00Z',
}

const approvedEntryFull = {
  ...approvedEntrySummary,
  preferredAnswer: '30 days.',
  chunks: [],
  updatedAt: '2026-08-01T00:00:00Z',
  reviewedAt: '2026-08-01T00:05:00Z',
}

function stubFetch(options: { entryFound?: boolean } = {}) {
  const entryFound = options.entryFound ?? true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      const href = url.toString()
      if (href.includes('/api/corpora')) {
        return jsonResponse({ corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }] })
      }
      if (href.includes('/api/sources')) {
        return jsonResponse({
          documents: [{ id: 'doc-a', name: 'a.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' }],
        })
      }
      if (href.includes('/api/golden-dataset/entries/entry-1')) {
        return entryFound ? jsonResponse(approvedEntryFull) : jsonResponse({ detail: 'Not found' }, 404)
      }
      if (href.includes('/api/golden-dataset/entries')) {
        return jsonResponse({ entries: entryFound ? [approvedEntrySummary] : [] })
      }
      return jsonResponse({ documents: [], rejections: [] })
    }),
  )
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GoldenDatasetScreen deep linking (032-deep-linking US2)', () => {
  it('opens the linked entry expanded and scrolls it into view', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} linkedEntryId="entry-1" />)

    await waitFor(() => expect(screen.getByText('30 days.')).toBeInTheDocument())
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('renders the not-found state when the linked entry no longer exists', async () => {
    stubFetch({ entryFound: false })

    render(<GoldenDatasetScreen onNavigate={vi.fn()} linkedEntryId="entry-1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/i)
    expect(screen.queryByTestId('golden-entry-list')).not.toBeInTheDocument()
  })

  it('writes the expected shareable URL to the clipboard from "Copy link"', async () => {
    stubFetch()
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('What is the notice period?')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /copy link to what is the notice period/i }))

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/golden-dataset/corpus-a/entry-1`)
  })

  it('calls onEntryOpened with the entry id when its question is clicked (034-more-deep-links)', async () => {
    stubFetch()
    const onEntryOpened = vi.fn()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} onEntryOpened={onEntryOpened} />)
    await waitFor(() => expect(screen.getByText('What is the notice period?')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'What is the notice period?' }))

    expect(onEntryOpened).toHaveBeenCalledWith('entry-1')
  })

  it('opens the "Write Manually" form directly when isCreatingEntry is true (034-more-deep-links)', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} isCreatingEntry />)

    expect(await screen.findByRole('textbox', { name: /^question$/i })).toBeInTheDocument()
  })

  it('calls onCreatingEntryChanged(true) when "Write Manually" is clicked, and (false) once saved', async () => {
    stubFetch()
    const onCreatingEntryChanged = vi.fn()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} onCreatingEntryChanged={onCreatingEntryChanged} />)
    await waitFor(() => expect(screen.getByText('What is the notice period?')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Write Manually' }))

    expect(onCreatingEntryChanged).toHaveBeenCalledWith(true)
  })
})
