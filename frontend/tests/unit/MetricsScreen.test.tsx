import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MetricsScreen } from '../../src/components/metrics/MetricsScreen'
import { useMetrics } from '../../src/hooks/useMetrics'
import type { UseMetrics } from '../../src/hooks/useMetrics'
import * as metricsApi from '../../src/lib/metricsApi'
import type { CorpusSummary, PipelineSummary } from '../../src/types/metrics'
import { CorpusProvider } from '../../src/context/CorpusContext'

vi.mock('../../src/hooks/useMetrics')

function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

const mockedUseMetrics = vi.mocked(useMetrics)

function makeCorpus(overrides: Partial<CorpusSummary> = {}): CorpusSummary {
  return {
    corpusId: 'c1',
    name: 'Product Docs',
    chunkingStrategies: ['fixed-size'],
    hasPipelines: true,
    ...overrides,
  }
}

function makePipeline(overrides: Partial<PipelineSummary> = {}): PipelineSummary {
  return {
    chunkingStrategy: 'fixed-size',
    embeddingModel: 'bert',
    retrievalStrategy: 'cosine-similarity',
    chunkCount: 12,
    questionCount: 3,
    answerCount: 2,
    scopeBreakdown: { corpus: 0, document: 3 },
    generationLlm: 'claude-sonnet-5',
    judgeLlm: 'claude-sonnet-5',
    scores: {
      contextPrecision: 0.8123,
      contextRecall: 0.7,
      responseRelevancy: 0.91,
      faithfulness: 0.6,
      sampleSize: 2,
    },
    ...overrides,
  }
}

function mockState(overrides: Partial<UseMetrics> = {}): UseMetrics {
  return {
    corpora: [makeCorpus()],
    isLoadingCorpora: false,
    corporaError: null,
    pipelines: [makePipeline()],
    isLoadingPipelines: false,
    pipelinesError: null,
    ...overrides,
  }
}

describe('MetricsScreen', () => {
  it('renders technique, embedding model, counts, and all four scores', () => {
    mockedUseMetrics.mockReturnValue(mockState())

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByTestId('metrics-technique')).toHaveTextContent('fixed-size')
    expect(screen.getByTestId('metrics-embedding-model')).toHaveTextContent('bert')
    expect(screen.getByTestId('metrics-question-count')).toHaveTextContent('3')
    expect(screen.getByTestId('metrics-answer-count')).toHaveTextContent('2')
    const retrievalScores = screen.getByTestId('metrics-retrieval-scores')
    expect(retrievalScores).toHaveTextContent('0.81')
    expect(retrievalScores).toHaveTextContent('0.70')
    const generationScores = screen.getByTestId('metrics-generation-scores')
    expect(generationScores).toHaveTextContent('0.91')
    expect(generationScores).toHaveTextContent('0.60')
  })

  it('shows a not-enough-data message when there are no scores yet (FR-013)', () => {
    mockedUseMetrics.mockReturnValue(
      mockState({ pipelines: [makePipeline({ questionCount: 0, answerCount: 0, scores: null })] }),
    )

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByTestId('metrics-no-scores')).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-retrieval-scores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-generation-scores')).not.toBeInTheDocument()
    expect(screen.getByTestId('metrics-question-count')).toHaveTextContent('0')
  })

  it('shows a no-pipeline message for a corpus with no saved chunks (FR-014)', () => {
    mockedUseMetrics.mockReturnValue(
      mockState({
        corpora: [makeCorpus({ chunkingStrategies: [], hasPipelines: false })],
        pipelines: [],
      }),
    )

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByTestId('metrics-no-pipeline')).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-technique')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-embedding-model')).not.toBeInTheDocument()
  })

  it('shows an empty-corpora message when there are no corpora at all', () => {
    mockedUseMetrics.mockReturnValue(mockState({ corpora: [] }))

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByText(/no corpora yet/i)).toBeInTheDocument()
  })

  it('shows a loading state while corpora are loading', () => {
    mockedUseMetrics.mockReturnValue(mockState({ isLoadingCorpora: true, corpora: [] }))

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByText(/loading corpora/i)).toBeInTheDocument()
  })

  it('hides the Compare action when the corpus has only one pipeline', () => {
    mockedUseMetrics.mockReturnValue(mockState())

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.queryByTestId('metrics-compare-button')).not.toBeInTheDocument()
  })

  it('opens the comparison modal with every pipeline when Compare is clicked', async () => {
    const secondPipeline = makePipeline({ chunkingStrategy: 'semantic', scores: null })
    vi.spyOn(metricsApi, 'fetchComparison').mockResolvedValue({
      corpusId: 'c1',
      pipelines: [makePipeline(), secondPipeline],
    })
    mockedUseMetrics.mockReturnValue(mockState({ pipelines: [makePipeline(), secondPipeline] }))

    render(<MetricsScreen onNavigate={() => {}} />)
    await userEvent.click(screen.getByTestId('metrics-compare-button'))

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByTestId('comparison-row-fixed-size')).toBeInTheDocument()
    expect(screen.getByTestId('comparison-row-semantic')).toBeInTheDocument()
  })
})
