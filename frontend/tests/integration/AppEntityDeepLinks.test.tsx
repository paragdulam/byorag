import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App'

// 034-more-deep-links: end-to-end checks (through the real App + router, not a mocked screen)
// that a few of the new entity-level deep links round-trip correctly — both "open this URL and
// land on the right state" and "click this and the URL updates to match." The default fetch mock
// (tests/setup.ts) resolves a single corpus, id "default-corpus", and resets window.history to
// "/" before every test.

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('App entity deep links (034-more-deep-links)', () => {
  it('opens the Golden Dataset "Write Manually" form directly from /golden-dataset/:corpusId/new', async () => {
    window.history.pushState({}, '', '/golden-dataset/default-corpus/new')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/auth/me')) {
          return jsonResponse({ id: 'default-user', email: 'test@example.com', createdAt: '2026-07-14T00:00:00Z' })
        }
        if (url.includes('/api/corpora')) {
          return jsonResponse({ corpora: [{ id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' }] })
        }
        if (url.includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: true, maskedKey: '...test' })
        }
        if (url.includes('/api/golden-dataset/entries')) {
          return jsonResponse({ entries: [] })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    expect(await screen.findByRole('textbox', { name: /^question$/i })).toBeInTheDocument()
  })

  it('clicking "Write Manually" on the Golden Dataset screen updates the URL to .../new', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/auth/me')) {
          return jsonResponse({ id: 'default-user', email: 'test@example.com', createdAt: '2026-07-14T00:00:00Z' })
        }
        if (url.includes('/api/corpora')) {
          return jsonResponse({ corpora: [{ id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' }] })
        }
        if (url.includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: true, maskedKey: '...test' })
        }
        if (url.includes('/api/golden-dataset/entries')) {
          return jsonResponse({ entries: [] })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    await userEvent.click(await screen.findByText('GOLDEN DATASET'))
    await waitFor(() => expect(window.location.pathname).toBe('/golden-dataset/default-corpus'))
    await userEvent.click(screen.getByRole('button', { name: 'Write Manually' }))

    await waitFor(() => expect(window.location.pathname).toBe('/golden-dataset/default-corpus/new'))
  })

  it('clicking a document on the Sources screen updates the URL to include its id', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/auth/me')) {
          return jsonResponse({ id: 'default-user', email: 'test@example.com', createdAt: '2026-07-14T00:00:00Z' })
        }
        if (url.includes('/api/corpora')) {
          return jsonResponse({ corpora: [{ id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' }] })
        }
        if (url.includes('/api/sources')) {
          return jsonResponse({
            documents: [{ id: 'doc-a', name: 'a.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' }],
            rejections: [],
          })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    await userEvent.click(await screen.findByText('a.pdf'))

    await waitFor(() => expect(window.location.pathname).toBe('/sources/default-corpus/doc-a'))
  })

  // Regression: clicking a chunk pushes its id into the URL (onChunkLinked), which becomes the
  // next `linkedChunkId` prop — the screen's own "a linked chunk might belong to any document"
  // handling must not mistake that self-triggered update for an external deep link and yank the
  // scope back to "Entire Corpus" after every single click.
  it('clicking a chunk within a single selected document does not jump the scope to Entire Corpus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/auth/me')) {
          return jsonResponse({ id: 'default-user', email: 'test@example.com', createdAt: '2026-07-14T00:00:00Z' })
        }
        if (url.includes('/api/corpora')) {
          return jsonResponse({ corpora: [{ id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' }] })
        }
        if (url.includes('/api/sources')) {
          return jsonResponse({
            documents: [
              { id: 'doc-a', name: 'A M Mair Co vs Gordhandass Sagarmull.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' },
            ],
            rejections: [],
          })
        }
        if (url.includes('/api/chunking/saved-chunks')) {
          return jsonResponse({
            chunks: [
              { id: 'chunk-1', index: 0, content: 'first chunk text' },
              { id: 'chunk-2', index: 1, content: 'second chunk text' },
            ],
          })
        }
        if (url.includes('/api/embeddings/saved')) {
          return jsonResponse({ embeddings: [] })
        }
        if (url.includes('/api/embeddings/projection-methods')) {
          return jsonResponse({
            methods: [{ id: 'vector', label: 'Vector', available: true }],
          })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    await userEvent.click(await screen.findByText('VECTOR VIEW'))
    const documentSelect = await screen.findByLabelText(/select document/i)
    await waitFor(() => expect(documentSelect).toHaveValue('doc-a'))

    await userEvent.click(await screen.findByTestId('vector-view-chunk-chunk-1'))
    await waitFor(() => expect(window.location.pathname).toBe('/vector-view/default-corpus/chunk-1'))
    expect(documentSelect).toHaveValue('doc-a')

    await userEvent.click(screen.getByTestId('vector-view-chunk-chunk-2'))
    await waitFor(() => expect(window.location.pathname).toBe('/vector-view/default-corpus/chunk-2'))
    expect(documentSelect).toHaveValue('doc-a')
  })
})
