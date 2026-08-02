import { render as rtlRender, screen, waitFor } from '@testing-library/react'
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
