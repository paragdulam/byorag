import { describe, expect, it } from 'vitest'
import { clampScale, zoomIn, zoomOut, DEFAULT_SCALE, MIN_SCALE, MAX_SCALE } from '../../src/lib/pdfZoom'

describe('pdfZoom constants', () => {
  it('defines DEFAULT_SCALE and MIN_SCALE as 1.0 (100%)', () => {
    expect(DEFAULT_SCALE).toBe(1.0)
    expect(MIN_SCALE).toBe(1.0)
  })

  it('defines MAX_SCALE as 4.0 (400%)', () => {
    expect(MAX_SCALE).toBe(4.0)
  })
})

describe('clampScale', () => {
  it('clamps a value below MIN_SCALE up to MIN_SCALE', () => {
    expect(clampScale(0.5)).toBe(MIN_SCALE)
  })

  it('clamps a value above MAX_SCALE down to MAX_SCALE', () => {
    expect(clampScale(10)).toBe(MAX_SCALE)
  })

  it('passes an in-range value through unchanged', () => {
    expect(clampScale(2.5)).toBe(2.5)
  })
})

describe('zoomIn', () => {
  it('increases scale by 0.25', () => {
    expect(zoomIn(1.0)).toBeCloseTo(1.25)
  })

  it('clamps at MAX_SCALE', () => {
    expect(zoomIn(MAX_SCALE)).toBe(MAX_SCALE)
    expect(zoomIn(3.9)).toBe(MAX_SCALE)
  })
})

describe('zoomOut', () => {
  it('decreases scale by 0.25', () => {
    expect(zoomOut(2.0)).toBeCloseTo(1.75)
  })

  it('clamps at MIN_SCALE', () => {
    expect(zoomOut(MIN_SCALE)).toBe(MIN_SCALE)
    expect(zoomOut(1.1)).toBe(MIN_SCALE)
  })
})
