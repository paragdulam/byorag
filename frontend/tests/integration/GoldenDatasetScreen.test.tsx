import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GoldenDatasetScreen } from '../../src/components/golden-dataset/GoldenDatasetScreen'
import { CorpusProvider } from '../../src/context/CorpusContext'

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

// react-pdf/pdfjs needs a real worker + canvas, neither of which jsdom provides — stubbed here
// (028-golden-dataset-split-view) the same way DataSourcesScreen's integration suite already does,
// so the split-pane tests can assert which document's file URL the reused preview was pointed at.
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: (props: { file: { url: string } }) => (
    <div data-testid="mock-pdf-document">{props.file.url}</div>
  ),
  Page: () => null,
}))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

const candidate = {
  chunkId: 'chunk-1',
  documentId: 'doc-a',
  chunkIndex: 0,
  content: 'Either party may terminate with 30 days notice.',
  matchedQuestion: true,
  matchedAnswer: true,
}

const savedEntry = {
  id: 'entry-1',
  corpusId: 'corpus-a',
  documentId: 'doc-a',
  question: 'What is the notice period?',
  preferredAnswer: '30 days.',
  status: 'approved',
  source: 'manual',
  chunks: [{ id: 'gec-1', chunkId: 'chunk-1', documentId: 'doc-a', chunkIndex: 0, content: candidate.content }],
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  reviewedAt: null,
}

describe('GoldenDatasetScreen — manual creation flow (026-golden-dataset US1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetch() {
    let created = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = url.toString()
        if (href.includes('/api/corpora')) {
          return jsonResponse({ corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }] })
        }
        if (href.includes('/api/sources')) {
          return jsonResponse({
            documents: [{ id: 'doc-a', name: 'a.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' }],
            rejections: [],
          })
        }
        if (href.includes('/api/golden-dataset/candidates')) {
          // Mirrors the real backend's `_require_exactly_one_scope` (service.py) so a frontend
          // regression sending both corpusId and documentId together fails here too, not just
          // against the real backend (caught the hard way once already — see git history).
          const body = JSON.parse((init?.body as string) ?? '{}') as {
            corpusId: string | null
            documentId: string | null
          }
          if ((body.corpusId === null) === (body.documentId === null)) {
            return jsonResponse({ detail: 'Exactly one of documentId or corpusId must be provided' }, 400)
          }
          return jsonResponse({ candidates: [candidate] })
        }
        if (href.endsWith('/api/golden-dataset/entries') && init?.method === 'POST') {
          created = true
          return jsonResponse(savedEntry, 201)
        }
        if (href.includes('/api/golden-dataset/entries')) {
          return jsonResponse({ entries: created ? [savedEntry] : [] })
        }
        throw new Error(`Unhandled request: ${href}`)
      }),
    )
  }

  it('creates a manual entry end-to-end and shows it in the entry list', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    expect(await screen.findByText(/no golden dataset entries yet/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /write manually/i }))

    await userEvent.type(screen.getByLabelText(/question/i), 'What is the notice period?')
    await userEvent.type(screen.getByLabelText(/preferred answer/i), '30 days.')
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /30 days notice/i })).toBeChecked())

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText('What is the notice period?')).toBeInTheDocument())
    expect(screen.getByText(/approved/i)).toBeInTheDocument()
  })
})

describe('GoldenDatasetScreen — split-pane PDF preview (028-golden-dataset-split-view US1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/api/corpora')) {
          return jsonResponse({ corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }] })
        }
        if (href.includes('/api/sources')) {
          return jsonResponse({
            documents: [
              { id: 'doc-a', name: 'a.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' },
              { id: 'doc-b', name: 'b.pdf', sizeBytes: 20, uploadedAt: '2026-07-14T01:05:00Z', status: 'processed' },
            ],
            rejections: [],
          })
        }
        if (href.includes('/api/golden-dataset/entries')) {
          return jsonResponse({ entries: [] })
        }
        throw new Error(`Unhandled request: ${href}`)
      }),
    )
  }

  it('renders a left pane and a right pane once a corpus is selected', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    expect(await screen.findByTestId('golden-dataset-left-pane')).toBeInTheDocument()
    expect(screen.getByTestId('golden-dataset-right-pane')).toBeInTheDocument()
  })

  it('previews the document currently selected in the scope dropdown by default', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    const rightPane = await screen.findByTestId('golden-dataset-right-pane')
    await waitFor(() =>
      expect(within(rightPane).getByTestId('mock-pdf-document')).toHaveTextContent(
        '/api/sources/doc-a/file',
      ),
    )
  })

  it('shows a neutral empty state in the right pane when scope is "Entire Corpus"', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    await screen.findByTestId('golden-dataset-right-pane')
    await userEvent.selectOptions(screen.getByLabelText(/scope/i), 'Entire Corpus')

    const rightPane = screen.getByTestId('golden-dataset-right-pane')
    expect(within(rightPane).getByTestId('source-preview-empty')).toBeInTheDocument()
  })

  it('switches the preview when a different document is selected in the scope dropdown', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    const rightPane = await screen.findByTestId('golden-dataset-right-pane')
    await waitFor(() =>
      expect(within(rightPane).getByTestId('mock-pdf-document')).toHaveTextContent(
        '/api/sources/doc-a/file',
      ),
    )

    await userEvent.selectOptions(screen.getByLabelText(/scope/i), 'b.pdf')

    await waitFor(() =>
      expect(within(rightPane).getByTestId('mock-pdf-document')).toHaveTextContent(
        '/api/sources/doc-b/file',
      ),
    )
  })

  it('preserves unsaved editor text and stays in the manual editor across a fullscreen toggle (FR-012)', async () => {
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
            rejections: [],
          })
        }
        if (href.includes('/api/golden-dataset/candidates')) {
          return jsonResponse({ candidates: [] })
        }
        if (href.includes('/api/golden-dataset/entries')) {
          return jsonResponse({ entries: [] })
        }
        throw new Error(`Unhandled request: ${href}`)
      }),
    )

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    await screen.findByTestId('golden-dataset-right-pane')
    await userEvent.click(screen.getByRole('button', { name: /write manually/i }))
    await userEvent.type(screen.getByLabelText(/^question$/i), 'Unsaved draft question')

    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))
    expect(screen.getByTestId('golden-dataset-left-pane')).toHaveClass('hidden')

    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))
    expect(screen.getByTestId('golden-dataset-left-pane')).not.toHaveClass('hidden')
    expect(screen.getByLabelText(/^question$/i)).toHaveValue('Unsaved draft question')
  })
})

describe('GoldenDatasetScreen — control row below the scope dropdown (028-golden-dataset-split-view US3)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetch() {
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
            rejections: [],
          })
        }
        if (href.includes('/api/golden-dataset/entries')) {
          return jsonResponse({ entries: [] })
        }
        throw new Error(`Unhandled request: ${href}`)
      }),
    )
  }

  it('places the scope dropdown above a single horizontal row of Write Manually / Generate with LLM / batch count / Generate a Batch, in that order', async () => {
    stubFetch()

    render(<GoldenDatasetScreen onNavigate={vi.fn()} />)

    const leftPane = await screen.findByTestId('golden-dataset-left-pane')
    const scopeSelect = within(leftPane).getByLabelText(/scope/i)
    const writeManually = within(leftPane).getByRole('button', { name: /write manually/i })
    const generateWithLlm = within(leftPane).getByRole('button', { name: /generate with llm/i })
    const batchCount = within(leftPane).getByLabelText(/batch size/i)
    const generateBatch = within(leftPane).getByRole('button', { name: /generate a batch/i })

    // The dropdown sits above the control row entirely (DOCUMENT_POSITION_PRECEDING), and the
    // four controls are siblings of each other appearing in this exact order.
    expect(scopeSelect.compareDocumentPosition(writeManually) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(writeManually.parentElement).toBe(generateWithLlm.parentElement)
    expect(writeManually.parentElement).toBe(batchCount.parentElement)
    expect(writeManually.parentElement).toBe(generateBatch.parentElement)
    expect(
      writeManually.compareDocumentPosition(generateWithLlm) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      generateWithLlm.compareDocumentPosition(batchCount) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      batchCount.compareDocumentPosition(generateBatch) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
