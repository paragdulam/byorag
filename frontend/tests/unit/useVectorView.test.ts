import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVectorView } from '../../src/hooks/useVectorView'
import { ENTIRE_CORPUS_SELECTION } from '../../src/lib/entireCorpusSelection'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const THREE_DOCS = [
  { id: 'doc-a', name: 'a.pdf', sizeBytes: 1024, uploadedAt: '2026-07-13T10:00:00Z', status: 'processed' },
  { id: 'doc-b', name: 'b.pdf', sizeBytes: 1024, uploadedAt: '2026-07-13T10:00:00Z', status: 'processed' },
  { id: 'doc-c', name: 'c.pdf', sizeBytes: 1024, uploadedAt: '2026-07-13T10:00:00Z', status: 'processed' },
]

function stubFetch(docs: unknown[] | null = null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/embeddings/projection-methods')) {
        return jsonResponse({
          methods: [
            { id: 'vector', label: 'Vector', available: true },
            { id: 'umap', label: 'UMAP', available: false },
            { id: 'pca', label: 'PCA', available: false },
          ],
        })
      }
      if (url.includes('/api/embeddings/saved')) {
        if (url.includes('chunkId=chunk-empty')) {
          return jsonResponse({ embeddings: [] })
        }
        return jsonResponse({
          embeddings: [
            {
              id: 'emb-2',
              model: 'bert',
              createdAt: '2026-07-15T10:05:00Z',
              dims: 768,
              vector: [0.2],
            },
            {
              id: 'emb-1',
              model: 'bert',
              createdAt: '2026-07-15T10:03:00Z',
              dims: 768,
              vector: [0.1],
            },
          ],
        })
      }
      if (url.includes('/api/chunking/saved-chunks')) {
        if (url.includes('documentId=doc-b')) {
          return jsonResponse({ chunks: [] })
        }
        return jsonResponse({
          chunks: [
            { id: 'chunk-1', index: 0, content: 'first chunk text' },
            { id: 'chunk-2', index: 1, content: 'second chunk text' },
          ],
        })
      }
      if (url.includes('/api/sources')) {
        return jsonResponse({
          documents: docs ?? [
            {
              id: 'report.pdf',
              name: 'report.pdf',
              sizeBytes: 1024,
              uploadedAt: '2026-07-13T10:00:00Z',
              status: 'processed',
            },
          ],
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

describe('useVectorView', () => {
  it('loads the document list for the active corpus', async () => {
    stubFetch()

    const { result } = renderHook(() => useVectorView('corpus-1', null, null))

    await waitFor(() => expect(result.current.documents).toHaveLength(1))
    expect(result.current.documents[0].name).toBe('report.pdf')
  })

  it('loads saved chunks for the selected document', async () => {
    stubFetch()

    const { result } = renderHook(() => useVectorView('corpus-1', 'report.pdf', null))

    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))
  })

  it('loads saved embeddings for the selected chunk', async () => {
    stubFetch()

    const { result } = renderHook(() => useVectorView('corpus-1', 'report.pdf', 'chunk-1'))

    await waitFor(() => expect(result.current.savedEmbeddings).toHaveLength(2))
    expect(result.current.savedEmbeddings[0].id).toBe('emb-2')
  })

  it('shows an empty saved-embeddings list for a chunk with none, not an error', async () => {
    stubFetch()

    const { result } = renderHook(() => useVectorView('corpus-1', 'report.pdf', 'chunk-empty'))

    await waitFor(() => expect(result.current.isLoadingSavedEmbeddings).toBe(false))
    expect(result.current.savedEmbeddings).toEqual([])
  })

  it('has no saved embeddings and is not loading when no chunk is selected', () => {
    stubFetch()

    const { result } = renderHook(() => useVectorView('corpus-1', 'report.pdf', null))

    expect(result.current.savedEmbeddings).toEqual([])
    expect(result.current.isLoadingSavedEmbeddings).toBe(false)
  })

  it('reloads saved embeddings when the selected chunk changes', async () => {
    stubFetch()

    const { result, rerender } = renderHook(
      ({ chunkId }) => useVectorView('corpus-1', 'report.pdf', chunkId),
      { initialProps: { chunkId: 'chunk-empty' } },
    )
    await waitFor(() => expect(result.current.isLoadingSavedEmbeddings).toBe(false))
    expect(result.current.savedEmbeddings).toEqual([])

    rerender({ chunkId: 'chunk-1' })

    await waitFor(() => expect(result.current.savedEmbeddings).toHaveLength(2))
  })

  it('loads projection methods, independent of selection, with "vector" present and available', async () => {
    stubFetch()

    const { result } = renderHook(() => useVectorView('corpus-1', null, null))

    await waitFor(() => expect(result.current.projectionMethods).toHaveLength(3))
    const vector = result.current.projectionMethods.find((m) => m.id === 'vector')
    expect(vector).toEqual({ id: 'vector', label: 'Vector', available: true })
  })
})

describe('useVectorView — Entire Corpus (018-ui-polish-batch US8)', () => {
  it('is entire-corpus mode when the selection is the sentinel', () => {
    stubFetch(THREE_DOCS)

    const { result } = renderHook(() => useVectorView('corpus-1', ENTIRE_CORPUS_SELECTION, null))

    expect(result.current.isEntireCorpus).toBe(true)
  })

  it('builds chunkGroups from every document with saved chunks, in document order, omitting ones with none', async () => {
    stubFetch(THREE_DOCS)

    const { result } = renderHook(() => useVectorView('corpus-1', ENTIRE_CORPUS_SELECTION, null))
    await waitFor(() => expect(result.current.documents).toHaveLength(3))

    await waitFor(() => expect(result.current.chunkGroups).toHaveLength(2))
    expect(result.current.chunkGroups.map((g) => g.documentId)).toEqual(['doc-a', 'doc-c'])
    expect(result.current.chunkGroups[0].chunks).toHaveLength(2)
    expect(result.current.savedChunks).toEqual([])
  })

  it('does not treat entire-corpus selection as a single document for savedChunks', async () => {
    stubFetch(THREE_DOCS)

    const { result } = renderHook(() => useVectorView('corpus-1', ENTIRE_CORPUS_SELECTION, null))
    await waitFor(() => expect(result.current.documents).toHaveLength(3))

    expect(result.current.savedChunks).toEqual([])
    expect(result.current.isLoadingSavedChunks).toBe(false)
  })

  it('leaves chunkGroups empty and non-entire-corpus behavior unaffected for a single-document selection', async () => {
    stubFetch(THREE_DOCS)

    const { result } = renderHook(() => useVectorView('corpus-1', 'doc-a', null))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    expect(result.current.isEntireCorpus).toBe(false)
    expect(result.current.chunkGroups).toEqual([])
  })
})
