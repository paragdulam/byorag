import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DocumentList } from '../../src/components/sources/DocumentList'
import { useSourceDocuments } from '../../src/hooks/useSourceDocuments'

function makeFile(name: string, sizeBytes = 2.4 * 1024 * 1024, type = 'application/pdf'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function Harness({ file }: { file: File }) {
  const { documents, addFiles } = useSourceDocuments()
  return (
    <div>
      <button onClick={() => addFiles([file])}>add</button>
      <DocumentList documents={documents} onExportCsv={() => {}} />
    </div>
  )
}

describe('DocumentList (US1: rendering rows + status transition)', () => {
  it('renders one row per document with name, size, and date', () => {
    const file = makeFile('Q3_Financial_Report.pdf')
    render(
      <DocumentList
        documents={[
          {
            id: '1',
            name: file.name,
            sizeBytes: file.size,
            uploadedAt: new Date('2026-07-04T14:02:00'),
            status: 'processed',
          },
        ]}
        onExportCsv={() => {}}
      />,
    )

    expect(screen.getByText('Q3_Financial_Report.pdf')).toBeInTheDocument()
    expect(screen.getByText('2.4 MB')).toBeInTheDocument()
  })

  it('transitions a document from Processing to Processed once the upload request resolves', async () => {
    // 002-persist-pdf-sources: the "processing" state is now an optimistic
    // placeholder shown while the real POST /api/sources request is in
    // flight, replaced by the server-confirmed (already "processed")
    // document once the request resolves -- there is no fixed timer delay.
    let resolveUpload!: (response: Response) => void
    const uploadPromise = new Promise<Response>((resolve) => {
      resolveUpload = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init?.method) {
          return new Response(JSON.stringify({ documents: [] }), { status: 200 })
        }
        return uploadPromise
      }),
    )

    const file = makeFile('Legal_Brief_v2.pdf')
    render(<Harness file={file} />)

    await act(async () => {
      screen.getByText('add').click()
    })

    expect(screen.getByText('PROCESSING')).toBeInTheDocument()

    await act(async () => {
      resolveUpload(
        new Response(
          JSON.stringify({
            documents: [
              {
                id: file.name,
                name: file.name,
                sizeBytes: file.size,
                uploadedAt: new Date().toISOString(),
                status: 'processed',
              },
            ],
            rejections: [],
          }),
          { status: 200 },
        ),
      )
      await uploadPromise
    })

    await waitFor(() => {
      expect(screen.getByText('PROCESSED')).toBeInTheDocument()
    })
  })
})

describe('DocumentList (US3: Export CSV)', () => {
  it('invokes onExportCsv when the Export CSV button is clicked, with a populated list', () => {
    const onExportCsv = vi.fn()
    render(
      <DocumentList
        documents={[
          {
            id: '1',
            name: 'Q3_Financial_Report.pdf',
            sizeBytes: 2.4 * 1024 * 1024,
            uploadedAt: new Date('2026-07-04T14:02:00'),
            status: 'processed',
          },
        ]}
        onExportCsv={onExportCsv}
      />,
    )

    screen.getByRole('button', { name: 'Export CSV' }).click()

    expect(onExportCsv).toHaveBeenCalledTimes(1)
  })

  it('invokes onExportCsv when the Export CSV button is clicked, with an empty list', () => {
    const onExportCsv = vi.fn()
    render(<DocumentList documents={[]} onExportCsv={onExportCsv} />)

    screen.getByRole('button', { name: 'Export CSV' }).click()

    expect(onExportCsv).toHaveBeenCalledTimes(1)
  })
})
