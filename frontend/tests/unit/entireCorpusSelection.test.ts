import { describe, expect, it } from 'vitest'
import {
  ENTIRE_CORPUS_SELECTION,
  isEntireCorpusSelection,
} from '../../src/lib/entireCorpusSelection'

describe('entireCorpusSelection', () => {
  it('is a fixed, non-empty sentinel string', () => {
    expect(typeof ENTIRE_CORPUS_SELECTION).toBe('string')
    expect(ENTIRE_CORPUS_SELECTION.length).toBeGreaterThan(0)
  })

  it('isEntireCorpusSelection returns true for the sentinel', () => {
    expect(isEntireCorpusSelection(ENTIRE_CORPUS_SELECTION)).toBe(true)
  })

  it('isEntireCorpusSelection returns false for a real document id (UUID shape)', () => {
    expect(isEntireCorpusSelection('b6b8f6d2-1234-4abc-9def-abcdef123456')).toBe(false)
  })

  it('isEntireCorpusSelection returns false for an empty string', () => {
    expect(isEntireCorpusSelection('')).toBe(false)
  })

  it('isEntireCorpusSelection returns false for an arbitrary non-matching string', () => {
    expect(isEntireCorpusSelection('some-document-id')).toBe(false)
  })
})
