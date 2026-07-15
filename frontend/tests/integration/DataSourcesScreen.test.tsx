import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataSourcesScreen } from '../../src/components/sources/DataSourcesScreen'
import { CorpusProvider } from '../../src/context/CorpusContext'

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

  it('renders the system capacity widget with hardware and estimate data from the API', async () => {
    render(<DataSourcesScreen onNavigate={vi.fn()} />)

    expect(await screen.findByText('SYSTEM CAPACITY')).toBeInTheDocument()
    expect(await screen.findByText(/Test Processor/)).toBeInTheDocument()
    expect(screen.getByText(/no dedicated gpu/i)).toBeInTheDocument()
    expect(screen.getByText(/100 PDFs/)).toBeInTheDocument()
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
