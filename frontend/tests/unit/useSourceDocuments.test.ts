import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSourceDocuments } from '../../src/hooks/useSourceDocuments'

function makeFile(name: string, sizeBytes = 1024, type = 'application/pdf'): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('useSourceDocuments (US1: API-backed persistence)', () => {
  it('fetches the document list from the API on mount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          documents: [
            {
              id: 'existing.pdf',
              name: 'existing.pdf',
              sizeBytes: 1024,
              uploadedAt: '2026-07-04T10:00:00Z',
              status: 'processed',
            },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useSourceDocuments('corpus-1'))

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })

    expect(result.current.documents[0].name).toBe('existing.pdf')
    // Mount-fetched documents must render as already "processed" immediately
    // -- no simulated processing delay applies to files that were already
    // saved to disk before the page loaded (FR-007).
    expect(result.current.documents[0].status).toBe('processed')
  })

  it('uploads files via the API from addFiles and adds the returned documents to the list', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!init?.method) {
        return jsonResponse({ documents: [] })
      }
      return jsonResponse({
        documents: [
          {
            id: 'new.pdf',
            name: 'new.pdf',
            sizeBytes: 2048,
            uploadedAt: '2026-07-04T11:00:00Z',
            status: 'processed',
          },
        ],
        rejections: [],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useSourceDocuments('corpus-1'))

    await waitFor(() => expect(result.current.documents).toHaveLength(0))

    await act(async () => {
      result.current.addFiles([makeFile('new.pdf')])
    })

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(1)
    })
    expect(result.current.documents[0].name).toBe('new.pdf')

    const uploadCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
    )
    expect(uploadCall).toBeDefined()
    expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData)
  })

  it('adds server-returned rejections to state (e.g. a save-failed disk error the client could not have predicted)', async () => {
    // Uses a file that passes client-side pre-validation (a well-formed
    // PDF under the size limit) so the rejection can only have come back
    // from the server response, not the existing client-side pre-check.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (!init?.method) {
          return jsonResponse({ documents: [] })
        }
        return jsonResponse({
          documents: [],
          rejections: [{ fileName: 'report.pdf', reason: 'save-failed' }],
        })
      }),
    )

    const { result } = renderHook(() => useSourceDocuments('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(0))

    await act(async () => {
      result.current.addFiles([makeFile('report.pdf')])
    })

    await waitFor(() => {
      expect(result.current.rejections).toHaveLength(1)
    })
    expect(result.current.rejections[0]).toEqual({ fileName: 'report.pdf', reason: 'save-failed' })
    // The failed upload must not leave a phantom "processing" entry behind.
    expect(result.current.documents).toHaveLength(0)
  })
})

describe('useSourceDocuments (004: deleteDocuments)', () => {
  function stubFetchForDelete(deleteResults: unknown[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const href = url.toString()
        if (href.endsWith('/api/sources/delete')) {
          return jsonResponse({ results: deleteResults })
        }
        if (!init?.method) {
          return jsonResponse({
            documents: [
              {
                id: 'existing.pdf',
                name: 'existing.pdf',
                sizeBytes: 1024,
                uploadedAt: '2026-07-04T10:00:00Z',
                status: 'processed',
              },
            ],
          })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )
  }

  it('removes the document from state when the server reports it deleted', async () => {
    stubFetchForDelete([{ id: 'existing.pdf', status: 'deleted', reason: null }])

    const { result } = renderHook(() => useSourceDocuments('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    await act(async () => {
      result.current.deleteDocuments(['existing.pdf'])
    })

    await waitFor(() => {
      expect(result.current.documents).toHaveLength(0)
    })
  })

  it('leaves the document in state and records a deletion error when the server reports failure', async () => {
    stubFetchForDelete([
      { id: 'existing.pdf', status: 'failed', reason: 'Permission denied' },
    ])

    const { result } = renderHook(() => useSourceDocuments('corpus-1'))
    await waitFor(() => expect(result.current.documents).toHaveLength(1))

    await act(async () => {
      result.current.deleteDocuments(['existing.pdf'])
    })

    await waitFor(() => {
      expect(result.current.deletionErrors).toHaveLength(1)
    })
    expect(result.current.deletionErrors[0]).toEqual({
      id: 'existing.pdf',
      status: 'failed',
      reason: 'Permission denied',
    })
    expect(result.current.documents).toHaveLength(1)
  })
})
