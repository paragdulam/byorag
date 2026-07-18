import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMetrics } from '../../src/hooks/useMetrics'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const CORPORA = [
  { corpusId: 'c1', name: 'Product Docs', chunkingStrategies: ['fixed-size'], hasPipelines: true },
  { corpusId: 'c2', name: 'Empty', chunkingStrategies: [], hasPipelines: false },
]

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
      if (url.includes('/api/metrics/corpora')) {
        return jsonResponse({ corpora: CORPORA })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

describe('useMetrics', () => {
  it('loads the corpora list on mount', async () => {
    stubFetch()

    const { result } = renderHook(() => useMetrics(null))

    expect(result.current.isLoadingCorpora).toBe(true)
    await waitFor(() => expect(result.current.isLoadingCorpora).toBe(false))
    expect(result.current.corpora).toEqual(CORPORA)
    expect(result.current.pipelines).toEqual([])
  })

  it('loads pipelines for the selected corpus', async () => {
    stubFetch()

    const { result } = renderHook(() => useMetrics('c1'))

    await waitFor(() => expect(result.current.isLoadingPipelines).toBe(false))
    expect(result.current.pipelines).toEqual(PIPELINES)
  })

  it('reports a corpora-fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))

    const { result } = renderHook(() => useMetrics(null))

    await waitFor(() => expect(result.current.isLoadingCorpora).toBe(false))
    expect(result.current.corporaError).toBeTruthy()
  })

  it('clears pipelines when no corpus is selected', async () => {
    stubFetch()

    const { result } = renderHook(() => useMetrics(null))

    await waitFor(() => expect(result.current.isLoadingCorpora).toBe(false))
    expect(result.current.pipelines).toEqual([])
    expect(result.current.isLoadingPipelines).toBe(false)
  })
})
