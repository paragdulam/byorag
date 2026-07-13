import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataSourcesScreen } from '../../src/components/sources/DataSourcesScreen'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
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
