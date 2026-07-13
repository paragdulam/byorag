import type { SourceDocument } from '../types/sourceDocument'
import { formatFileSize } from './formatFileSize'

const CSV_HEADER = 'name,size,uploadDate,status'

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv(documents: SourceDocument[]): string {
  const rows = documents.map((doc) =>
    [
      escapeCsvField(doc.name),
      formatFileSize(doc.sizeBytes),
      doc.uploadedAt.toISOString(),
      doc.status,
    ].join(','),
  )

  return [CSV_HEADER, ...rows].join('\n')
}

export function exportCsv(documents: SourceDocument[]): void {
  const csv = buildCsv(documents)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = 'source-documents.csv'
  link.click()

  URL.revokeObjectURL(url)
}
