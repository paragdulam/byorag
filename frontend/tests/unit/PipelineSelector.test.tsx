import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PipelineSelector } from '../../src/components/metrics/PipelineSelector'
import type { PipelineSummary } from '../../src/types/metrics'

function makePipeline(chunkingStrategy: string): PipelineSummary {
  return {
    chunkingStrategy,
    embeddingModel: 'bert',
    chunkCount: 10,
    questionCount: 0,
    answerCount: 0,
    scopeBreakdown: { corpus: 0, document: 0 },
    scores: null,
  }
}

describe('PipelineSelector', () => {
  it('renders nothing when the corpus has a single pipeline', () => {
    render(
      <PipelineSelector pipelines={[makePipeline('fixed-size')]} selectedIndex={0} onSelect={vi.fn()} />,
    )

    expect(screen.queryByTestId('pipeline-selector')).not.toBeInTheDocument()
  })

  it('renders nothing when the corpus has zero pipelines', () => {
    render(<PipelineSelector pipelines={[]} selectedIndex={0} onSelect={vi.fn()} />)

    expect(screen.queryByTestId('pipeline-selector')).not.toBeInTheDocument()
  })

  it('lists every technique and marks the selected one when there are two or more', () => {
    const pipelines = [makePipeline('fixed-size'), makePipeline('semantic')]
    render(<PipelineSelector pipelines={pipelines} selectedIndex={1} onSelect={vi.fn()} />)

    expect(screen.getByTestId('pipeline-selector')).toBeInTheDocument()
    expect(screen.getByTestId('pipeline-selector-option-0')).toHaveTextContent('fixed-size')
    expect(screen.getByTestId('pipeline-selector-option-1')).toHaveTextContent('semantic')
    expect(screen.getByTestId('pipeline-selector-option-0')).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('pipeline-selector-option-1')).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onSelect with the clicked pipeline index', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const pipelines = [makePipeline('fixed-size'), makePipeline('semantic')]
    render(<PipelineSelector pipelines={pipelines} selectedIndex={0} onSelect={onSelect} />)

    await user.click(screen.getByTestId('pipeline-selector-option-1'))

    expect(onSelect).toHaveBeenCalledWith(1)
  })
})
