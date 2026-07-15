import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorpusProvider, useCorpus } from '../../src/context/CorpusContext'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function wrapper({ children }: { children: ReactNode }) {
  return <CorpusProvider>{children}</CorpusProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('CorpusContext', () => {
  it('loads the corpora list on mount and defaults activeCorpusId to the first corpus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          corpora: [
            { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
            { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useCorpus(), { wrapper })

    await waitFor(() => expect(result.current.corpora).toHaveLength(2))
    expect(result.current.activeCorpusId).toBe('a')
    expect(result.current.isLoading).toBe(false)
  })

  it('restores the previously selected corpus from localStorage', async () => {
    window.localStorage.setItem('byorag:activeCorpusId', 'b')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          corpora: [
            { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
            { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useCorpus(), { wrapper })

    await waitFor(() => expect(result.current.corpora).toHaveLength(2))
    expect(result.current.activeCorpusId).toBe('b')
  })

  it('has no active corpus when none exist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ corpora: [] })))

    const { result } = renderHook(() => useCorpus(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.activeCorpusId).toBeNull()
  })

  it('selectCorpus updates activeCorpusId and persists it to localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          corpora: [
            { id: 'a', name: 'Corpus A', createdAt: '2026-07-14T10:00:00Z' },
            { id: 'b', name: 'Corpus B', createdAt: '2026-07-14T10:05:00Z' },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useCorpus(), { wrapper })
    await waitFor(() => expect(result.current.corpora).toHaveLength(2))

    act(() => {
      result.current.selectCorpus('b')
    })

    expect(result.current.activeCorpusId).toBe('b')
    expect(window.localStorage.getItem('byorag:activeCorpusId')).toBe('b')
  })

  it('createCorpus adds the new corpus to the list and makes it active', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ id: 'new', name: 'New Corpus', createdAt: '2026-07-14T11:00:00Z' }, 201)
      }
      return jsonResponse({ corpora: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useCorpus(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.createCorpus('New Corpus')
    })

    expect(result.current.corpora.map((c) => c.name)).toEqual(['New Corpus'])
    expect(result.current.activeCorpusId).toBe('new')
  })
})
