import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEmbeddingProjection } from '../../src/hooks/useEmbeddingProjection'
import type { ProjectionDocumentGroup } from '../../src/hooks/useEmbeddingProjection'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function chunk(id: string, index: number) {
  return { id, index, content: `chunk ${index}` }
}

function savedEmbeddingsByChunk(map: Record<string, number[] | null>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/embeddings/saved')) {
        const chunkId = decodeURIComponent(/chunkId=([^&]+)/.exec(url)?.[1] ?? '')
        const vector = map[chunkId]
        return jsonResponse({
          embeddings: vector
            ? [{ id: `${chunkId}-e1`, model: 'bert', createdAt: '2026-07-28T00:00:00Z', dims: vector.length, vector }]
            : [],
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

describe('useEmbeddingProjection (021-sources-chunking-embeddings-refresh US4)', () => {
  it('resolves one entry per chunk that has a saved embedding', async () => {
    savedEmbeddingsByChunk({ c1: [1, 2, 3], c2: [4, 5, 6] })
    const groups: ProjectionDocumentGroup[] = [
      { documentId: 'doc-1', documentName: 'a.pdf', chunks: [chunk('c1', 0), chunk('c2', 1)] },
    ]

    const { result } = renderHook(() => useEmbeddingProjection(groups, 'vector'))

    await waitFor(() => expect(result.current.entryCount).toBe(2))
    expect(result.current.excludedDocuments).toEqual([])
  })

  it('excludes a document contributing zero embedded chunks, reporting it', async () => {
    savedEmbeddingsByChunk({ c1: [1, 2, 3], c2: null })
    const groups: ProjectionDocumentGroup[] = [
      { documentId: 'doc-1', documentName: 'a.pdf', chunks: [chunk('c1', 0)] },
      { documentId: 'doc-2', documentName: 'b.pdf', chunks: [chunk('c2', 0)] },
    ]

    const { result } = renderHook(() => useEmbeddingProjection(groups, 'vector'))

    await waitFor(() => expect(result.current.entryCount).toBe(1))
    expect(result.current.excludedDocuments).toEqual([{ documentId: 'doc-2', documentName: 'b.pdf' }])
  })

  it('does not compute a projection for the "vector" method', async () => {
    savedEmbeddingsByChunk({ c1: [1], c2: [1], c3: [1], c4: [1], c5: [1] })
    const groups: ProjectionDocumentGroup[] = [
      {
        documentId: 'doc-1',
        documentName: 'a.pdf',
        chunks: [chunk('c1', 0), chunk('c2', 1), chunk('c3', 2), chunk('c4', 3), chunk('c5', 4)],
      },
    ]

    const { result } = renderHook(() => useEmbeddingProjection(groups, 'vector'))

    await waitFor(() => expect(result.current.entryCount).toBe(5))
    expect(result.current.points).toBeNull()
  })

  it('does not compute a projection when fewer than 5 entries are resolved', async () => {
    savedEmbeddingsByChunk({ c1: [1], c2: [1] })
    const groups: ProjectionDocumentGroup[] = [
      { documentId: 'doc-1', documentName: 'a.pdf', chunks: [chunk('c1', 0), chunk('c2', 1)] },
    ]

    const { result } = renderHook(() => useEmbeddingProjection(groups, 'umap'))

    await waitFor(() => expect(result.current.entryCount).toBe(2))
    expect(result.current.points).toBeNull()
  })

  it('computes and returns points once 5+ entries are resolved for umap/pca', async () => {
    const vectors: Record<string, number[]> = {}
    const chunks = Array.from({ length: 5 }, (_, i) => {
      vectors[`c${i}`] = [i, i * 2]
      return chunk(`c${i}`, i)
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/embeddings/saved')) {
          const chunkId = decodeURIComponent(/chunkId=([^&]+)/.exec(url)?.[1] ?? '')
          const vector = vectors[chunkId]
          return jsonResponse({
            embeddings: [{ id: `${chunkId}-e1`, model: 'bert', createdAt: '2026-07-28T00:00:00Z', dims: 2, vector }],
          })
        }
        if (url.includes('/api/embeddings/project')) {
          const body = JSON.parse((init?.body as string) ?? '{}') as {
            entries: { chunkId: string; documentId: string }[]
          }
          return jsonResponse({
            points: body.entries.map((e, i) => ({ chunkId: e.chunkId, documentId: e.documentId, x: i, y: i })),
          })
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
    const groups: ProjectionDocumentGroup[] = [{ documentId: 'doc-1', documentName: 'a.pdf', chunks }]

    const { result } = renderHook(() => useEmbeddingProjection(groups, 'pca'))

    await waitFor(() => expect(result.current.points).not.toBeNull())
    expect(result.current.points).toHaveLength(5)
  })

  it('surfaces an error message when the projection request fails', async () => {
    const vectors: Record<string, number[]> = {}
    const chunks = Array.from({ length: 5 }, (_, i) => {
      vectors[`c${i}`] = [i]
      return chunk(`c${i}`, i)
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/embeddings/saved')) {
          const chunkId = decodeURIComponent(/chunkId=([^&]+)/.exec(url)?.[1] ?? '')
          return jsonResponse({
            embeddings: [{ id: `${chunkId}-e1`, model: 'bert', createdAt: '2026-07-28T00:00:00Z', dims: 1, vector: vectors[chunkId] }],
          })
        }
        if (url.includes('/api/embeddings/project')) {
          return jsonResponse({ detail: 'boom' }, 400)
        }
        throw new Error(`Unexpected fetch: ${url}`)
      }),
    )
    const groups: ProjectionDocumentGroup[] = [{ documentId: 'doc-1', documentName: 'a.pdf', chunks }]

    const { result } = renderHook(() => useEmbeddingProjection(groups, 'umap'))

    await waitFor(() => expect(result.current.error).toBe('boom'))
    expect(result.current.points).toBeNull()
  })
})
