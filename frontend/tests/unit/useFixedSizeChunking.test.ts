import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

/**
 * Stubs `fetch` for both the document-list GET (`/api/sources`) and the save POST
 * (`/api/chunking/save`), routing by URL/method so both `useFixedSizeChunking`'s
 * initial load and `save()` can be exercised in the same test.
 */
function stubFetch(options: { saveResponse?: unknown; saveStatus?: number } = {}) {
  const { saveResponse = { extractionFailed: false, result: null }, saveStatus = 200 } = options
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/chunking/save')) {
        return jsonResponse(saveResponse, saveStatus)
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
      throw new Error(`Unexpected fetch: ${init?.method ?? 'GET'} ${url}`)
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

async function renderAndRun(chunkSize = 50, overlap = 0) {
  const { result } = renderHook(() => useFixedSizeChunking('corpus-1'))
  await waitFor(() => expect(result.current.documents).toHaveLength(1))

  act(() => {
    result.current.run('report.pdf', chunkSize, overlap)
  })
  act(() => {
    MockEventSource.latest().emit('result', {
      extractionFailed: false,
      result: {
        chunks: [{ index: 0, content: 'hello' }],
        totalChunks: 1,
        strategy: 'fixed-size',
        chunkSize,
        overlap,
      },
    })
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
      MockEventSource.latest().emit('result', {
        extractionFailed: false,
        result: {
          chunks: [{ index: 0, content: 'hello' }],
          totalChunks: 1,
          strategy: 'fixed-size',
          chunkSize: 50,
          overlap: 0,
        },
      })
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

  it('save() POSTs the last run parameters and transitions saveStatus idle -> saving -> success', async () => {
    stubFetch({
      saveResponse: {
        extractionFailed: false,
        result: {
          chunks: [{ index: 0, content: 'hello' }],
          totalChunks: 1,
          strategy: 'fixed-size',
          chunkSize: 50,
          overlap: 20,
        },
      },
    })
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun(50, 20)
    expect(result.current.saveStatus).toBe('idle')

    let savePromise: Promise<void> | undefined
    act(() => {
      savePromise = result.current.save()
    })
    expect(result.current.saveStatus).toBe('saving')

    await act(async () => {
      await savePromise
    })

    expect(result.current.saveStatus).toBe('success')
    expect(result.current.hasSavedOnce).toBe(true)

    const saveCall = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => String(input).includes('/api/chunking/save'))
    expect(saveCall).toBeDefined()
    const [, init] = saveCall!
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init!.body as string)).toEqual({
      documentId: 'report.pdf',
      chunkSize: 50,
      overlap: 20,
    })
  })

  it('save() sets saveStatus to error and leaves hasSavedOnce false when the request fails', async () => {
    stubFetch({ saveResponse: { detail: 'boom' }, saveStatus: 500 })
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun()

    await act(async () => {
      await result.current.save()
    })

    expect(result.current.saveStatus).toBe('error')
    expect(result.current.hasSavedOnce).toBe(false)
  })

  it('keeps hasSavedOnce true even if a later save or preview fails (one-way latch)', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun()
    await act(async () => {
      await result.current.save()
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
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.isSaved).toBe(true)
  })

  it('isSaved reverts to false after a subsequent successful preview, even with identical params, until re-saved', async () => {
    stubFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const result = await renderAndRun(50, 20)
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.isSaved).toBe(true)

    act(() => {
      result.current.run('report.pdf', 50, 20)
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        extractionFailed: false,
        result: {
          chunks: [{ index: 0, content: 'hello' }],
          totalChunks: 1,
          strategy: 'fixed-size',
          chunkSize: 50,
          overlap: 20,
        },
      })
    })

    expect(result.current.isSaved).toBe(false)

    await act(async () => {
      await result.current.save()
    })
    expect(result.current.isSaved).toBe(true)
  })
})
