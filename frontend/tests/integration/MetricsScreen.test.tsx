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
      if (href.includes('/api/profile/anthropic-key')) {
        return jsonResponse({ hasKey: true, maskedKey: '...test' })
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
      return jsonResponse({ documents: [], rejections: [] })
    }),
  )
}

describe('MetricsScreen — every pipeline for the active corpus is visible at once (031-playground-metrics-redesign US2)', () => {
  it('shows both pipelines and their own metrics/no-scores state simultaneously, with no switcher', async () => {
    stubFetch()
    render(<App />)

    await userEvent.click(await screen.findByText('METRICS'))

    await waitFor(() => expect(screen.getByTestId('metrics-pipeline-fixed-size-bert')).toBeInTheDocument())
    const fixedSizePipeline = screen.getByTestId('metrics-pipeline-fixed-size-bert')
    expect(within(fixedSizePipeline).getByTestId('metrics-technique')).toHaveTextContent('fixed-size')
    expect(within(fixedSizePipeline).getByTestId('metrics-question-count')).toHaveTextContent('3')
    expect(within(fixedSizePipeline).getByTestId('metrics-retrieval-scores')).toBeInTheDocument()
    expect(within(fixedSizePipeline).getByTestId('metrics-generation-scores')).toBeInTheDocument()

    // The second pipeline is already visible too — no selector interaction needed.
    expect(screen.queryByTestId('pipeline-selector')).not.toBeInTheDocument()
    const semanticPipeline = screen.getByTestId('metrics-pipeline-semantic-bert')
    expect(semanticPipeline).toHaveTextContent('semantic')
    expect(within(semanticPipeline).getByTestId('metrics-no-scores')).toBeInTheDocument()
  })

  it('shows no in-screen corpus-picker control', async () => {
    stubFetch()
    render(<App />)

    await userEvent.click(await screen.findByText('METRICS'))

    await waitFor(() => expect(screen.getByTestId('metrics-pipeline-fixed-size-bert')).toBeInTheDocument())
    expect(screen.queryByTestId('metrics-corpus-list')).not.toBeInTheDocument()
  })
})
