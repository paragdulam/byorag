import { describe, expect, it } from 'vitest'
import { computeChunkContextView } from '../../src/lib/chunkContextView'
import type { ChunkRange, PagePosition, PreviewSegment, StructuredPreview } from '../../src/lib/chunkingApi'

// fullText layout (36 chars): "word0 " [0,6) "word1 " [6,12) "word2 " [12,18) "word3 " [18,24)
// "word4 " [24,30) "word5." [30,36)
const FULL_TEXT = 'word0 word1 word2 word3 word4 word5.'.slice(0, 36)

const PAGES: PagePosition[] = [
  { pageNumber: 1, start: 0, end: 18 },
  { pageNumber: 2, start: 18, end: 36 },
]

// chunk0 = word0 only (page 1); chunk1 spans word1..word3, crossing the page boundary at 18;
// chunk2 = word4+word5 only (page 2).
const CHUNK_RANGES: ChunkRange[] = [
  { chunkIndex: 0, start: 0, end: 6 },
  { chunkIndex: 1, start: 6, end: 24 },
  { chunkIndex: 2, start: 24, end: 36 },
]

const SEGMENTS: PreviewSegment[] = [
  { start: 0, end: 6, kind: 'chunk', chunkIndex: 0 },
  { start: 6, end: 24, kind: 'chunk', chunkIndex: 1 },
  { start: 24, end: 36, kind: 'chunk', chunkIndex: 2 },
]

function makePreview(overrides: Partial<StructuredPreview> = {}): StructuredPreview {
  return {
    fullText: FULL_TEXT,
    segments: SEGMENTS,
    pages: PAGES,
    chunkRanges: CHUNK_RANGES,
    ...overrides,
  }
}

function reconstructedText(page: { blocks: { text: string }[] }): string {
  return page.blocks.map((b) => b.text).join('')
}

function backgroundColorsInPage(page: {
  blocks: unknown[]
  spansByBlock: { backgroundColor: string }[][]
}): string[] {
  return page.spansByBlock.flat().map((span) => span.backgroundColor)
}

describe('computeChunkContextView (023-pdf-fullscreen-chunk-view research.md §5)', () => {
  it('omits the missing neighbor for the first chunk without erroring', () => {
    const preview = makePreview()

    const pages = computeChunkContextView(preview, 0)

    // No error from the nonexistent chunk -1 — only chunk 0 (range [0,6)) and its one existing
    // neighbor, chunk 1 (range [6,24), which itself crosses into page 2), are considered.
    expect(() => pages).not.toThrow()
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2])
  })

  it('omits the missing neighbor for the last chunk without erroring', () => {
    const preview = makePreview()

    const pages = computeChunkContextView(preview, 2)

    expect(() => pages).not.toThrow()
    expect(pages.map((p) => p.pageNumber)).toEqual(expect.arrayContaining([1, 2]))
  })

  it('unions the pages touched by the selected chunk and both neighbors', () => {
    const preview = makePreview()

    const pages = computeChunkContextView(preview, 1)

    // chunk1 alone crosses the page boundary, so both pages must be included.
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2])
  })

  it('slices and rebases fullText/segments correctly per touched page', () => {
    const preview = makePreview()

    const pages = computeChunkContextView(preview, 1)

    const page1 = pages.find((p) => p.pageNumber === 1)!
    const page2 = pages.find((p) => p.pageNumber === 2)!
    expect(reconstructedText(page1)).toBe(FULL_TEXT.slice(0, 18))
    expect(reconstructedText(page2)).toBe(FULL_TEXT.slice(18, 36))
  })

  it('assigns the same color to a chunk that appears on two different touched pages', () => {
    const preview = makePreview()

    const pages = computeChunkContextView(preview, 1)
    const page1 = pages.find((p) => p.pageNumber === 1)!
    const page2 = pages.find((p) => p.pageNumber === 2)!

    // chunk1 contributes color to both pages (it spans the boundary) — every color that shows up
    // on page 1 must also be a color that shows up on page 2, for the shared chunk1 span.
    const page1Colors = new Set(backgroundColorsInPage(page1))
    const page2Colors = new Set(backgroundColorsInPage(page2))
    const sharedColors = [...page1Colors].filter((color) => page2Colors.has(color))
    expect(sharedColors.length).toBeGreaterThan(0)
  })

  it('returns an empty array when the selected chunk has no chunkRanges entry', () => {
    const preview = makePreview()

    const pages = computeChunkContextView(preview, 99)

    expect(pages).toEqual([])
  })
})
