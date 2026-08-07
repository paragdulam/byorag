import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaygroundTurnDetail } from '../../src/components/playground/PlaygroundTurnDetail'
import type { Turn } from '../../src/types/playground'

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 'turn-1',
    scope: 'document',
    documentId: 'doc-1',
    corpusId: null,
    question: 'What is this about?',
    queryEmbedding: Array.from({ length: 20 }, (_, i) => i / 20),
    chunks: [
      { chunkId: 'chunk-1', documentId: 'doc-1', index: 0, content: 'First chunk content.', score: 0.9 },
      { chunkId: 'chunk-2', documentId: 'doc-1', index: 1, content: 'Second chunk content.', score: 0.8 },
    ],
    llmProvider: null,
    llmModel: null,
    prompt: null,
    answer: null,
    error: null,
    createdAt: '2026-08-05T00:00:00Z',
    answeredAt: null,
    ...overrides,
  }
}

describe('PlaygroundTurnDetail (031-playground-metrics-redesign US1)', () => {
  it('renders question, then query embedding, then chunks, then the answer, in that order', () => {
    const turn = makeTurn({ answer: 'The final answer.' })
    const { container } = render(
      <PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />,
    )

    const text = container.textContent ?? ''
    const questionIndex = text.indexOf('What is this about?')
    const embeddingIndex = text.indexOf('Query embedding')
    const chunkIndex = text.indexOf('CHUNK_0')
    const answerIndex = text.indexOf('The final answer.')

    expect(questionIndex).toBeGreaterThanOrEqual(0)
    expect(embeddingIndex).toBeGreaterThan(questionIndex)
    expect(chunkIndex).toBeGreaterThan(embeddingIndex)
    expect(answerIndex).toBeGreaterThan(chunkIndex)
  })

  it('collapses the query embedding by default with a working show more/show less', async () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    const preview = screen.getByTestId('playground-embedding-preview')
    const toggle = screen.getByRole('button', { name: /show more embedding values/i })
    expect(preview.children).toHaveLength(16)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(toggle)
    expect(preview.children).toHaveLength(20)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(toggle)
    expect(preview.children).toHaveLength(16)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('collapses each retrieved chunk by default with its own show more/show less', async () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    expect(screen.queryByText('First chunk content.')).not.toBeInTheDocument()
    expect(screen.queryByText('Second chunk content.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show more for chunk 0/i }))
    expect(screen.getByText('First chunk content.')).toBeInTheDocument()
    expect(screen.queryByText('Second chunk content.')).not.toBeInTheDocument()
  })

  it('shows a generating state and no answer while isGenerating is true', () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={true} isGenerating={true} onRetry={vi.fn()} />)

    expect(screen.getByTestId('turn-turn-1-generating')).toBeInTheDocument()
    expect(screen.queryByText(/answer to/i)).not.toBeInTheDocument()
  })

  it('shows the failure message and a retry control that calls onRetry when generation failed', async () => {
    const onRetry = vi.fn()
    const turn = makeTurn({ error: 'Failed to generate an answer. Please try again.' })
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/failed to generate/i)
    await userEvent.click(screen.getByRole('button', { name: /retry generating/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders no button labeled "Generate" anywhere', () => {
    const turn = makeTurn({ answer: 'The final answer.' })
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^generate$/i })).not.toBeInTheDocument()
  })
})
