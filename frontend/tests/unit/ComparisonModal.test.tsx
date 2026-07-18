import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ComparisonModal } from '../../src/components/metrics/ComparisonModal'
import type { PipelineSummary } from '../../src/types/metrics'

const PIPELINES: PipelineSummary[] = [
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

describe('ComparisonModal', () => {
  it('renders one row per pipeline with its own figures', () => {
    render(<ComparisonModal pipelines={PIPELINES} onClose={vi.fn()} />)

    const fixedRow = screen.getByTestId('comparison-row-fixed-size')
    expect(fixedRow).toHaveTextContent('fixed-size')
    expect(fixedRow).toHaveTextContent('bert')
    expect(fixedRow).toHaveTextContent('cosine-similarity')
    expect(fixedRow).toHaveTextContent('12')
    expect(fixedRow).toHaveTextContent('0.80')
    expect(fixedRow).toHaveTextContent('claude-sonnet-5')

    const semanticRow = screen.getByTestId('comparison-row-semantic')
    expect(semanticRow).toHaveTextContent('semantic')
    expect(semanticRow).toHaveTextContent('5')
    expect(semanticRow).toHaveTextContent('—')
  })

  it('shows each pipeline its own Retrieval Strategy, Generation LLM, and Judge LLM columns', () => {
    render(<ComparisonModal pipelines={PIPELINES} onClose={vi.fn()} />)

    const fixedRow = screen.getByTestId('comparison-row-fixed-size')
    expect(fixedRow).toHaveTextContent('cosine-similarity')
    expect(fixedRow).toHaveTextContent('claude-sonnet-5')

    const semanticRow = screen.getByTestId('comparison-row-semantic')
    expect(semanticRow).toHaveTextContent('cosine-similarity')
    // generationLlm/judgeLlm null -> rendered as the same "—" placeholder as a missing score
    const cells = semanticRow.querySelectorAll('td')
    expect(Array.from(cells).some((cell) => cell.textContent === '—')).toBe(true)
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<ComparisonModal pipelines={PIPELINES} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /close comparison/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the backdrop is clicked but not when the dialog content is clicked', async () => {
    const onClose = vi.fn()
    render(<ComparisonModal pipelines={PIPELINES} onClose={onClose} />)

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('comparison-modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })
})
