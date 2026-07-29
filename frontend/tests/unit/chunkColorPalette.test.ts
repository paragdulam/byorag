import { describe, expect, it } from 'vitest'
import {
  assignChunkColors,
  CHUNK_COLOR_PALETTE,
  CHUNK_TEXT_COLOR,
} from '../../src/lib/chunkColorPalette'
import type { SavedChunk } from '../../src/types/embeddings'

function chunk(id: string, index: number): SavedChunk {
  return { id, index, content: `chunk ${index}` }
}

describe('assignChunkColors (021-sources-chunking-embeddings-refresh US3)', () => {
  it('returns one assignment per chunk, in the same order, index-aligned', () => {
    const chunks = [chunk('a', 0), chunk('b', 1), chunk('c', 2)]

    const result = assignChunkColors(chunks)

    expect(result.map((r) => r.chunkId)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for an empty chunk list', () => {
    expect(assignChunkColors([])).toEqual([])
  })

  it('always uses the fixed CHUNK_TEXT_COLOR for every chunk', () => {
    const chunks = Array.from({ length: 20 }, (_, i) => chunk(`c${i}`, i))

    const result = assignChunkColors(chunks)

    expect(result.every((r) => r.textColor === CHUNK_TEXT_COLOR)).toBe(true)
  })

  it('only assigns background colors from the curated palette', () => {
    const chunks = Array.from({ length: 20 }, (_, i) => chunk(`c${i}`, i))

    const result = assignChunkColors(chunks)

    expect(result.every((r) => CHUNK_COLOR_PALETTE.includes(r.backgroundColor))).toBe(true)
  })

  it('never assigns the same background color to two consecutive chunks', () => {
    const chunks = Array.from({ length: 50 }, (_, i) => chunk(`c${i}`, i))

    const result = assignChunkColors(chunks)

    for (let i = 1; i < result.length; i += 1) {
      expect(result[i].backgroundColor).not.toBe(result[i - 1].backgroundColor)
    }
  })

  it('does not mutate the input chunks array (pure function)', () => {
    const chunks = [chunk('a', 0), chunk('b', 1)]
    const snapshot = JSON.parse(JSON.stringify(chunks))

    assignChunkColors(chunks)

    expect(chunks).toEqual(snapshot)
  })
})
