import type { SavedChunk } from '../types/embeddings'

// A curated palette of soft/pastel background colors, each pre-validated to stay legible
// against the fixed dark CHUNK_TEXT_COLOR below — resolved via /speckit-clarify in favor of
// guaranteed legibility over unconstrained random RGB (021-sources-chunking-embeddings-refresh
// research.md §5).
export const CHUNK_COLOR_PALETTE: readonly string[] = [
  '#FFD6D6',
  '#FFE8C2',
  '#FFF6C2',
  '#DFF5D8',
  '#C8F0E4',
  '#C7E8FA',
  '#D6D6FA',
  '#E7D6FA',
  '#FAD6EC',
  '#E8DFD0',
]

export const CHUNK_TEXT_COLOR = '#1F2933'

// Reserved exclusively for spans shared by 2+ overlapping chunks (022-chunk-preview-ui-fixes
// Clarifications Q3) — never selected by the random per-chunk assignment below, so an overlap
// span is always recognizable as its own distinct kind of thing rather than blending in with the
// regular per-chunk palette.
export const OVERLAP_COLOR = '#B0B7C3'
export const OVERLAP_TEXT_COLOR = '#1F2933'

export interface ChunkColorAssignment {
  chunkId: string
  backgroundColor: string
  textColor: string
}

function randomPaletteColor(): string {
  return CHUNK_COLOR_PALETTE[Math.floor(Math.random() * CHUNK_COLOR_PALETTE.length)]
}

/**
 * Same random-with-no-adjacent-repeat guarantee as `assignChunkColors`, but keyed by chunk index
 * rather than by a `SavedChunk[]` array — Chunked Preview v2 no longer renders one card per
 * chunk, so colors are looked up by index while building `BlockColorSpan`s instead
 * (022-chunk-preview-ui-fixes research.md §4-5). `chunkIndexes` is assumed already sorted
 * ascending (the order saved chunks are always returned in).
 */
export function assignColorsByChunkIndex(chunkIndexes: number[]): Map<number, string> {
  const colorByIndex = new Map<number, string>()
  let previousColor: string | null = null

  for (const index of chunkIndexes) {
    let color = randomPaletteColor()
    while (CHUNK_COLOR_PALETTE.length > 1 && color === previousColor) {
      color = randomPaletteColor()
    }
    colorByIndex.set(index, color)
    previousColor = color
  }

  return colorByIndex
}

/**
 * Assigns each chunk a random background color from the curated palette, re-rolling only
 * against the immediately preceding chunk's color so no two consecutive chunks match (spec
 * FR-011); colors may repeat non-consecutively. Pure — does not mutate `chunks`.
 */
export function assignChunkColors(chunks: SavedChunk[]): ChunkColorAssignment[] {
  const assignments: ChunkColorAssignment[] = []
  let previousColor: string | null = null

  for (const chunk of chunks) {
    let color = randomPaletteColor()
    while (CHUNK_COLOR_PALETTE.length > 1 && color === previousColor) {
      color = randomPaletteColor()
    }
    assignments.push({ chunkId: chunk.id, backgroundColor: color, textColor: CHUNK_TEXT_COLOR })
    previousColor = color
  }

  return assignments
}
