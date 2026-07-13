import { describe, expect, it } from 'vitest'
import { formatFileSize } from '../../src/lib/formatFileSize'

describe('formatFileSize', () => {
  it('formats sizes under 1KB in bytes', () => {
    expect(formatFileSize(512)).toBe('512 B')
  })

  it('formats sizes under 1MB in KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats sizes of 1MB and above in MB', () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2.4 MB')
  })

  it('formats exactly 1KB as the KB boundary', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
  })

  it('formats exactly 1MB as the MB boundary', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB')
  })
})
