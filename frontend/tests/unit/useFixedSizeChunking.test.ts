import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useFixedSizeChunking } from '../../src/hooks/useFixedSizeChunking'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function stubFetch(runResponseBody: unknown, runStatus = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      const href = url.toString()
      if (href.endsWith('/api/chunking/run')) {
        return jsonResponse(runResponseBody, runStatus)
      }
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
    }),
  )
}

describe('useFixedSizeChunking', () => {
  it('loads the document list on mount', async () => {
    stubFetch({ extractionFailed: false, result: null })

    const { result } = renderHook(() => useFixedSizeChunking())

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })
    expect(result.current.documents[0].name).toBe('report.pdf')
  })

  it('transitions to success with the returned result when a run succeeds', async () => {
    stubFetch({
      extractionFailed: false,
      result: {
        chunks: [{ index: 0, content: 'hello' }],
        totalChunks: 1,
        strategy: 'fixed-size',
        chunkSize: 50,
      },
    })

    const { result } = renderHook(() => useFixedSizeChunking())
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    expect(result.current.status).toBe('running')

    await waitFor(() => {
      expect(result.current.status).toBe('success')
    })
    expect(result.current.result?.chunks).toHaveLength(1)
  })

  it('transitions to extraction-failed when the backend reports extractionFailed', async () => {
    stubFetch({ extractionFailed: true, result: null })

    const { result } = renderHook(() => useFixedSizeChunking())
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    await waitFor(() => {
      expect(result.current.status).toBe('extraction-failed')
    })
    expect(result.current.result).toBeNull()
  })

  it('transitions to error when the run request itself fails', async () => {
    stubFetch({ detail: 'boom' }, 500)

    const { result } = renderHook(() => useFixedSizeChunking())
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    act(() => {
      result.current.run('report.pdf', 50)
    })

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })
  })
})
