import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMetrics } from '../../src/hooks/useMetrics'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const PIPELINES = [
  {
    chunkingStrategy: 'fixed-size',
    embeddingModel: 'bert',
    chunkCount: 10,
    questionCount: 2,
    answerCount: 2,
    scopeBreakdown: { corpus: 0, document: 2 },
    scores: {
      contextPrecision: 0.8,
      contextRecall: 0.7,
      responseRelevancy: 0.9,
      faithfulness: 0.85,
      sampleSize: 2,
    },
  },
]

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/metrics/corpora/c1/pipelines')) {
        return jsonResponse({ corpusId: 'c1', pipelines: PIPELINES })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

describe('useMetrics (031-playground-metrics-redesign US2 — no more corpus-list fetching)', () => {
  it('loads pipelines for the given corpus id', async () => {
    stubFetch()

    const { result } = renderHook(() => useMetrics('c1'))

    expect(result.current.isLoadingPipelines).toBe(true)
    await waitFor(() => expect(result.current.isLoadingPipelines).toBe(false))
    expect(result.current.pipelines).toEqual(PIPELINES)
  })

  it('reports a pipelines-fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))

    const { result } = renderHook(() => useMetrics('c1'))

    await waitFor(() => expect(result.current.isLoadingPipelines).toBe(false))
    expect(result.current.pipelinesError).toBeTruthy()
  })

  it('clears pipelines and makes no network request when no corpus is given', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const { result } = renderHook(() => useMetrics(null))

    expect(result.current.pipelines).toEqual([])
    expect(result.current.isLoadingPipelines).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does not expose a corpora list, loading flag, or error on its return shape', async () => {
    stubFetch()

    const { result } = renderHook(() => useMetrics('c1'))
    await waitFor(() => expect(result.current.isLoadingPipelines).toBe(false))

    expect(result.current).not.toHaveProperty('corpora')
    expect(result.current).not.toHaveProperty('isLoadingCorpora')
    expect(result.current).not.toHaveProperty('corporaError')
  })
})
