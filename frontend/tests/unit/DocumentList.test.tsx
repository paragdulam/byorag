import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentList } from '../../src/components/sources/DocumentList'
import type { SourceDocument } from '../../src/types/sourceDocument'

function makeDoc(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: 'report.pdf',
    name: 'report.pdf',
    sizeBytes: 2048,
    uploadedAt: new Date('2026-07-13T10:00:00Z'),
    status: 'processed',
    ...overrides,
  }
}

describe('DocumentList deletion (US1: single delete)', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm')
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('renders a delete control only for processed documents, not processing ones', () => {
    const documents = [
      makeDoc({ id: 'a.pdf', name: 'a.pdf', status: 'processed' }),
      makeDoc({ id: 'b.pdf', name: 'b.pdf', status: 'processing' }),
    ]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Delete a.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete b.pdf' })).not.toBeInTheDocument()
  })

  it('calls onDeleteDocuments with the document id when the user confirms', async () => {
    confirmSpy.mockReturnValue(true)
    const onDeleteDocuments = vi.fn()
    const documents = [makeDoc({ id: 'report.pdf', name: 'report.pdf' })]

    render(
      <DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={onDeleteDocuments} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onDeleteDocuments).toHaveBeenCalledWith(['report.pdf'])
  })

  it('does not call onDeleteDocuments when the user cancels the confirmation', async () => {
    confirmSpy.mockReturnValue(false)
    const onDeleteDocuments = vi.fn()
    const documents = [makeDoc({ id: 'report.pdf', name: 'report.pdf' })]

    render(
      <DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={onDeleteDocuments} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onDeleteDocuments).not.toHaveBeenCalled()
  })
})

describe('DocumentList deletion (US2: bulk delete)', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm')
  })

  afterEach(() => {
    confirmSpy.mockRestore()
  })

  it('renders a selection checkbox only for processed documents', () => {
    const documents = [
      makeDoc({ id: 'a.pdf', name: 'a.pdf', status: 'processed' }),
      makeDoc({ id: 'b.pdf', name: 'b.pdf', status: 'processing' }),
    ]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'Select a.pdf' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Select b.pdf' })).not.toBeInTheDocument()
  })

  it('disables "Delete Selected" until at least one row is checked', async () => {
    const documents = [makeDoc({ id: 'a.pdf', name: 'a.pdf' })]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select a.pdf' }))

    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeEnabled()
  })

  it('confirms once and calls onDeleteDocuments with all selected ids', async () => {
    confirmSpy.mockReturnValue(true)
    const onDeleteDocuments = vi.fn()
    const documents = [
      makeDoc({ id: 'a.pdf', name: 'a.pdf' }),
      makeDoc({ id: 'b.pdf', name: 'b.pdf' }),
      makeDoc({ id: 'c.pdf', name: 'c.pdf' }),
    ]

    render(
      <DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={onDeleteDocuments} />,
    )

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select a.pdf' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select c.pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Selected' }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(onDeleteDocuments).toHaveBeenCalledTimes(1)
    expect(onDeleteDocuments.mock.calls[0][0]).toEqual(
      expect.arrayContaining(['a.pdf', 'c.pdf']),
    )
    expect(onDeleteDocuments.mock.calls[0][0]).toHaveLength(2)
  })
})
