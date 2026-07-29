import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'
import { ENTIRE_CORPUS_SELECTION } from '../../src/lib/entireCorpusSelection'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const SINGLE_DOC = [
  {
    id: 'report.pdf',
    name: 'report.pdf',
    sizeBytes: 1024,
    uploadedAt: '2026-07-13T10:00:00Z',
    status: 'processed',
  },
]

const THREE_DOCS = [
  { id: 'doc-a', name: 'a.pdf', sizeBytes: 1024, uploadedAt: '2026-07-13T10:00:00Z', status: 'processed' },
  { id: 'doc-b', name: 'b.pdf', sizeBytes: 1024, uploadedAt: '2026-07-13T10:00:00Z', status: 'processed' },
  { id: 'doc-c', name: 'c.pdf', sizeBytes: 1024, uploadedAt: '2026-07-13T10:00:00Z', status: 'processed' },
]

/** Stubs `fetch` for the document-list GET (`/api/sources`) and the saved-chunks GET
 * (`/api/chunking/saved-chunks`, defaulting every document to `[]` unless overridden via
 * `savedChunksByDocId`) — run/save still go through the mocked `EventSource` below. */
function stubFetch(docs: unknown[] = SINGLE_DOC, savedChunksByDocId: Record<string, unknown[]> = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/chunking/saved-chunks')) {
        const documentId = decodeURIComponent(/documentId=([^&]+)/.exec(url)?.[1] ?? '')
        return jsonResponse({ chunks: savedChunksByDocId[documentId] ?? [] })
      }
      if (url.includes('/api/sources')) {
        return jsonResponse({ documents: docs })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
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

function chunkResult(chunkSize: number, overlap = 0) {
  return {
    extractionFailed: false,
    result: {
      chunks: [{ index: 0, content: 'hello' }],
      totalChunks: 1,
      strategy: 'fixed-size',
      chunkSize,
      overlap,
    },
  }
}

async function renderAndRun(chunkSize = 50, overlap = 0) {
  const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
  await waitFor(() => expect(result.current.documents).toHaveLength(1))

  act(() => {
    result.current.run('report.pdf', chunkSize, overlap)
  })
  act(() => {
    MockEventSource.latest().emit('result', chunkResult(chunkSize, overlap))
  })

  return result
}

describe('useFixedSizeChunking', () => {
  it('loads the document list on mount', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)

    const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })
    expect(result.current.documents[0].name).toBe('report.pdf')
  })

  it('updates progressPercent as progress events arrive, then transitions to success', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    expect(result.current.status).toBe('running')
    expect(result.current.progressPercent).toBe(0)

    act(() => {
      MockEventSource.latest().emit('progress', { percent: 45 })
    })
    expect(result.current.progressPercent).toBe(45)

    act(() => {
      MockEventSource.latest().emit('result', chunkResult(50))
    })

    expect(result.current.status).toBe('success')
    expect(result.current.result?.chunks).toHaveLength(1)
  })

  it('transitions to extraction-failed when the backend reports extractionFailed', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    act(() => {
      MockEventSource.latest().emit('result', { extractionFailed: true, result: null })
    })

    expect(result.current.status).toBe('extraction-failed')
    expect(result.current.result).toBeNull()
    expect(result.current.hasSavedOnce).toBe(false)
  })

  it('transitions to error when the stream reports an error', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    act(() => {
      MockEventSource.latest().emit('error')
    })

    expect(result.current.status).toBe('error')
  })

  it('forwards overlap into the constructed EventSource URL', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50, 20)
    })

    expect(MockEventSource.latest().url).toContain('overlap=20')
  })

  it('does not set hasSavedOnce after a successful preview alone (save is a separate action)', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun()

    expect(result.current.status).toBe('success')
    expect(result.current.hasSavedOnce).toBe(false)
  })

  it('save() streams progress and transitions saveStatus idle -> saving -> success', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun(50, 20)
    expect(result.current.saveStatus).toBe('idle')

    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = result.current.save()
    })
    expect(result.current.saveStatus).toBe('saving')
    expect(result.current.saveProgressPercent).toBe(0)

    const saveSource = MockEventSource.latest()
    expect(saveSource.url).toContain('/api/chunking/save/stream')
    expect(saveSource.url).toContain('documentId=report.pdf')
    expect(saveSource.url).toContain('chunkSize=50')
    expect(saveSource.url).toContain('overlap=20')

    act(() => {
      saveSource.emit('progress', { percent: 60 })
    })
    expect(result.current.saveProgressPercent).toBe(60)

    act(() => {
      saveSource.emit('result', chunkResult(50, 20))
    })

    await act(async () => {
      await savePromise
    })

    expect(result.current.saveStatus).toBe('success')
    expect(result.current.hasSavedOnce).toBe(true)
  })

  it('save() sets saveStatus to error and leaves hasSavedOnce false when the stream reports an error', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun()

    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('error', { message: 'boom' })
    })
    await act(async () => {
      await savePromise
    })

    expect(result.current.saveStatus).toBe('error')
    expect(result.current.hasSavedOnce).toBe(false)
  })

  it('keeps hasSavedOnce true even if a later save or preview fails (one-way latch)', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun()
    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('result', chunkResult(50))
    })
    await act(async () => {
      await savePromise
    })
    expect(result.current.hasSavedOnce).toBe(true)

    act(() => {
      result.current.run('report.pdf', 50)
    })
    act(() => {
      MockEventSource.latest().emit('error')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.hasSavedOnce).toBe(true)
  })

  it('isSaved is false before any save', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun()

    expect(result.current.isSaved).toBe(false)
  })

  it('isSaved becomes true immediately after a successful save matching the current preview', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun(50, 20)
    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('result', chunkResult(50, 20))
    })
    await act(async () => {
      await savePromise
    })

    expect(result.current.isSaved).toBe(true)
  })

  it('isSaved reverts to false after a subsequent successful preview, even with identical params, until re-saved', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun(50, 20)
    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('result', chunkResult(50, 20))
    })
    await act(async () => {
      await savePromise
    })
    expect(result.current.isSaved).toBe(true)

    act(() => {
      result.current.run('report.pdf', 50, 20)
    })
    act(() => {
      MockEventSource.latest().emit('result', chunkResult(50, 20))
    })

    expect(result.current.isSaved).toBe(false)

    act(() => {
      savePromise = result.current.save()
    })
    act(() => {
      MockEventSource.latest().emit('result', chunkResult(50, 20))
    })
    await act(async () => {
      await savePromise
    })
    expect(result.current.isSaved).toBe(true)
  })

  describe('Entire Corpus', () => {
    it('runs chunking for every document sequentially, reporting batchProgress and batchResults', async () => {
      stubFetch(THREE_DOCS)
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
      await waitFor(() => expect(result.current.documents).toHaveLength(3))

      act(() => {
        result.current.run(ENTIRE_CORPUS_SELECTION, 50)
      })

      expect(result.current.isEntireCorpus).toBe(true)
      await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
      expect(MockEventSource.latest().url).toContain('documentId=doc-a')
      expect(result.current.batchProgress).toMatchObject({ index: 0, total: 3, documentId: 'doc-a' })
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(2))
      expect(MockEventSource.latest().url).toContain('documentId=doc-b')
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(3))
      expect(MockEventSource.latest().url).toContain('documentId=doc-c')
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(result.current.status).toBe('success'))
      expect(result.current.batchProgress).toBeNull()
      expect(result.current.batchResults.map((r) => r.documentId)).toEqual(['doc-a', 'doc-b', 'doc-c'])
      expect(result.current.batchResults.every((r) => r.status === 'success')).toBe(true)
    })

    it('records a per-document failure and still completes/saves the rest', async () => {
      stubFetch(THREE_DOCS)
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
      await waitFor(() => expect(result.current.documents).toHaveLength(3))

      act(() => {
        result.current.run(ENTIRE_CORPUS_SELECTION, 50)
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(2))
      act(() => {
        MockEventSource.latest().emit('error', { message: 'extraction failed' })
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(3))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(result.current.status).toBe('success'))
      expect(result.current.batchResults.map((r) => r.status)).toEqual(['success', 'failed', 'success'])

      // Save persists only the documents that were part of the batch; the runner reuses
      // the shared chunkSize/overlap for each document's own save/stream call.
      act(() => {
        void result.current.save()
      })
      await waitFor(() => expect(MockEventSource.instances).toHaveLength(4))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })
      await waitFor(() => expect(MockEventSource.instances).toHaveLength(5))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })
      await waitFor(() => expect(MockEventSource.instances).toHaveLength(6))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(result.current.saveStatus).toBe('success'))
      expect(result.current.hasSavedOnce).toBe(true)
    })

    it('treats a document whose result reports extractionFailed as a batch failure, not a success', async () => {
      stubFetch(THREE_DOCS)
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
      await waitFor(() => expect(result.current.documents).toHaveLength(3))

      act(() => {
        result.current.run(ENTIRE_CORPUS_SELECTION, 50)
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(1))
      act(() => {
        // Extraction failure is a normal, successfully-received terminal `result` event
        // (never a stream `error` event) — this must still count as a per-document failure.
        MockEventSource.latest().emit('result', { extractionFailed: true, result: null })
      })

      await waitFor(() => expect(MockEventSource.instances).toHaveLength(2))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })
      await waitFor(() => expect(MockEventSource.instances).toHaveLength(3))
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      await waitFor(() => expect(result.current.status).toBe('success'))
      expect(result.current.batchResults.map((r) => r.status)).toEqual(['failed', 'success', 'success'])
      expect(result.current.batchResults[0].errorMessage).toMatch(/could not be extracted/i)
    })
  })

  describe('Auto-load saved chunks (021-sources-chunking-embeddings-refresh)', () => {
    it('auto-loads a single document\'s saved chunks on mount, with no run() call', async () => {
      stubFetch(SINGLE_DOC, {
        'report.pdf': [{ id: 'c1', index: 0, content: 'hello' }],
      })
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1', 'report.pdf'))

      await waitFor(() => expect(result.current.status).toBe('success'))
      expect(result.current.result?.chunks).toEqual([{ id: 'c1', index: 0, content: 'hello' }])
      expect(result.current.chunkOrigin).toBe('auto-loaded')
      expect(result.current.isSaved).toBe(true)
      expect(result.current.hasSavedOnce).toBe(true)
      // No EventSource was ever opened — nothing was recomputed, only read.
      expect(MockEventSource.instances).toHaveLength(0)
    })

    it('shows the empty/not-yet-chunked state for a document with no saved chunks', async () => {
      stubFetch(SINGLE_DOC, {})
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1', 'report.pdf'))
      await waitFor(() => expect(result.current.documents).toHaveLength(1))

      expect(result.current.status).toBe('idle')
      expect(result.current.result).toBeNull()
      expect(result.current.chunkOrigin).toBeNull()
    })

    it('"Re-Calculate Chunks" (run()) replaces an auto-loaded result with a freshly computed one', async () => {
      stubFetch(SINGLE_DOC, {
        'report.pdf': [{ id: 'c1', index: 0, content: 'old saved chunk' }],
      })
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1', 'report.pdf'))
      await waitFor(() => expect(result.current.chunkOrigin).toBe('auto-loaded'))

      act(() => {
        result.current.run('report.pdf', 50)
      })
      act(() => {
        MockEventSource.latest().emit('result', chunkResult(50))
      })

      expect(result.current.status).toBe('success')
      expect(result.current.chunkOrigin).toBe('computed')
      expect(result.current.result?.chunks).toEqual([{ index: 0, content: 'hello' }])
    })

    it('auto-loads saved chunks for every already-chunked document under "Entire Corpus"', async () => {
      stubFetch(THREE_DOCS, {
        'doc-a': [{ id: 'a1', index: 0, content: 'chunk a' }],
        'doc-b': [],
        'doc-c': [{ id: 'c1', index: 0, content: 'chunk c' }],
      })
      vi.stubGlobal('EventSource', MockEventSource)
      MockEventSource.instances = []

      const { result } = renderHook(() => useFixedSizeChunking('corpus-1', ENTIRE_CORPUS_SELECTION))

      await waitFor(() => expect(result.current.status).toBe('success'))
      expect(result.current.isEntireCorpus).toBe(true)
      expect(result.current.chunkOrigin).toBe('auto-loaded')
      expect(result.current.batchResults.map((r) => r.documentId)).toEqual(['doc-a', 'doc-b', 'doc-c'])
      expect(result.current.batchResults.map((r) => r.result?.result?.totalChunks)).toEqual([1, 0, 1])
      // No EventSource was ever opened — nothing was recomputed, only read.
      expect(MockEventSource.instances).toHaveLength(0)
    })
  })
})
