import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const PIPELINES = [
  {
    chunkingStrategy: 'fixed-size',
    embeddingModel: 'bert',
    retrievalStrategy: 'cosine-similarity',
    chunkCount: 12,
    questionCount: 3,
    answerCount: 3,
    scopeBreakdown: { corpus: 0, document: 3 },
    generationLlm: 'claude-sonnet-5',
    judgeLlm: 'claude-sonnet-5',
    scores: {
      contextPrecision: 0.8,
      contextRecall: 0.7,
      responseRelevancy: 0.9,
      faithfulness: 0.6,
      sampleSize: 3,
    },
  },
  {
    chunkingStrategy: 'semantic',
    embeddingModel: 'bert',
    retrievalStrategy: 'cosine-similarity',
    chunkCount: 5,
    questionCount: 0,
    answerCount: 0,
    scopeBreakdown: { corpus: 0, document: 0 },
    generationLlm: null,
    judgeLlm: null,
    scores: null,
  },
]

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL) => {
      const href = url.toString()

      if (href.endsWith('/api/corpora')) {
        return jsonResponse({
          corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
        })
      }
      if (href.includes('/api/system/capacity')) {
        return jsonResponse({
          hardware: {
            processorName: 'Test Processor',
            cpuCores: 8,
            totalMemoryGb: 16.0,
            gpuDetected: false,
            gpuName: null,
            detectionFailed: false,
          },
          estimate: null,
        })
      }
      if (href.includes('/api/metrics/corpora/corpus-a/pipelines')) {
        return jsonResponse({ corpusId: 'corpus-a', pipelines: PIPELINES })
      }
      if (href.endsWith('/api/metrics/corpora')) {
        return jsonResponse({
          corpora: [
            {
              corpusId: 'corpus-a',
              name: 'Corpus A',
              chunkingStrategies: ['fixed-size', 'semantic'],
              hasPipelines: true,
            },
          ],
        })
      }
      return jsonResponse({ documents: [], rejections: [] })
    }),
  )
}

describe('MetricsScreen technique switching (019-metrics-dashboard US2)', () => {
  it('switching the technique selector updates the displayed embedding model, counts, and scores', async () => {
    stubFetch()
    render(<App />)

    await userEvent.click(screen.getByText('METRICS'))

    await waitFor(() => expect(screen.getByTestId('metrics-technique')).toHaveTextContent('fixed-size'))
    expect(screen.getByTestId('metrics-question-count')).toHaveTextContent('3')
    expect(screen.getByTestId('metrics-retrieval-scores')).toBeInTheDocument()
    expect(screen.getByTestId('metrics-generation-scores')).toBeInTheDocument()

    const selector = screen.getByTestId('pipeline-selector')
    await userEvent.click(within(selector).getByText('semantic'))

    await waitFor(() => expect(screen.getByTestId('metrics-technique')).toHaveTextContent('semantic'))
    expect(screen.getByTestId('metrics-question-count')).toHaveTextContent('0')
    expect(screen.getByTestId('metrics-no-scores')).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-retrieval-scores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-generation-scores')).not.toBeInTheDocument()
  })
})
