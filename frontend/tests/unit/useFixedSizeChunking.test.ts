import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function stubListSourcesFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      jsonResponse({
        documents: [
          {
            id: 'report.pdf',
            name: 'report.pdf',
            sizeBytes: 1024,
            uploadedAt: '2026-07-13T10:00:00Z',
            status: 'processed',
          },
        ],
      }),
    ),
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

describe('useFixedSizeChunking', () => {
  it('loads the document list on mount', async () => {
    stubListSourcesFetch()
    vi.stubGlobal('EventSource', MockEventSource)

    const { result } = renderHook(() => useFixedSizeChunking())

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })
    expect(result.current.documents[0].name).toBe('report.pdf')
  })

  it('updates progressPercent as progress events arrive, then transitions to success', async () => {
    stubListSourcesFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking())
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
        },
      })
    })

    expect(result.current.status).toBe('success')
    expect(result.current.result?.chunks).toHaveLength(1)
    expect(result.current.hasSucceededOnce).toBe(true)
  })

  it('transitions to extraction-failed when the backend reports extractionFailed', async () => {
    stubListSourcesFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking())
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    act(() => {
      MockEventSource.latest().emit('result', { extractionFailed: true, result: null })
    })

    expect(result.current.status).toBe('extraction-failed')
    expect(result.current.result).toBeNull()
    expect(result.current.hasSucceededOnce).toBe(false)
  })

  it('transitions to error when the stream reports an error', async () => {
    stubListSourcesFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking())
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    act(() => {
      MockEventSource.latest().emit('error')
    })

    expect(result.current.status).toBe('error')
  })

  it('keeps hasSucceededOnce true even if a later run fails (one-way latch)', async () => {
    stubListSourcesFetch()
    vi.stubGlobal('EventSource', MockEventSource)
    MockEventSource.instances = []

    const { result } = renderHook(() => useFixedSizeChunking())
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })
    act(() => {
      MockEventSource.latest().emit('result', {
        extractionFailed: false,
        result: { chunks: [], totalChunks: 0, strategy: 'fixed-size', chunkSize: 50 },
      })
    })
    expect(result.current.hasSucceededOnce).toBe(true)

    act(() => {
      result.current.run('report.pdf', 50)
    })
    act(() => {
      MockEventSource.latest().emit('error')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.hasSucceededOnce).toBe(true)
  })
})
