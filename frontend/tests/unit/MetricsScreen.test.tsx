import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MetricsScreen } from '../../src/components/metrics/MetricsScreen'
import { useMetrics } from '../../src/hooks/useMetrics'
import type { UseMetrics } from '../../src/hooks/useMetrics'
import * as metricsApi from '../../src/lib/metricsApi'
import type { PipelineSummary } from '../../src/types/metrics'
import { useCorpus } from '../../src/context/CorpusContext'
import type { CorpusContextValue } from '../../src/context/CorpusContext'

// AppShell -> SidebarNav reads Anthropic-key status from AuthContext
// (025-user-profile-anthropic-key) -- mocked here since this suite predates it and isn't
// exercising that gating.
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { id: 'user-1', email: 'person@example.com', createdAt: '2026-07-14T00:00:00Z' },
    hasAnthropicKey: true,
    isLoading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshAnthropicKeyStatus: vi.fn(),
  }),
}))

vi.mock('../../src/hooks/useMetrics')
vi.mock('../../src/context/CorpusContext')

const mockedUseMetrics = vi.mocked(useMetrics)
const mockedUseCorpus = vi.mocked(useCorpus)

function mockCorpus(overrides: Partial<CorpusContextValue> = {}): void {
  mockedUseCorpus.mockReturnValue({
    corpora: [{ id: 'c1', name: 'Product Docs', createdAt: '2026-07-14T00:00:00Z' }],
    activeCorpusId: 'c1',
    isLoading: false,
    error: null,
    selectCorpus: vi.fn(),
    createCorpus: vi.fn(),
    renameCorpus: vi.fn(),
    deleteCorpus: vi.fn(),
    ...overrides,
  })
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
  const state: UseMetrics = {
    pipelines: [makePipeline()],
    isLoadingPipelines: false,
    pipelinesError: null,
    ...overrides,
  }
  mockedUseMetrics.mockReturnValue(state)
  return state
}

describe('MetricsScreen — reflects the app-wide active corpus, no in-screen picker (031-playground-metrics-redesign US2)', () => {
  it('shows a "select or create a corpus" prompt when no corpus is active, matching every other screen', () => {
    mockCorpus({ activeCorpusId: null })
    mockState()

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByText(/select or create a corpus/i)).toBeInTheDocument()
  })

  it('renders no corpus-picker control anywhere on the screen', () => {
    mockCorpus()
    mockState()

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.queryByTestId('metrics-corpus-list')).not.toBeInTheDocument()
  })

  it('renders technique, embedding model, counts, and all four scores for the active corpus\'s pipeline', () => {
    mockCorpus()
    mockState()

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
    mockCorpus()
    mockState({ pipelines: [makePipeline({ questionCount: 0, answerCount: 0, scores: null })] })

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByTestId('metrics-no-scores')).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-retrieval-scores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-generation-scores')).not.toBeInTheDocument()
    expect(screen.getByTestId('metrics-question-count')).toHaveTextContent('0')
  })

  it('shows a no-pipeline message for a corpus with no established pipeline yet (FR-012)', () => {
    mockCorpus()
    mockState({ pipelines: [] })

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByTestId('metrics-no-pipeline')).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-technique')).not.toBeInTheDocument()
  })

  it('shows a loading state while pipelines are loading', () => {
    mockCorpus()
    mockState({ isLoadingPipelines: true, pipelines: [] })

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.getByText(/loading pipeline/i)).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-no-pipeline')).not.toBeInTheDocument()
  })

  it('lists every pipeline for the active corpus simultaneously, each with its own four metrics, with zero clicks (FR-010/FR-011)', () => {
    mockCorpus()
    const secondPipeline = makePipeline({
      chunkingStrategy: 'semantic',
      questionCount: 0,
      answerCount: 0,
      scores: null,
    })
    mockState({ pipelines: [makePipeline(), secondPipeline] })

    render(<MetricsScreen onNavigate={() => {}} />)

    const first = screen.getByTestId('metrics-pipeline-fixed-size-bert')
    expect(within(first).getByTestId('metrics-technique')).toHaveTextContent('fixed-size')
    expect(within(first).getByTestId('metrics-retrieval-scores')).toBeInTheDocument()

    const second = screen.getByTestId('metrics-pipeline-semantic-bert')
    expect(within(second).getByTestId('metrics-technique')).toHaveTextContent('semantic')
    expect(within(second).getByTestId('metrics-no-scores')).toBeInTheDocument()

    // No switcher of any kind — no more single-pipeline selection UI.
    expect(screen.queryByTestId('pipeline-selector')).not.toBeInTheDocument()
  })
})

describe('MetricsScreen — Compare stays as a secondary action alongside the list (FR-015)', () => {
  it('hides the Compare action when the corpus has only one pipeline', () => {
    mockCorpus()
    mockState()

    render(<MetricsScreen onNavigate={() => {}} />)

    expect(screen.queryByTestId('metrics-compare-button')).not.toBeInTheDocument()
  })

  it('opens the comparison modal with every pipeline when Compare is clicked', async () => {
    mockCorpus()
    const secondPipeline = makePipeline({ chunkingStrategy: 'semantic', scores: null })
    vi.spyOn(metricsApi, 'fetchComparison').mockResolvedValue({
      corpusId: 'c1',
      pipelines: [makePipeline(), secondPipeline],
    })
    mockState({ pipelines: [makePipeline(), secondPipeline] })

    render(<MetricsScreen onNavigate={() => {}} />)
    await userEvent.click(screen.getByTestId('metrics-compare-button'))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('comparison-row-fixed-size')).toBeInTheDocument()
    expect(screen.getByTestId('comparison-row-semantic')).toBeInTheDocument()
  })
})
