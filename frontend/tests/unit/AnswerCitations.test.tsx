import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AnswerCitations } from '../../src/components/playground/AnswerCitations'
import type { TurnChunk } from '../../src/types/playground'

function makeChunk(overrides: Partial<TurnChunk> = {}): TurnChunk {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    index: 0,
    content: 'chunk content',
    score: 0.9,
    ...overrides,
  }
}

describe('AnswerCitations', () => {
  it('renders an info icon for a [1] marker resolving to turn.chunks[0]', async () => {
    const chunk = makeChunk({ chunkId: 'chunk-1' })
    const onCiteClick = vi.fn()

    render(
      <AnswerCitations answer="The notice period is thirty days [1]." chunks={[chunk]} onCiteClick={onCiteClick} />,
    )

    const icon = screen.getByRole('button')
    await userEvent.click(icon)

    expect(onCiteClick).toHaveBeenCalledWith(chunk)
    expect(screen.getByText(/The notice period is thirty days/)).toBeInTheDocument()
  })

  it('strips an out-of-range marker and renders no icon for it', () => {
    const { container } = render(
      <AnswerCitations
        answer="This claim cites a chunk that does not exist [9]."
        chunks={[makeChunk(), makeChunk({ chunkId: 'chunk-2' })]}
        onCiteClick={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.textContent).toBe('This claim cites a chunk that does not exist.')
  })

  it('passes text with no markers through unchanged', () => {
    render(<AnswerCitations answer="Plain answer with no citations." chunks={[]} onCiteClick={vi.fn()} />)

    expect(screen.getByText('Plain answer with no citations.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders multiple resolvable citations, each opening its own chunk', async () => {
    const first = makeChunk({ chunkId: 'chunk-1' })
    const second = makeChunk({ chunkId: 'chunk-2' })
    const onCiteClick = vi.fn()

    render(
      <AnswerCitations
        answer="First claim [1]. Second claim [2]."
        chunks={[first, second]}
        onCiteClick={onCiteClick}
      />,
    )

    const icons = screen.getAllByRole('button')
    expect(icons).toHaveLength(2)
    await userEvent.click(icons[1])

    expect(onCiteClick).toHaveBeenCalledWith(second)
  })
})
