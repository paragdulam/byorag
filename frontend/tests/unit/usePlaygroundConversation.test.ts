import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePlaygroundConversation } from '../../src/hooks/usePlaygroundConversation'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const DOCUMENTS_RESPONSE = {
  documents: [
    {
      id: 'report.pdf',
      name: 'report.pdf',
      sizeBytes: 1024,
      uploadedAt: '2026-07-13T10:00:00Z',
      status: 'processed',
    },
  ],
}

const CONTEXT_RESPONSE = {
  documentId: 'report.pdf',
  chunkingStrategy: 'fixed-size',
  embeddingModel: 'bert',
}

function makeTurn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'turn-1',
    question: 'What is this about?',
    queryEmbedding: [0.1, 0.2],
    chunks: [{ chunkId: 'chunk-1', index: 0, content: 'some content', score: 0.9 }],
    llmProvider: null,
    llmModel: null,
    prompt: null,
    answer: null,
    error: null,
    createdAt: '2026-07-15T10:00:00Z',
    answeredAt: null,
    ...overrides,
  }
}

function stubFetch(
  handlers: Partial<{
    createTurn: () => Response
    generate: () => Response
    listTurns: () => Response
  }> = {},
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.includes('/api/playground/context')) {
        return jsonResponse(CONTEXT_RESPONSE)
      }
      if (url.includes('/api/sources')) {
        return jsonResponse(DOCUMENTS_RESPONSE)
      }
      if (url.includes('/generate') && method === 'POST') {
        return handlers.generate ? handlers.generate() : jsonResponse(makeTurn({ answer: 'An answer.' }))
      }
      if (url.includes('/api/playground/turns?') && method === 'GET') {
        return handlers.listTurns ? handlers.listTurns() : jsonResponse({ documentId: 'report.pdf', turns: [] })
      }
      if (url.endsWith('/api/playground/turns') && method === 'POST') {
        return handlers.createTurn ? handlers.createTurn() : jsonResponse(makeTurn(), 201)
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }),
  )
}

describe('usePlaygroundConversation — send/generate/retry/busy-lock (017 US1)', () => {
  it('appends a new turn to the conversation on a successful send, and its answer eventually appears with no manual generate() call (031-playground-metrics-redesign US1)', async () => {
    stubFetch()

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))

    act(() => result.current.send('What is this about?'))

    await waitFor(() => expect(result.current.turns).toHaveLength(1))
    expect(result.current.turns[0].question).toBe('What is this about?')

    await waitFor(() => expect(result.current.turns[0].answer).toBe('An answer.'))
  })

  it('calls generate automatically, exactly once, with the new turn\'s id, immediately after a successful send (031-playground-metrics-redesign US1 FR-005)', async () => {
    const generateSpy = vi.fn(() => jsonResponse(makeTurn({ answer: 'An answer.' })))
    stubFetch({ generate: generateSpy })

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))

    act(() => result.current.send('What is this about?'))

    await waitFor(() => expect(result.current.turns[0]?.answer).toBe('An answer.'))
    expect(generateSpy).toHaveBeenCalledTimes(1)
  })

  it('does not send when the query is empty or whitespace-only', async () => {
    stubFetch()

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))

    act(() => result.current.send('   '))

    expect(result.current.turns).toHaveLength(0)
    expect(result.current.isBusy).toBe(false)
  })

  it('sets isBusy while a send is in flight and clears it afterward', async () => {
    let resolveCreate: (value: Response) => void = () => {}
    stubFetch({
      createTurn: () =>
        new Promise<Response>((resolve) => {
          resolveCreate = resolve
        }) as unknown as Response,
    })

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))

    act(() => result.current.send('a question'))
    await waitFor(() => expect(result.current.isBusy).toBe(true))

    act(() => resolveCreate(jsonResponse(makeTurn(), 201)))
    await waitFor(() => expect(result.current.isBusy).toBe(false))
  })

  it('updates the matching turn in place once auto-generation succeeds, without duplicating turns', async () => {
    stubFetch({
      generate: () => jsonResponse(makeTurn({ answer: 'The final answer.', llmProvider: 'anthropic' })),
    })

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))
    act(() => result.current.send('What is this about?'))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    await waitFor(() => expect(result.current.turns[0].answer).toBe('The final answer.'))
    expect(result.current.turns).toHaveLength(1)
  })

  it('records an error on the turn when auto-generation fails, without losing other turns, and offers a retry that can be called manually (031-playground-metrics-redesign FR-008)', async () => {
    stubFetch({ generate: () => jsonResponse({ detail: 'upstream failure' }, 502) })

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))
    act(() => result.current.send('What is this about?'))
    await waitFor(() => expect(result.current.turns).toHaveLength(1))

    await waitFor(() => expect(result.current.turns[0].error).toBeTruthy())
    expect(result.current.turns[0].answer).toBeNull()
    expect(result.current.isBusy).toBe(false)

    // The manual generate() call still works as a retry path (FR-008) — it's only the
    // automatic first attempt that's new, not the ability to retry by calling it again.
    stubFetch({ generate: () => jsonResponse(makeTurn({ answer: 'Recovered answer.' })) })
    act(() => result.current.generate(result.current.turns[0].id))
    await waitFor(() => expect(result.current.turns[0].answer).toBe('Recovered answer.'))
  })
})

describe('usePlaygroundConversation — persisted conversation reload (017 US3)', () => {
  it('automatically loads a document\'s prior conversation on mount', async () => {
    const priorTurn = makeTurn({ id: 'prior-turn', question: 'A question asked last time' })
    stubFetch({ listTurns: () => jsonResponse({ documentId: 'report.pdf', turns: [priorTurn] }) })

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))

    await waitFor(() => expect(result.current.turns).toHaveLength(1))
    expect(result.current.turns[0].question).toBe('A question asked last time')
  })

  it('loads an empty conversation for a document with no prior turns', async () => {
    stubFetch()

    const { result } = renderHook(() => usePlaygroundConversation('corpus-1', 'report.pdf'))
    await waitFor(() => expect(result.current.context?.embeddingModel).toBe('bert'))

    expect(result.current.turns).toHaveLength(0)
  })

  it('loads the newly-selected document\'s own conversation when switching documents', async () => {
    const reportTurn = makeTurn({ id: 'report-turn', question: 'report.pdf question' })
    const otherTurn = makeTurn({ id: 'other-turn', question: 'doc-other question' })
    stubFetch({
      listTurns: () => jsonResponse({ documentId: 'report.pdf', turns: [reportTurn] }),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        if (url.includes('/api/playground/context')) return jsonResponse(CONTEXT_RESPONSE)
        if (url.includes('/api/sources')) return jsonResponse(DOCUMENTS_RESPONSE)
        if (url.includes('/api/playground/turns?documentId=doc-other')) {
          return jsonResponse({ documentId: 'doc-other', turns: [otherTurn] })
        }
        if (url.includes('/api/playground/turns?')) {
          return jsonResponse({ documentId: 'report.pdf', turns: [reportTurn] })
        }
        throw new Error(`Unexpected fetch: ${method} ${url}`)
      }),
    )

    const { result, rerender } = renderHook(
      ({ documentId }) => usePlaygroundConversation('corpus-1', documentId),
      { initialProps: { documentId: 'report.pdf' as string | null } },
    )
    await waitFor(() => expect(result.current.turns[0]?.question).toBe('report.pdf question'))

    rerender({ documentId: 'doc-other' })

    await waitFor(() => expect(result.current.turns[0]?.question).toBe('doc-other question'))
  })
})
