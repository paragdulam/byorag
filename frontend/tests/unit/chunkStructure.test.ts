import { describe, expect, it } from 'vitest'
import { classifyBlocks, colorBlocks } from '../../src/lib/chunkStructure'
import type { PreviewSegment } from '../../src/lib/chunkingApi'
import { OVERLAP_COLOR, OVERLAP_TEXT_COLOR } from '../../src/lib/chunkColorPalette'

describe('classifyBlocks (022-chunk-preview-ui-fixes US2)', () => {
  it('classifies a standalone short line as a heading', () => {
    const text = 'Introduction\n\nThis is the first paragraph of the document.'

    const blocks = classifyBlocks(text)

    expect(blocks[0].kind).toBe('heading')
    expect(blocks[0].text).toBe('Introduction')
    expect(blocks.some((b) => b.kind === 'paragraph')).toBe(true)
  })

  it('groups consecutive bullet-prefixed lines into list-item blocks sharing one listGroupId', () => {
    const text = 'Shopping list:\n- apples\n- bananas\n- carrots\n\nEnd of list.'

    const blocks = classifyBlocks(text)
    const listItems = blocks.filter((b) => b.kind === 'list-item')

    expect(listItems).toHaveLength(3)
    expect(listItems[0].listGroupId).not.toBeNull()
    expect(listItems[0].listGroupId).toBe(listItems[1].listGroupId)
    expect(listItems[1].listGroupId).toBe(listItems[2].listGroupId)
  })

  it('merges consecutive non-blank, non-list lines into one paragraph block', () => {
    const text = 'This is line one of a paragraph\nand this is line two of the same paragraph.'

    const blocks = classifyBlocks(text)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('paragraph')
    expect(blocks[0].text).toBe(text)
  })

  it('produces blocks whose offsets are valid slices of the input text', () => {
    const text = 'Title\n\nParagraph one.\n\n- item a\n- item b\n\nParagraph two.'

    const blocks = classifyBlocks(text)

    for (const block of blocks) {
      expect(text.slice(block.startOffset, block.endOffset)).toBe(block.text)
    }
  })

  it('classifies numbered-list lines (e.g. "1.") as list items too', () => {
    const text = '1. first step\n2. second step'

    const blocks = classifyBlocks(text)

    expect(blocks.every((b) => b.kind === 'list-item')).toBe(true)
  })
})

describe('colorBlocks (022-chunk-preview-ui-fixes US2)', () => {
  it('splits a block spanning two chunk segments into two correctly colored spans at the exact boundary', () => {
    const text = 'aaaa bbbb'
    const blocks = classifyBlocks(text)
    const segments: PreviewSegment[] = [
      { start: 0, end: 4, kind: 'chunk', chunkIndex: 0 },
      { start: 4, end: 9, kind: 'chunk', chunkIndex: 1 },
    ]

    const spans = colorBlocks(blocks, segments)

    expect(spans[0]).toHaveLength(2)
    expect(spans[0][0].text).toBe('aaaa')
    expect(spans[0][1].text).toBe(' bbbb')
    expect(spans[0][0].backgroundColor).not.toBe(spans[0][1].backgroundColor)
  })

  it('renders an overlap segment with the reserved overlap color', () => {
    const text = 'aaaa'
    const blocks = classifyBlocks(text)
    const segments: PreviewSegment[] = [{ start: 0, end: 4, kind: 'overlap', chunkIndex: null }]

    const spans = colorBlocks(blocks, segments)

    expect(spans[0]).toHaveLength(1)
    expect(spans[0][0].backgroundColor).toBe(OVERLAP_COLOR)
    expect(spans[0][0].textColor).toBe(OVERLAP_TEXT_COLOR)
  })

  it('resolves the same chunkIndex to the same color across separate blocks', () => {
    const text = 'Title\n\nBody text here.'
    const blocks = classifyBlocks(text)
    const segments: PreviewSegment[] = [{ start: 0, end: text.length, kind: 'chunk', chunkIndex: 3 }]

    const spans = colorBlocks(blocks, segments)
    const allColors = spans.flat().map((s) => s.backgroundColor)

    expect(new Set(allColors).size).toBe(1)
  })
})
