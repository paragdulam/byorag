import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChunkInContextPreview } from '../../src/components/chunking/ChunkInContextPreview'
import type { StructuredPreview } from '../../src/lib/chunkingApi'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function stubStructuredPreview(preview: StructuredPreview) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(preview)),
  )
}

describe('ChunkInContextPreview (023-pdf-fullscreen-chunk-view US2)', () => {
  it('renders one page group per touched page, each with a page-number divider', async () => {
    stubStructuredPreview({
      fullText: 'word1 word2.',
      segments: [{ start: 0, end: 12, kind: 'chunk', chunkIndex: 0 }],
      pages: [{ pageNumber: 1, start: 0, end: 12 }],
      chunkRanges: [{ chunkIndex: 0, start: 0, end: 12 }],
    })

    render(
      <ChunkInContextPreview
        documentId="doc-1"
        selectedChunkIndex={0}
        hasUnsavedChanges={false}
      />,
    )

    await waitFor(() => expect(screen.getAllByTestId('chunk-context-page')).toHaveLength(1))
    expect(screen.getByTestId('chunk-context-page-number')).toHaveTextContent('1')
  })

  it('renders one page group per touched page when the selected chunk spans two pages', async () => {
    stubStructuredPreview({
      fullText: 'word1 word2 word3 word4.',
      segments: [
        { start: 0, end: 12, kind: 'chunk', chunkIndex: 0 },
        { start: 12, end: 25, kind: 'chunk', chunkIndex: 1 },
      ],
      pages: [
        { pageNumber: 1, start: 0, end: 12 },
        { pageNumber: 2, start: 12, end: 25 },
      ],
      chunkRanges: [
        { chunkIndex: 0, start: 0, end: 12 },
        { chunkIndex: 1, start: 6, end: 25 },
      ],
    })

    render(
      <ChunkInContextPreview
        documentId="doc-1"
        selectedChunkIndex={1}
        hasUnsavedChanges={false}
      />,
    )

    await waitFor(() => expect(screen.getAllByTestId('chunk-context-page')).toHaveLength(2))
    const dividers = screen.getAllByTestId('chunk-context-page-number')
    expect(dividers[0]).toHaveTextContent('1')
    expect(dividers[1]).toHaveTextContent('2')
  })

  it('shows the "no chunks yet" empty state when the document has no saved chunks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: "No saved chunks for document 'doc-1'" }, 404)),
    )

    render(
      <ChunkInContextPreview
        documentId="doc-1"
        selectedChunkIndex={0}
        hasUnsavedChanges={false}
      />,
    )

    await waitFor(() => expect(screen.getByTestId('chunked-preview-empty')).toBeInTheDocument())
  })

  it('shows the unsaved-changes state instead of fetching/rendering when hasUnsavedChanges is true', () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ fullText: '', segments: [], pages: [], chunkRanges: [] }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    render(
      <ChunkInContextPreview documentId="doc-1" selectedChunkIndex={0} hasUnsavedChanges={true} />,
    )

    expect(screen.getByTestId('chunk-context-unsaved')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
