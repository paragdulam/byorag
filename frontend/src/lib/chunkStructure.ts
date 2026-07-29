import type { PreviewSegment } from './chunkingApi'
import {
  assignColorsByChunkIndex,
  CHUNK_TEXT_COLOR,
  OVERLAP_COLOR,
  OVERLAP_TEXT_COLOR,
} from './chunkColorPalette'

export interface PreviewBlock {
  kind: 'heading' | 'paragraph' | 'list-item'
  text: string
  startOffset: number
  endOffset: number
  listGroupId: string | null
}

export interface BlockColorSpan {
  text: string
  backgroundColor: string
  textColor: string
}

// Lightweight, text-cue-only heuristic (022-chunk-preview-ui-fixes research.md §3) — no PDF
// layout/font analysis, just what's recoverable from the re-extracted, structure-preserving text.
const LIST_MARKER_RE = /^\s*(?:[-*•]|\d+[.)]|[a-zA-Z][.)])\s+/
const HEADING_MAX_LENGTH = 70
// A line ending in typical sentence-continuation punctuation reads as prose, not a title, even
// if it's short and stands alone.
const SENTENCE_END_RE = /[.,;:]\s*$/

interface LineInfo {
  text: string
  start: number
  end: number
}

function splitLines(fullText: string): LineInfo[] {
  const lines: LineInfo[] = []
  let offset = 0
  for (const raw of fullText.split('\n')) {
    lines.push({ text: raw, start: offset, end: offset + raw.length })
    offset += raw.length + 1 // +1 for the '\n' consumed by split()
  }
  return lines
}

function isHeadingCandidate(line: LineInfo): boolean {
  const trimmed = line.text.trim()
  return (
    trimmed.length > 0 &&
    trimmed.length <= HEADING_MAX_LENGTH &&
    !LIST_MARKER_RE.test(line.text) &&
    !SENTENCE_END_RE.test(trimmed)
  )
}

/**
 * Classifies a document's structure-preserving text into an ordered list of blocks
 * (heading/paragraph/list-item), per the lightweight heuristic above
 * (contracts/ui-contracts.md `classifyBlocks`).
 */
export function classifyBlocks(fullText: string): PreviewBlock[] {
  const lines = splitLines(fullText)
  const blocks: PreviewBlock[] = []
  let listGroupCounter = 0

  let index = 0
  while (index < lines.length) {
    if (lines[index].text.trim() === '') {
      index += 1
      continue
    }

    const groupStart = index
    let groupEnd = index
    while (groupEnd < lines.length && lines[groupEnd].text.trim() !== '') {
      groupEnd += 1
    }
    const group = lines.slice(groupStart, groupEnd)

    if (group.length === 1 && isHeadingCandidate(group[0])) {
      blocks.push({
        kind: 'heading',
        text: fullText.slice(group[0].start, group[0].end),
        startOffset: group[0].start,
        endOffset: group[0].end,
        listGroupId: null,
      })
      index = groupEnd
      continue
    }

    let currentListGroupId: string | null = null
    let paragraphStart: number | null = null
    let paragraphEnd: number | null = null

    const flushParagraph = () => {
      if (paragraphStart !== null && paragraphEnd !== null) {
        blocks.push({
          kind: 'paragraph',
          text: fullText.slice(paragraphStart, paragraphEnd),
          startOffset: paragraphStart,
          endOffset: paragraphEnd,
          listGroupId: null,
        })
      }
      paragraphStart = null
      paragraphEnd = null
    }

    for (const line of group) {
      if (LIST_MARKER_RE.test(line.text)) {
        flushParagraph()
        if (currentListGroupId === null) {
          listGroupCounter += 1
          currentListGroupId = `list-${listGroupCounter}`
        }
        blocks.push({
          kind: 'list-item',
          text: fullText.slice(line.start, line.end),
          startOffset: line.start,
          endOffset: line.end,
          listGroupId: currentListGroupId,
        })
      } else {
        currentListGroupId = null
        if (paragraphStart === null) {
          paragraphStart = line.start
        }
        paragraphEnd = line.end
      }
    }
    flushParagraph()

    index = groupEnd
  }

  return blocks
}

function resolveSegmentColor(
  segment: PreviewSegment,
  colorByChunkIndex: Map<number, string>,
): { backgroundColor: string; textColor: string } {
  if (segment.kind === 'overlap') {
    return { backgroundColor: OVERLAP_COLOR, textColor: OVERLAP_TEXT_COLOR }
  }
  const backgroundColor = colorByChunkIndex.get(segment.chunkIndex as number) ?? OVERLAP_COLOR
  return { backgroundColor, textColor: CHUNK_TEXT_COLOR }
}

/**
 * Intersects each block's `[startOffset, endOffset)` range with the backend's `segments` to
 * produce the ordered list of colored inline spans local to that block (contracts/ui-
 * contracts.md `colorBlocks`, research.md §4) — every character of every block is covered by
 * exactly one span. The same chunk index always resolves to the same color across every block
 * in this call, via one shared `assignColorsByChunkIndex` map.
 *
 * `colorByChunkIndex` may be supplied by the caller (023-pdf-fullscreen-chunk-view research.md
 * §6) — when a single logical view spans multiple independent `colorBlocks` calls (e.g. one call
 * per rendered page in the in-context chunk preview), computing the map once up front and passing
 * it into every call keeps a chunk's color consistent across all of them; when omitted, this
 * function computes it internally exactly as it always has (unchanged behavior for any other
 * caller, e.g. the whole-document case).
 */
export function colorBlocks(
  blocks: PreviewBlock[],
  segments: PreviewSegment[],
  colorByChunkIndex?: Map<number, string>,
): BlockColorSpan[][] {
  const resolvedColorByChunkIndex =
    colorByChunkIndex ??
    assignColorsByChunkIndex(
      Array.from(
        new Set(
          segments
            .filter((segment) => segment.kind === 'chunk' && segment.chunkIndex !== null)
            .map((segment) => segment.chunkIndex as number),
        ),
      ).sort((a, b) => a - b),
    )

  return blocks.map((block) => {
    const spans: BlockColorSpan[] = []

    for (const segment of segments) {
      const start = Math.max(segment.start, block.startOffset)
      const end = Math.min(segment.end, block.endOffset)
      if (start >= end) {
        continue
      }
      const { backgroundColor, textColor } = resolveSegmentColor(segment, resolvedColorByChunkIndex)
      spans.push({
        text: block.text.slice(start - block.startOffset, end - block.startOffset),
        backgroundColor,
        textColor,
      })
    }

    if (spans.length === 0) {
      spans.push({ text: block.text, backgroundColor: 'transparent', textColor: CHUNK_TEXT_COLOR })
    }

    return spans
  })
}
