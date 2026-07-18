import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScoreSummary } from '../../src/components/metrics/ScoreSummary'
import type { PipelineSummary } from '../../src/types/metrics'

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

describe('ScoreSummary (020-metrics-stage-groups)', () => {
  it('groups chunking technique, embedding model, retrieval strategy, Context Precision and Context Recall under Retrieval', () => {
    render(<ScoreSummary pipeline={makePipeline()} />)

    const retrieval = screen.getByTestId('metrics-retrieval-section')
    expect(within(retrieval).getByText('Retrieval')).toBeInTheDocument()
    expect(within(retrieval).getByTestId('metrics-technique')).toHaveTextContent('fixed-size')
    expect(within(retrieval).getByTestId('metrics-embedding-model')).toHaveTextContent('bert')
    expect(within(retrieval).getByTestId('metrics-retrieval-strategy')).toHaveTextContent('cosine-similarity')
    expect(within(retrieval).getByTestId('metrics-retrieval-scores')).toHaveTextContent('0.81')
    expect(within(retrieval).getByTestId('metrics-retrieval-scores')).toHaveTextContent('0.70')
  })

  it('groups generation LLM, Response Relevancy and Faithfulness under Generation', () => {
    render(<ScoreSummary pipeline={makePipeline()} />)

    const generation = screen.getByTestId('metrics-generation-section')
    expect(within(generation).getByText('Generation')).toBeInTheDocument()
    expect(within(generation).getByTestId('metrics-generation-llm')).toHaveTextContent('claude-sonnet-5')
    expect(within(generation).getByTestId('metrics-generation-scores')).toHaveTextContent('0.91')
    expect(within(generation).getByTestId('metrics-generation-scores')).toHaveTextContent('0.60')
  })

  it('shows the judge LLM name once, not duplicated in either section', () => {
    render(<ScoreSummary pipeline={makePipeline({ judgeLlm: 'claude-opus-4-8' })} />)

    expect(screen.getAllByText('claude-opus-4-8')).toHaveLength(1)
    expect(screen.getByTestId('metrics-judge-llm')).toHaveTextContent('claude-opus-4-8')
  })

  it('shows "Not available yet" for generation LLM and judge LLM when null, while the retrieval strategy still renders', () => {
    render(
      <ScoreSummary
        pipeline={makePipeline({
          questionCount: 0, answerCount: 0, generationLlm: null, judgeLlm: null, scores: null,
        })}
      />,
    )

    expect(screen.getByTestId('metrics-generation-llm')).toHaveTextContent('Not available yet')
    expect(screen.getByTestId('metrics-judge-llm')).toHaveTextContent('Not available yet')
    expect(screen.getByTestId('metrics-retrieval-strategy')).toHaveTextContent('cosine-similarity')
  })

  it('shows a single not-enough-data message and no score values when scores are null', () => {
    render(<ScoreSummary pipeline={makePipeline({ scores: null })} />)

    expect(screen.getByTestId('metrics-no-scores')).toBeInTheDocument()
    expect(screen.queryByTestId('metrics-retrieval-scores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('metrics-generation-scores')).not.toBeInTheDocument()
  })
})
