import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('CorporaScreen navigation (009-corpora-screen US1)', () => {
  it('navigates to a dedicated Corpora screen, distinct from the sidebar quick-switcher list', async () => {
    render(<App />)

    await userEvent.click(screen.getByText('CORPORA'))

    expect(screen.getByRole('heading', { name: 'Corpora' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })
})

describe('Cross-section scoping from the Corpora screen (009-corpora-screen US2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubTwoCorporaFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()

        if (href.endsWith('/api/corpora')) {
          return jsonResponse({
            corpora: [
              { id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' },
              { id: 'corpus-b', name: 'Corpus B', createdAt: '2026-07-14T00:05:00Z' },
            ],
          })
        }
        if (href.includes('/api/system/capacity')) {
          return jsonResponse({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: null,
          })
        }
        if (href.includes('corpusId=corpus-a')) {
          return jsonResponse({
            documents: [
              {
                id: 'doc-a',
                name: 'a.pdf',
                sizeBytes: 10,
                uploadedAt: '2026-07-14T01:00:00Z',
                status: 'processed',
              },
            ],
          })
        }
        if (href.includes('corpusId=corpus-b')) {
          return jsonResponse({
            documents: [
              {
                id: 'doc-b',
                name: 'b.pdf',
                sizeBytes: 20,
                uploadedAt: '2026-07-14T01:05:00Z',
                status: 'processed',
              },
            ],
          })
        }
        if (href.includes('/api/chunking/saved-chunks')) {
          return jsonResponse({ chunks: [] })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )
  }

  async function switchToCorpusBViaCorporaScreen() {
    await userEvent.click(screen.getByText('CORPORA'))
    await waitFor(() => expect(screen.getByTestId('corpus-row-corpus-b')).toBeInTheDocument())
    // Row clicks no longer switch the active corpus (018-ui-polish-batch US5) — only the
    // row's own explicit "Make Active" button does.
    await userEvent.click(screen.getByRole('button', { name: /make corpus b active/i }))
  }

  it('switching the active corpus from the Corpora screen immediately updates Sources, no reload', async () => {
    stubTwoCorporaFetch()
    render(<App />)

    await switchToCorpusBViaCorporaScreen()

    await userEvent.click(screen.getByText('SOURCES'))

    await waitFor(() => expect(screen.getByText('b.pdf')).toBeInTheDocument())
    expect(screen.queryByText('a.pdf')).not.toBeInTheDocument()
  })

  it('switching the active corpus from the Corpora screen immediately updates the Chunking document picker', async () => {
    stubTwoCorporaFetch()
    render(<App />)

    await switchToCorpusBViaCorporaScreen()

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    const picker = (await screen.findByLabelText('Select document')) as HTMLSelectElement
    await waitFor(() => expect(picker).toHaveTextContent('b.pdf'))
    expect(picker).not.toHaveTextContent('a.pdf')
  })
})

describe('Deleting the active corpus falls back correctly (009-corpora-screen US4, relocated per-row in 011-move-corpus-row-actions)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to the remaining corpus, reflected immediately in Sources', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let corpusADeleted = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = url.toString()

        if (init?.method === 'DELETE' && href.endsWith('/api/corpora/corpus-a')) {
          corpusADeleted = true
          return new Response(null, { status: 204 })
        }
        if (href.endsWith('/api/corpora')) {
          const corpora = corpusADeleted
            ? [{ id: 'corpus-b', name: 'Corpus B', createdAt: '2026-07-14T00:05:00Z' }]
            : [
                { id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' },
                { id: 'corpus-b', name: 'Corpus B', createdAt: '2026-07-14T00:05:00Z' },
              ]
          return jsonResponse({ corpora })
        }
        if (href.includes('/api/system/capacity')) {
          return jsonResponse({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: null,
          })
        }
        if (href.includes('corpusId=corpus-b')) {
          return jsonResponse({
            documents: [
              {
                id: 'doc-b',
                name: 'b.pdf',
                sizeBytes: 20,
                uploadedAt: '2026-07-14T01:05:00Z',
                status: 'processed',
              },
            ],
          })
        }
        if (href.includes('/api/chunking/saved-chunks')) {
          return jsonResponse({ chunks: [] })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    await userEvent.click(screen.getByText('CORPORA'))
    await waitFor(() => expect(screen.getByTestId('corpus-row-corpus-a')).toBeInTheDocument())
    // Corpus A is active by default (first in the list).
    expect(screen.getByTestId('corpus-row-corpus-a')).toHaveAttribute('aria-current', 'page')

    await userEvent.click(screen.getByRole('button', { name: /delete corpus a/i }))

    await waitFor(() =>
      expect(screen.getByTestId('corpus-row-corpus-b')).toHaveAttribute('aria-current', 'page'),
    )

    await userEvent.click(screen.getByText('SOURCES'))
    await waitFor(() => expect(screen.getByText('b.pdf')).toBeInTheDocument())
  })
})
