import type { PreviewSegment, StructuredPreview } from './chunkingApi'
import { classifyBlocks, colorBlocks } from './chunkStructure'
import type { BlockColorSpan, PreviewBlock } from './chunkStructure'
import { assignColorsByChunkIndex } from './chunkColorPalette'

export interface ChunkContextPage {
  pageNumber: number
  blocks: PreviewBlock[]
  spansByBlock: BlockColorSpan[][]
}

/**
 * Given a document's full structured-preview payload and the currently selected chunk, returns
 * one entry per PDF page touched by the selected chunk and its one preceding/following neighbor
 * (023-pdf-fullscreen-chunk-view research.md §5) — fetched once per document, this is pure
 * client-side slicing, so switching the selected chunk never needs a network round-trip. A chunk
 * index that appears in more than one returned page (because it spans a page boundary) always
 * gets the same color across all of them (research.md §6), via one shared color map computed
 * before any per-page `colorBlocks` call.
 */
export function computeChunkContextView(
  preview: StructuredPreview,
  selectedChunkIndex: number,
): ChunkContextPage[] {
  const rangeByIndex = new Map(preview.chunkRanges.map((range) => [range.chunkIndex, range]))
  const relevantRanges = [selectedChunkIndex - 1, selectedChunkIndex, selectedChunkIndex + 1]
    .map((index) => rangeByIndex.get(index))
    .filter((range): range is NonNullable<typeof range> => range !== undefined)

  if (relevantRanges.length === 0) {
    return []
  }

  const touchedPages = preview.pages.filter((page) =>
    relevantRanges.some((range) => range.start < page.end && range.end > page.start),
  )

  const chunkIndexesOnTouchedPages = Array.from(
    new Set(
      preview.segments
        .filter((segment) => segment.kind === 'chunk' && segment.chunkIndex !== null)
        .filter((segment) =>
          touchedPages.some((page) => segment.start < page.end && segment.end > page.start),
        )
        .map((segment) => segment.chunkIndex as number),
    ),
  ).sort((a, b) => a - b)
  const colorByChunkIndex = assignColorsByChunkIndex(chunkIndexesOnTouchedPages)

  return touchedPages.map((page) => {
    const pageText = preview.fullText.slice(page.start, page.end)
    const clippedSegments: PreviewSegment[] = []
    for (const segment of preview.segments) {
      const start = Math.max(segment.start, page.start)
      const end = Math.min(segment.end, page.end)
      if (start >= end) {
        continue
      }
      clippedSegments.push({
        start: start - page.start,
        end: end - page.start,
        kind: segment.kind,
        chunkIndex: segment.chunkIndex,
      })
    }

    const blocks = classifyBlocks(pageText)
    const spansByBlock = colorBlocks(blocks, clippedSegments, colorByChunkIndex)
    return { pageNumber: page.pageNumber, blocks, spansByBlock }
  })
}
