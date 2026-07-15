import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useChunkEmbeddings } from '../../src/hooks/useChunkEmbeddings'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

type Listener = (event: { data?: string }) => void

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  closed = false
  private listeners: Record<string, Listener[]> = {}

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, listener: Listener) {
    ;(this.listeners[type] ??= []).push(listener)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data?: unknown) {
    const event = data === undefined ? {} : { data: JSON.stringify(data) }
    this.listeners[type]?.forEach((listener) => listener(event))
  }

  static latest(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1]
  }
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/embeddings/models')) {
        return jsonResponse({ models: [{ id: 'bert', label: 'BERT (bert-base-uncased)' }] })
      }
      if (url.includes('/api/chunking/saved-chunks')) {
        if (url.includes('documentId=doc-empty')) {
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
          documents: [
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

describe('useChunkEmbeddings', () => {
  it('loads the document list for the active corpus', async () => {
    stubFetch()

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', null))

    await waitFor(() => expect(result.current.documents).toHaveLength(1))
    expect(result.current.documents[0].name).toBe('report.pdf')
  })

  it('loads the model list, independent of document selection', async () => {
    stubFetch()

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', null))

    await waitFor(() => expect(result.current.models).toHaveLength(1))
    expect(result.current.models[0]).toEqual({ id: 'bert', label: 'BERT (bert-base-uncased)' })
  })

  it('loads saved chunks for the selected document', async () => {
    stubFetch()

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))

    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))
    expect(result.current.savedChunks[0].content).toBe('first chunk text')
  })

  it('shows an empty saved-chunks list for a document with none, not an error', async () => {
    stubFetch()

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'doc-empty'))

    await waitFor(() => expect(result.current.isLoadingSavedChunks).toBe(false))
    expect(result.current.savedChunks).toEqual([])
  })

  it('reloads saved chunks when the selected document changes', async () => {
    stubFetch()

    const { result, rerender } = renderHook(
      ({ documentId }) => useChunkEmbeddings('corpus-1', documentId),
      { initialProps: { documentId: 'doc-empty' } },
    )
    await waitFor(() => expect(result.current.isLoadingSavedChunks).toBe(false))
    expect(result.current.savedChunks).toEqual([])

    rerender({ documentId: 'report.pdf' })

    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))
  })

  it('has no saved chunks and is not loading when no document is selected', () => {
    stubFetch()

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', null))

    expect(result.current.savedChunks).toEqual([])
    expect(result.current.isLoadingSavedChunks).toBe(false)
  })
})

describe('useChunkEmbeddings — generate() (013-bert-pgvector-embeddings US2)', () => {
  it('updates progressPercent as progress events arrive, then transitions to success with a preview', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })

    expect(result.current.generateStatus).toBe('generating')
    expect(result.current.progressPercent).toBe(0)

    act(() => {
      MockEventSource.latest().emit('progress', { percent: 50, chunksEmbedded: 1, totalChunks: 2 })
    })
    expect(result.current.progressPercent).toBe(50)

    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [
          { chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] },
          { chunkId: 'chunk-2', model: 'bert', dims: 768, vector: [0.2] },
        ],
      })
    })

    expect(result.current.generateStatus).toBe('success')
    expect(result.current.preview?.vectors).toHaveLength(2)
  })

  it('replaces the previous unsaved preview when generate() is called again', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      })
    })
    expect(result.current.preview?.vectors).toHaveLength(1)

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    expect(result.current.preview).toBeNull()

    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [
          { chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] },
          { chunkId: 'chunk-2', model: 'bert', dims: 768, vector: [0.2] },
        ],
      })
    })
    expect(result.current.preview?.vectors).toHaveLength(2)
  })

  it('transitions to error when the generate stream reports an error', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('error')
    })

    expect(result.current.generateStatus).toBe('error')
  })
})

describe('useChunkEmbeddings — save() (013-bert-pgvector-embeddings US3)', () => {
  it('is a no-op before any successful generate()', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.save()
    })

    expect(result.current.saveStatus).toBe('idle')
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('transitions saveStatus idle -> saving -> success and does not touch generateStatus', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      })
    })
    expect(result.current.generateStatus).toBe('success')

    act(() => {
      result.current.save()
    })
    expect(result.current.saveStatus).toBe('saving')
    expect(result.current.generateStatus).toBe('success')

    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        savedCount: 1,
      })
    })

    expect(result.current.saveStatus).toBe('success')
    expect(result.current.generateStatus).toBe('success')
  })

  it('transitions saveStatus to error when the save stream reports an error', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      })
    })

    act(() => {
      result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('error')
    })

    expect(result.current.saveStatus).toBe('error')
  })

  it('does not set hasSavedOnce after a successful generate alone', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      })
    })

    expect(result.current.hasSavedOnce).toBe(false)
  })

  it('sets hasSavedOnce true only after a successful save, and keeps it true even if a later save or generate fails (one-way latch)', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useChunkEmbeddings('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.savedChunks).toHaveLength(2))

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        vectors: [{ chunkId: 'chunk-1', model: 'bert', dims: 768, vector: [0.1] }],
      })
    })
    expect(result.current.hasSavedOnce).toBe(false)

    act(() => {
      result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        documentId: 'report.pdf',
        model: 'bert',
        savedCount: 1,
      })
    })
    expect(result.current.hasSavedOnce).toBe(true)

    act(() => {
      result.current.generate('report.pdf', 'bert')
    })
    act(() => {
      MockEventSource.latest().emit('error')
    })
    expect(result.current.hasSavedOnce).toBe(true)

    act(() => {
      result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('error')
    })
    expect(result.current.hasSavedOnce).toBe(true)
  })
})
