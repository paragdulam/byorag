import { describe, expect, it } from 'vitest'
import { mostVisiblePage } from '../../src/lib/pdfPageVisibility'

describe('mostVisiblePage (029-pdf-preview-page-count)', () => {
  it('returns null for an empty entries array', () => {
    expect(mostVisiblePage([])).toBeNull()
  })

  it('returns the single entry’s page number when given one entry', () => {
    expect(mostVisiblePage([{ pageNumber: 3, intersectionRatio: 0.1 }])).toBe(3)
  })

  it('returns the page number with the highest intersectionRatio among several', () => {
    expect(
      mostVisiblePage([
        { pageNumber: 1, intersectionRatio: 0.2 },
        { pageNumber: 2, intersectionRatio: 0.9 },
        { pageNumber: 3, intersectionRatio: 0.5 },
      ]),
    ).toBe(2)
  })

  it('resolves ties by picking the lowest page number', () => {
    expect(
      mostVisiblePage([
        { pageNumber: 4, intersectionRatio: 0.5 },
        { pageNumber: 2, intersectionRatio: 0.5 },
        { pageNumber: 3, intersectionRatio: 0.5 },
      ]),
    ).toBe(2)
  })
})
