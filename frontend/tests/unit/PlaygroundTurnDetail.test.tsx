import { render, screen, within } from '@testing-library/react'
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

async function openActionsMenu(question: string) {
  const userEventLib = (await import('@testing-library/user-event')).default
  await userEventLib.click(screen.getByRole('button', { name: new RegExp(`actions for ${question}`, 'i') }))
}

describe('PlaygroundTurnDetail (031-playground-metrics-redesign US1)', () => {
  it('renders the question before the answer', () => {
    const turn = makeTurn({ answer: 'The final answer.' })
    const { container } = render(
      <PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />,
    )

    const text = container.textContent ?? ''
    const questionIndex = text.indexOf('What is this about?')
    const answerIndex = text.indexOf('The final answer.')

    expect(questionIndex).toBeGreaterThanOrEqual(0)
    expect(answerIndex).toBeGreaterThan(questionIndex)
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

describe('PlaygroundTurnDetail — Actions popover (033-ui-ux-polish US6)', () => {
  it('replaces the standalone Copy Link button with a single icon Actions control', () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /^copy link$/i })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /actions for what is this about\?/i }),
    ).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('opens a role="menu" popover with Copy Link, Query Embedding, and Retrieved Chunks options', async () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    await openActionsMenu('What is this about\\?')

    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /query embedding/i })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: /retrieved chunks/i })).toBeInTheDocument()
  })

  it('closes the popover when clicking outside it', async () => {
    const turn = makeTurn()
    render(
      <div>
        <PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />
        <button type="button">outside</button>
      </div>,
    )

    await openActionsMenu('What is this about\\?')
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'outside' }))

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('"Copy Link" copies the same turn link as before', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const turn = makeTurn({ id: 'turn-9', question: 'What is the refund policy?' })
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    await openActionsMenu('What is the refund policy\\?')
    await userEvent.click(screen.getByRole('menuitem', { name: /copy link/i }))

    expect(writeText.mock.calls[0][0]).toMatch(/\/playground\/corpus-1\/turn-9$/)
  })

  it('"Query Embedding" reveals only the query embedding, hidden before it is chosen', async () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    expect(screen.queryByText('Query embedding')).not.toBeInTheDocument()

    await openActionsMenu('What is this about\\?')
    await userEvent.click(screen.getByRole('menuitem', { name: /query embedding/i }))

    expect(screen.getByText('Query embedding')).toBeInTheDocument()
    expect(screen.queryByTestId('playground-retrieved-chunks')).not.toBeInTheDocument()
  })

  it('"Retrieved Chunks" reveals the chunk list with cosine similarity, independently of Query Embedding', async () => {
    const turn = makeTurn()
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    expect(screen.queryByTestId('playground-retrieved-chunks')).not.toBeInTheDocument()

    await openActionsMenu('What is this about\\?')
    await userEvent.click(screen.getByRole('menuitem', { name: /retrieved chunks/i }))

    expect(screen.queryByText('Query embedding')).not.toBeInTheDocument()
    const chunkList = screen.getByTestId('playground-retrieved-chunks')
    expect(chunkList).toHaveTextContent('First chunk content.')
    expect(chunkList).toHaveTextContent('0.900')
    expect(chunkList).toHaveTextContent('Second chunk content.')
    expect(chunkList).toHaveTextContent('0.800')
  })
})

describe('PlaygroundTurnDetail — in-answer citations (033-ui-ux-polish US6)', () => {
  it('opens a modal showing the cited chunk and its cosine similarity when its info icon is clicked', async () => {
    const turn = makeTurn({ answer: 'The notice period is thirty days [1].' })
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /view source for citation 1/i }))

    const modal = screen.getByRole('dialog')
    expect(modal).toHaveTextContent('First chunk content.')
    expect(modal).toHaveTextContent('0.900')
  })

  it('"Go To Chunk" links to the deep link for the cited chunk\'s document/index', async () => {
    const turn = makeTurn({ answer: 'The notice period is thirty days [1].' })
    render(<PlaygroundTurnDetail turn={turn} corpusId="corpus-1" isBusy={false} isGenerating={false} onRetry={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /view source for citation 1/i }))

    expect(screen.getByRole('link', { name: /go to chunk/i })).toHaveAttribute(
      'href',
      '/fixed-size-chunking/corpus-1/doc-1/0',
    )
  })

  it('a close control dismisses the modal without navigating', async () => {
    const onGoToChunk = vi.fn()
    const turn = makeTurn({ answer: 'The notice period is thirty days [1].' })
    render(
      <PlaygroundTurnDetail
        turn={turn}
        corpusId="corpus-1"
        isBusy={false}
        isGenerating={false}
        onRetry={vi.fn()}
        onGoToChunk={onGoToChunk}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /view source for citation 1/i }))

    await userEvent.click(screen.getByRole('button', { name: /^close$/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onGoToChunk).not.toHaveBeenCalled()
  })
})
