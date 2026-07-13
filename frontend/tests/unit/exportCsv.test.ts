import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCsv, exportCsv } from '../../src/lib/exportCsv'
import type { SourceDocument } from '../../src/types/sourceDocument'

const documents: SourceDocument[] = [
  {
    id: '1',
    name: 'Q3_Financial_Report.pdf',
    sizeBytes: 2.4 * 1024 * 1024,
    uploadedAt: new Date('2026-07-04T14:02:00'),
    status: 'processed',
  },
  {
    id: '2',
    name: 'Legal_Brief_v2.pdf',
    sizeBytes: 1.1 * 1024 * 1024,
    uploadedAt: new Date('2026-07-04T14:15:00'),
    status: 'processing',
  },
]

describe('buildCsv', () => {
  it('produces one row per document with name, size, date, and status columns', () => {
    const csv = buildCsv(documents)
    const lines = csv.trim().split('\n')

    expect(lines[0]).toBe('name,size,uploadDate,status')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('Q3_Financial_Report.pdf')
    expect(lines[1]).toContain('processed')
    expect(lines[2]).toContain('Legal_Brief_v2.pdf')
    expect(lines[2]).toContain('processing')
  })

  it('produces header-only output for an empty list', () => {
    const csv = buildCsv([])
    expect(csv.trim()).toBe('name,size,uploadDate,status')
  })

  it('handles documents whose uploadedAt was parsed from an API ISO string (as sourcesApi.listSources() produces)', () => {
    // Regression test for specs/002-persist-pdf-sources: uploadedAt now
    // arrives over the wire as an ISO 8601 string and must be parsed back
    // into a real Date before reaching buildCsv/exportCsv, since
    // doc.uploadedAt.toISOString() would otherwise throw on a plain string.
    const apiShapedDocuments: SourceDocument[] = [
      {
        id: 'report.pdf',
        name: 'report.pdf',
        sizeBytes: 2516582,
        uploadedAt: new Date('2026-07-04T15:32:10Z'),
        status: 'processed',
      },
    ]

    expect(() => buildCsv(apiShapedDocuments)).not.toThrow()
    const lines = buildCsv(apiShapedDocuments).trim().split('\n')
    expect(lines[1]).toContain('report.pdf')
    expect(lines[1]).toContain('2026-07-04T15:32:10.000Z')
  })
})

describe('exportCsv', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    global.URL.createObjectURL = createObjectURL
    global.URL.revokeObjectURL = revokeObjectURL
    clickSpy = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('triggers a client-side download without making a network request', () => {
    exportCsv(documents)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
