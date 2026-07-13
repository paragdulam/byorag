import { describe, expect, it } from 'vitest'
import { validateFile } from '../../src/lib/fileValidation'

const MAX_SIZE_BYTES = 50 * 1024 * 1024
const ACCEPTED_TYPES = ['.pdf', 'application/pdf']

function makeFile(name: string, sizeBytes: number, type: string): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type })
  return file
}

describe('validateFile (US1: accepting valid PDFs)', () => {
  it('accepts a PDF within the size limit', () => {
    const file = makeFile('report.pdf', 2.4 * 1024 * 1024, 'application/pdf')
    expect(validateFile(file, MAX_SIZE_BYTES, ACCEPTED_TYPES)).toEqual({ valid: true })
  })

  it('accepts a PDF exactly at the size limit', () => {
    const file = makeFile('exact.pdf', MAX_SIZE_BYTES, 'application/pdf')
    expect(validateFile(file, MAX_SIZE_BYTES, ACCEPTED_TYPES)).toEqual({ valid: true })
  })
})

describe('validateFile (US2: rejecting invalid uploads)', () => {
  it('rejects a non-PDF file as invalid-type', () => {
    const file = makeFile('notes.txt', 1024, 'text/plain')
    expect(validateFile(file, MAX_SIZE_BYTES, ACCEPTED_TYPES)).toEqual({
      valid: false,
      reason: 'invalid-type',
    })
  })

  it('rejects a PDF larger than the size limit as too-large', () => {
    const file = makeFile('huge.pdf', MAX_SIZE_BYTES + 1, 'application/pdf')
    expect(validateFile(file, MAX_SIZE_BYTES, ACCEPTED_TYPES)).toEqual({
      valid: false,
      reason: 'too-large',
    })
  })
})
