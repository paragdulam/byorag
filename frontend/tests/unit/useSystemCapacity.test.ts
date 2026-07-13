import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSystemCapacity } from '../../src/hooks/useSystemCapacity'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('useSystemCapacity', () => {
  it('starts in loading state and transitions to ready on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          hardware: {
            processorName: 'Apple M2 Pro',
            cpuCores: 12,
            totalMemoryGb: 32.0,
            gpuDetected: false,
            gpuName: null,
            detectionFailed: false,
          },
          estimate: {
            maxPdfCount: 200,
            maxTotalSizeGb: 4.0,
            basis: 'cpu-only',
          },
        }),
      ),
    )

    const { result } = renderHook(() => useSystemCapacity())

    expect(result.current.status).toBe('loading')

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.hardware?.processorName).toBe('Apple M2 Pro')
    expect(result.current.estimate?.maxPdfCount).toBe(200)
  })

  it('transitions to fallback when the backend reports detectionFailed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          hardware: {
            processorName: null,
            cpuCores: null,
            totalMemoryGb: null,
            gpuDetected: false,
            gpuName: null,
            detectionFailed: true,
          },
          estimate: null,
        }),
      ),
    )

    const { result } = renderHook(() => useSystemCapacity())

    await waitFor(() => {
      expect(result.current.status).toBe('fallback')
    })

    expect(result.current.estimate).toBeNull()
  })

  it('transitions to fallback when the request itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 500)),
    )

    const { result } = renderHook(() => useSystemCapacity())

    await waitFor(() => {
      expect(result.current.status).toBe('fallback')
    })
  })
})
