import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SourceDocumentPreview } from '../../src/components/sources/SourceDocumentPreview'

interface MockDocumentProps {
  file: { url: string; httpHeaders?: Record<string, string> }
  onLoadSuccess?: (result: { numPages: number }) => void
  onLoadError?: () => void
  children?: React.ReactNode
}

let latestDocumentProps: MockDocumentProps | null = null

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: (props: MockDocumentProps) => {
    latestDocumentProps = props
    return <div data-testid="mock-pdf-document">{props.children}</div>
  },
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="mock-pdf-page">Page {pageNumber}</div>
  ),
}))

describe('SourceDocumentPreview (021-sources-chunking-embeddings-refresh US2)', () => {
  it('shows an empty placeholder when no document is selected', () => {
    render(
      <SourceDocumentPreview documentId={null} isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.getByTestId('source-preview-empty')).toBeInTheDocument()
  })

  it('renders the PDF document pointed at the file endpoint for the selected document', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(latestDocumentProps?.file.url).toBe('/api/sources/doc-1/file')
  })

  it('renders one Page per numPages reported by onLoadSuccess', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    expect(screen.getAllByTestId('mock-pdf-page')).toHaveLength(3)
  })

  it('shows a "preview unavailable" message when the document fails to load', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadError?.()
    })

    expect(screen.getByTestId('source-preview-unavailable')).toBeInTheDocument()
  })
})

describe('SourceDocumentPreview — fullscreen toggle (023-pdf-fullscreen-chunk-view US1)', () => {
  it('does not show a "Chunked Preview" or "Back to PDF" button', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    expect(screen.queryByRole('button', { name: /chunked preview/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /back to pdf/i })).not.toBeInTheDocument()
  })

  it('shows a "Fullscreen" button when not in fullscreen', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={false} onToggleFullscreen={vi.fn()} />,
    )

    const toggle = screen.getByTestId('source-preview-fullscreen-toggle')
    expect(toggle).toHaveTextContent(/fullscreen/i)
    expect(toggle).not.toHaveTextContent(/restore/i)
  })

  it('shows a "Restore" button when in fullscreen', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={true} onToggleFullscreen={vi.fn()} />,
    )

    const toggle = screen.getByTestId('source-preview-fullscreen-toggle')
    expect(toggle).toHaveTextContent(/restore/i)
  })

  it('calls onToggleFullscreen when the toggle button is clicked', async () => {
    const onToggleFullscreen = vi.fn()
    render(
      <SourceDocumentPreview
        documentId="doc-1"
        isFullscreen={false}
        onToggleFullscreen={onToggleFullscreen}
      />,
    )

    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))

    expect(onToggleFullscreen).toHaveBeenCalledTimes(1)
  })

  it('renders every page continuously regardless of fullscreen state', () => {
    render(
      <SourceDocumentPreview documentId="doc-1" isFullscreen={true} onToggleFullscreen={vi.fn()} />,
    )

    act(() => {
      latestDocumentProps?.onLoadSuccess?.({ numPages: 3 })
    })

    expect(screen.getAllByTestId('mock-pdf-page')).toHaveLength(3)
  })
})
