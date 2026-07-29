import { render as rtlRender, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataSourcesScreen } from '../../src/components/sources/DataSourcesScreen'
import { CorpusProvider } from '../../src/context/CorpusContext'

// react-pdf/pdfjs needs a real worker + canvas, neither of which jsdom provides — stubbed here
// (021-sources-chunking-embeddings-refresh) so the split-view tests can assert which document's
// file URL the preview pane was pointed at, without attempting real PDF parsing.
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: (props: { file: string }) => (
    <div data-testid="mock-pdf-document">{props.file}</div>
  ),
  Page: () => null,
}))

function jsonResponse(body: unknown, status = 200): Response {
  if (status === 204) {
    return new Response(null, { status })
  }
  return new Response(JSON.stringify(body), { status })
}

// Wraps every render below in CorpusProvider — required because AppShell ->
// SidebarNav reads the active corpus from context (008-corpora-management).
function render(ui: ReactElement) {
  return rtlRender(<CorpusProvider>{ui}</CorpusProvider>)
}

describe('DataSourcesScreen composition', () => {
  it('renders the sidebar and top bar without error, and never shows the retired vector storage widget', () => {
    render(<DataSourcesScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('SOURCES')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deploy Pipeline' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Data Sources' })).toBeInTheDocument()
    expect(screen.queryByText('VECTOR STORAGE')).not.toBeInTheDocument()
  })

  it('does not render the System Capacity widget (temporarily removed from this screen)', async () => {
    render(<DataSourcesScreen onNavigate={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Data Sources' })).toBeInTheDocument()
    expect(screen.queryByText('SYSTEM CAPACITY')).not.toBeInTheDocument()
  })
})

describe('DataSourcesScreen deletion (004-delete-source-documents)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deletes a document end-to-end via the row delete control', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/api/corpora')) {
          return jsonResponse({
            corpora: [
              { id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' },
            ],
          })
        }
        if (href.includes('/api/system/capacity')) {
          return jsonResponse({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: null,
          })
        }
        if (href.endsWith('/api/sources/delete')) {
          return jsonResponse({
            results: [{ id: 'report.pdf', status: 'deleted', reason: null }],
          })
        }
        return jsonResponse({
          documents: [
            {
              id: 'report.pdf',
              name: 'report.pdf',
              sizeBytes: 1024,
              uploadedAt: '2026-07-13T10:00:00Z',
              status: 'processed',
            },
          ],
          rejections: [],
        })
      }),
    )

    render(<DataSourcesScreen onNavigate={vi.fn()} />)

    expect(await screen.findByText('report.pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete report.pdf' }))

    await waitFor(() => {
      expect(screen.queryByText('report.pdf')).not.toBeInTheDocument()
    })
  })
})

describe('DataSourcesScreen document-corpus association (008-corpora-management US2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetch(overrides: {
    onAttach?: () => void
    onRemove?: () => void
  } = {}) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = url.toString()
        if (href.includes('/api/corpora')) {
          return jsonResponse({
            corpora: [
              { id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' },
              { id: 'corpus-b', name: 'Corpus B', createdAt: '2026-07-14T00:05:00Z' },
            ],
          })
        }
        if (href.includes('/api/system/capacity')) {
          return jsonResponse({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: null,
          })
        }
        if (init?.method === 'POST' && href.endsWith('/corpora')) {
          overrides.onAttach?.()
          return jsonResponse(null, 204)
        }
        if (init?.method === 'DELETE' && href.includes('/corpora/')) {
          overrides.onRemove?.()
          return jsonResponse(null, 204)
        }
        return jsonResponse({
          documents: [
            {
              id: 'doc-1',
              name: 'report.pdf',
              sizeBytes: 1024,
              uploadedAt: '2026-07-13T10:00:00Z',
              status: 'processed',
            },
          ],
          rejections: [],
        })
      }),
    )
  }

  it('attaches a document to another corpus via the row control', async () => {
    const onAttach = vi.fn()
    stubFetch({ onAttach })

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('report.pdf')).toBeInTheDocument()

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: /add report\.pdf to another corpus/i }),
      'corpus-b',
    )

    await waitFor(() => expect(onAttach).toHaveBeenCalled())
  })

  it('removes a document from the active corpus via the row control', async () => {
    const onRemove = vi.fn()
    stubFetch({ onRemove })

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('report.pdf')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /remove report\.pdf from this corpus/i }),
    )

    await waitFor(() => expect(onRemove).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('report.pdf')).not.toBeInTheDocument())
  })
})

describe('DataSourcesScreen split view (021-sources-chunking-embeddings-refresh US2)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetch() {
    const deletedIds = new Set<string>()
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = url.toString()
        if (href.includes('/api/corpora')) {
          return jsonResponse({
            corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
          })
        }
        if (href.includes('/api/system/capacity')) {
          return jsonResponse({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: null,
          })
        }
        if (href.endsWith('/api/sources/delete')) {
          const body = JSON.parse((init?.body as string) ?? '{"ids":[]}') as { ids: string[] }
          body.ids.forEach((id) => deletedIds.add(id))
          return jsonResponse({
            results: body.ids.map((id) => ({ id, status: 'deleted', reason: null })),
          })
        }
        const documents = [
          { id: 'doc-a', name: 'a.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' },
          { id: 'doc-b', name: 'b.pdf', sizeBytes: 20, uploadedAt: '2026-07-14T01:05:00Z', status: 'processed' },
        ].filter((doc) => !deletedIds.has(doc.id))
        return jsonResponse({ documents, rejections: [] })
      }),
    )
  }

  it('renders a two-column split layout with an empty right-side placeholder before any selection', async () => {
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)

    expect(await screen.findByText('a.pdf')).toBeInTheDocument()
    const leftPane = screen.getByTestId('sources-left-pane')
    const rightPane = screen.getByTestId('sources-right-pane')
    expect(within(leftPane).getByText('a.pdf')).toBeInTheDocument()
    expect(within(rightPane).getByTestId('source-preview-empty')).toBeInTheDocument()
  })

  it('selecting a document from the list renders its PDF preview on the right', async () => {
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))

    const rightPane = screen.getByTestId('sources-right-pane')
    expect(within(rightPane).getByTestId('mock-pdf-document')).toHaveTextContent(
      '/api/sources/doc-a/file',
    )
  })

  it('switches the preview when a different document is selected', async () => {
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))
    await userEvent.click(screen.getByRole('button', { name: 'b.pdf' }))

    const rightPane = screen.getByTestId('sources-right-pane')
    expect(within(rightPane).getByTestId('mock-pdf-document')).toHaveTextContent(
      '/api/sources/doc-b/file',
    )
  })

  it('keeps the current preview undisturbed when a new document is uploaded', async () => {
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))
    expect(
      within(screen.getByTestId('sources-right-pane')).getByTestId('mock-pdf-document'),
    ).toHaveTextContent('/api/sources/doc-a/file')

    const file = new File(['%PDF-1.4'], 'new.pdf', { type: 'application/pdf' })
    const input = screen.getByTestId('upload-browse-input')
    await userEvent.upload(input, file)

    expect(
      within(screen.getByTestId('sources-right-pane')).getByTestId('mock-pdf-document'),
    ).toHaveTextContent('/api/sources/doc-a/file')
  })

  it('clears the preview back to the empty placeholder when the previewed document is deleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))
    expect(
      within(screen.getByTestId('sources-right-pane')).getByTestId('mock-pdf-document'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Delete a.pdf' }))

    await waitFor(() =>
      expect(
        within(screen.getByTestId('sources-right-pane')).getByTestId('source-preview-empty'),
      ).toBeInTheDocument(),
    )
  })
})

describe('DataSourcesScreen PDF preview fullscreen (023-pdf-fullscreen-chunk-view US1)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/api/corpora')) {
          return jsonResponse({
            corpora: [{ id: 'corpus-a', name: 'Corpus A', createdAt: '2026-07-14T00:00:00Z' }],
          })
        }
        if (href.includes('/api/system/capacity')) {
          return jsonResponse({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: null,
          })
        }
        return jsonResponse({
          documents: [
            { id: 'doc-a', name: 'a.pdf', sizeBytes: 10, uploadedAt: '2026-07-14T01:00:00Z', status: 'processed' },
            { id: 'doc-b', name: 'b.pdf', sizeBytes: 20, uploadedAt: '2026-07-14T01:05:00Z', status: 'processed' },
          ],
          rejections: [],
        })
      }),
    )
  }

  it('expands the right pane to full width and hides the left pane when fullscreen is toggled on', async () => {
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))

    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))

    expect(screen.queryByTestId('sources-left-pane')).not.toBeInTheDocument()
    expect(screen.getByTestId('sources-right-pane').className).toMatch(/w-full/)
  })

  it('restores the normal split layout when restore is clicked', async () => {
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))

    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))
    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))

    expect(screen.getByTestId('sources-left-pane')).toBeInTheDocument()
    expect(screen.getByTestId('sources-right-pane').className).toMatch(/w-1\/2/)
  })

  it('does not carry a stale fullscreen state over to a newly selected document', async () => {
    // The document list (the only way to change selection) is hidden while fullscreen, so a
    // document change can only happen after restoring — this guards against the restored state
    // regressing back into fullscreen once a new document is selected (FR-004).
    stubFetch()

    render(<DataSourcesScreen onNavigate={vi.fn()} />)
    expect(await screen.findByText('a.pdf')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'a.pdf' }))
    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))
    await userEvent.click(screen.getByTestId('source-preview-fullscreen-toggle'))

    await userEvent.click(screen.getByRole('button', { name: 'b.pdf' }))

    expect(screen.getByTestId('sources-left-pane')).toBeInTheDocument()
    expect(screen.getByTestId('sources-right-pane').className).toMatch(/w-1\/2/)
  })
})
