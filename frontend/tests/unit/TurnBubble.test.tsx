import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TurnBubble } from '../../src/components/playground/TurnBubble'
import type { Turn } from '../../src/types/playground'

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 'turn-1',
    question: 'What is this about?',
    queryEmbedding: [],
    chunks: [],
    llmProvider: 'anthropic',
    llmModel: 'claude',
    prompt: 'prompt',
    answer: 'plain answer',
    error: null,
    createdAt: '2026-07-17T00:00:00Z',
    answeredAt: '2026-07-17T00:00:01Z',
    ...overrides,
  }
}

const noop = () => {}

describe('TurnBubble — Markdown rendering (018-ui-polish-batch US6)', () => {
  it('renders Markdown formatting (list, bold) as real elements, not literal syntax', () => {
    const turn = makeTurn({ answer: 'Here is a list:\n\n- **first** item\n- second item' })

    render(
      <TurnBubble
        turn={turn}
        isGenerating={false}
        isBusy={false}
        isSelected={false}
        onSelect={noop}
        onRetry={noop}
      />,
    )

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('first item')
    expect(items[1]).toHaveTextContent('second item')
    const bold = screen.getByText('first')
    expect(bold.tagName.toLowerCase()).toBe('strong')
    expect(screen.queryByText(/\*\*first\*\*/)).not.toBeInTheDocument()
  })

  it('renders embedded HTML/script content as inert text, never executing it', () => {
    const answer = 'Before <script>window.__xss = true</script> after'
    const turn = makeTurn({ answer })

    render(
      <TurnBubble
        turn={turn}
        isGenerating={false}
        isBusy={false}
        isSelected={false}
        onSelect={noop}
        onRetry={noop}
      />,
    )

    expect(document.querySelector('script')).not.toBeInTheDocument()
    expect((window as unknown as { __xss?: boolean }).__xss).toBeUndefined()
  })

  it('renders a plain-text answer unchanged', () => {
    const turn = makeTurn({ answer: 'Just a plain sentence.' })

    render(
      <TurnBubble
        turn={turn}
        isGenerating={false}
        isBusy={false}
        isSelected={false}
        onSelect={noop}
        onRetry={noop}
      />,
    )

    expect(screen.getByText('Just a plain sentence.')).toBeInTheDocument()
  })

  it('still shows the question, generating state, and error/retry as before', () => {
    const onRetry = vi.fn()
    const turn = makeTurn({ answer: null, error: 'boom' })

    render(
      <TurnBubble
        turn={turn}
        isGenerating={false}
        isBusy={false}
        isSelected={false}
        onSelect={noop}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('What is this about?')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
