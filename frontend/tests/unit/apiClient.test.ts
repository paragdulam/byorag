import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  apiFetch,
  appendTokenQueryParam,
  getStoredToken,
  onUnauthorized,
  setStoredToken,
} from '../../src/lib/apiClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('apiClient — token storage', () => {
  it('round-trips a token through localStorage', () => {
    expect(getStoredToken()).toBeNull()

    setStoredToken('abc123')
    expect(getStoredToken()).toBe('abc123')

    setStoredToken(null)
    expect(getStoredToken()).toBeNull()
  })
})

describe('apiClient — apiFetch', () => {
  it('attaches Authorization when a token is stored', async () => {
    setStoredToken('abc123')
    const fetchSpy = vi.fn(async () => jsonResponse({}))
    vi.stubGlobal('fetch', fetchSpy)

    await apiFetch('/api/corpora')

    const [, init] = fetchSpy.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer abc123')
  })

  it('omits Authorization when no token is stored', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({}))
    vi.stubGlobal('fetch', fetchSpy)

    await apiFetch('/api/corpora')

    const [, init] = fetchSpy.mock.calls[0]
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBeNull()
  })

  it('clears the stored token and notifies listeners on a 401 response', async () => {
    setStoredToken('abc123')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'Not authenticated' }, 401)),
    )
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    await apiFetch('/api/corpora')

    expect(getStoredToken()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('does not notify listeners on a non-401 response', async () => {
    setStoredToken('abc123')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))
    const listener = vi.fn()
    const unsubscribe = onUnauthorized(listener)

    await apiFetch('/api/corpora')

    expect(getStoredToken()).toBe('abc123')
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})

describe('apiClient — appendTokenQueryParam', () => {
  it('appends the token as a query parameter when one is stored', () => {
    setStoredToken('abc123')

    expect(appendTokenQueryParam('/api/chunking/run/stream')).toBe(
      '/api/chunking/run/stream?token=abc123',
    )
    expect(appendTokenQueryParam('/api/chunking/run/stream?chunkSize=512')).toBe(
      '/api/chunking/run/stream?chunkSize=512&token=abc123',
    )
  })

  it('returns the url unchanged when no token is stored', () => {
    expect(appendTokenQueryParam('/api/chunking/run/stream')).toBe('/api/chunking/run/stream')
  })
})
