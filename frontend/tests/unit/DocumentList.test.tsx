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

describe('DocumentList name wrapping (018-ui-polish-batch US3)', () => {
  it('renders the document name cell with wrapping classes so it never forces the table wider', () => {
    const documents = [makeDoc({ id: 'long.pdf', name: 'a-very-long-unbroken-token-name-with-no-spaces.pdf' })]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    const cell = screen.getByText('a-very-long-unbroken-token-name-with-no-spaces.pdf')
    expect(cell.className).toMatch(/break-words/)
  })

  it('uses a fixed table layout so the name column has a bounded width to wrap within', () => {
    const documents = [makeDoc()]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    expect(screen.getByRole('table').className).toMatch(/table-fixed/)
  })
})

describe('DocumentList name wrapping in the narrower split-pane layout (022-chunk-preview-ui-fixes US1)', () => {
  it('does not clip or truncate the name cell — no truncate/whitespace-nowrap/overflow-hidden classes', () => {
    const documents = [makeDoc({ name: 'a-fairly-long-document-name-with-several-words.pdf' })]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    const cell = screen.getByText('a-fairly-long-document-name-with-several-words.pdf')
    expect(cell.className).not.toMatch(/truncate|whitespace-nowrap|overflow-hidden/)
  })

  it('does not force a fixed row height that would clip wrapped content', () => {
    const documents = [makeDoc()]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    const row = screen.getByRole('table').querySelector('tbody tr')
    expect(row?.className ?? '').not.toMatch(/\bh-\d+\b|overflow-hidden/)
  })

  it('gives the name column a generous explicit share of the table width, freeing space from the now-oversized actions column', () => {
    const documents = [makeDoc()]

    render(<DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />)

    const headers = screen.getAllByRole('columnheader')
    const nameHeader = headers.find((h) => h.textContent === 'DOCUMENT NAME')
    const actionsHeader = headers[headers.length - 1]
    expect(nameHeader?.className).toMatch(/w-1\/2|w-auto/)
    expect(actionsHeader?.className).not.toMatch(/w-64/)
  })

  it('wraps the table in a horizontally-scrollable container as a safety net for unbroken long tokens', () => {
    const documents = [makeDoc()]

    const { container } = render(
      <DocumentList documents={documents} onExportCsv={vi.fn()} onDeleteDocuments={vi.fn()} />,
    )

    const scrollWrapper = container.querySelector('.overflow-x-auto')
    expect(scrollWrapper).not.toBeNull()
    expect(scrollWrapper?.querySelector('table')).not.toBeNull()
  })
})
