import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ColoredBlockGroups } from '../../src/components/shared/ColoredBlockGroups'
import { classifyBlocks, colorBlocks } from '../../src/lib/chunkStructure'
import { OVERLAP_COLOR } from '../../src/lib/chunkColorPalette'
import type { PreviewSegment } from '../../src/lib/chunkingApi'

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${r}, ${g}, ${b})`
}

function renderFromSegments(fullText: string, segments: PreviewSegment[]) {
  const blocks = classifyBlocks(fullText)
  const spansByBlock = colorBlocks(blocks, segments)
  render(<ColoredBlockGroups blocks={blocks} spansByBlock={spansByBlock} />)
}

describe('ColoredBlockGroups (023-pdf-fullscreen-chunk-view Foundational)', () => {
  it('renders the document as one continuous flow, not separate per-chunk containers', () => {
    // Ends with a period so classifyBlocks treats this as a paragraph, not a heading.
    renderFromSegments('word1 word2.', [
      { start: 0, end: 6, kind: 'chunk', chunkIndex: 0 },
      { start: 6, end: 12, kind: 'chunk', chunkIndex: 1 },
    ])

    // No legacy per-chunk boxed cards.
    expect(screen.queryAllByTestId(/^chunk-block-/)).toHaveLength(0)
    // Both segments render as spans within the same flowing block, not separate containers.
    const paragraph = screen.getByTestId('chunked-preview-paragraph')
    expect(paragraph.querySelectorAll('span')).toHaveLength(2)
  })

  it('changes background color exactly at the chunk boundary, splitting mid-word text correctly', () => {
    // Ends with a period so classifyBlocks treats this as a paragraph, not a heading.
    renderFromSegments('word1 word2.', [
      { start: 0, end: 6, kind: 'chunk', chunkIndex: 0 },
      { start: 6, end: 12, kind: 'chunk', chunkIndex: 1 },
    ])

    const spans = screen.getByTestId('chunked-preview-paragraph').querySelectorAll('span')
    expect(spans[0].textContent).toBe('word1 ')
    expect(spans[1].textContent).toBe('word2.')
    expect((spans[0] as HTMLElement).style.backgroundColor).not.toBe(
      (spans[1] as HTMLElement).style.backgroundColor,
    )
  })

  it('renders a heading cue as a heading element and a list cue as list items', () => {
    const fullText = 'Title\n\n- item a\n- item b'
    renderFromSegments(fullText, [{ start: 0, end: fullText.length, kind: 'chunk', chunkIndex: 0 }])

    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()
    const listItems = screen.getAllByRole('listitem')
    expect(listItems).toHaveLength(2)
    expect(listItems[0]).toHaveTextContent('- item a')
    expect(listItems[1]).toHaveTextContent('- item b')
  })

  it('renders an overlap span with the reserved overlap color', () => {
    // Ends with a period so classifyBlocks treats this as a paragraph, not a heading.
    renderFromSegments('word1 word2.', [
      { start: 0, end: 6, kind: 'chunk', chunkIndex: 0 },
      { start: 6, end: 12, kind: 'overlap', chunkIndex: null },
    ])

    const spans = screen.getByTestId('chunked-preview-paragraph').querySelectorAll('span')
    expect((spans[1] as HTMLElement).style.backgroundColor).toBe(hexToRgb(OVERLAP_COLOR))
  })

  it('renders nothing when given an empty blocks array', () => {
    render(<ColoredBlockGroups blocks={[]} spansByBlock={[]} />)

    expect(screen.queryByTestId('chunked-preview-paragraph')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chunked-preview-heading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chunked-preview-list')).not.toBeInTheDocument()
  })
})
