import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../../src/context/AuthContext'
import { apiFetch, getStoredToken, setStoredToken } from '../../src/lib/apiClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('AuthContext — initial session check', () => {
  it('sets currentUser when GET /api/auth/me succeeds', async () => {
    setStoredToken('existing-token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ id: 'user-1', email: 'person@example.com' })),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toEqual({ id: 'user-1', email: 'person@example.com' })
  })

  it('leaves currentUser null when GET /api/auth/me returns 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'Not authenticated' }, 401)),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUser).toBeNull()
  })
})

describe('AuthContext — signup/login/logout', () => {
  it('signup stores the token and sets currentUser', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        if (url.toString().includes('/signup')) {
          return jsonResponse({ user: { id: 'u1', email: 'new@example.com' }, token: 'tok-1' }, 201)
        }
        if (url.toString().includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: false, maskedKey: null })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.signup('new@example.com', 'hunter22')
    })

    expect(result.current.currentUser).toEqual({ id: 'u1', email: 'new@example.com' })
    expect(getStoredToken()).toBe('tok-1')
  })

  it('login stores the token and sets currentUser', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        if (url.toString().includes('/login')) {
          return jsonResponse({ user: { id: 'u2', email: 'exists@example.com' }, token: 'tok-2' })
        }
        if (url.toString().includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: false, maskedKey: null })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.login('exists@example.com', 'hunter22')
    })

    expect(result.current.currentUser).toEqual({ id: 'u2', email: 'exists@example.com' })
    expect(getStoredToken()).toBe('tok-2')
  })

  it('logout clears the token and currentUser even if the network call fails', async () => {
    setStoredToken('tok-3')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        if (url.toString().includes('/me')) {
          return jsonResponse({ id: 'u3', email: 'logout-me@example.com' })
        }
        if (url.toString().includes('/logout')) {
          throw new Error('network down')
        }
        if (url.toString().includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: false, maskedKey: null })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.currentUser).not.toBeNull())

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.currentUser).toBeNull()
    expect(getStoredToken()).toBeNull()
  })
})

describe('AuthContext — reacts to apiClient 401 signal', () => {
  it('signs out when any apiFetch call gets a 401 response', async () => {
    setStoredToken('tok-4')
    let meCallCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        if (url.toString().includes('/me')) {
          meCallCount += 1
          // First call (AuthContext's own mount check) succeeds; simulates the
          // session still being valid when the app loaded.
          return meCallCount === 1
            ? jsonResponse({ id: 'u4', email: 'still-here@example.com' })
            : jsonResponse({ detail: 'Not authenticated' }, 401)
        }
        if (url.toString().includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: false, maskedKey: null })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.currentUser).not.toBeNull())

    // Some unrelated apiFetch call elsewhere in the app gets rejected — apiClient
    // clears the token and notifies every subscriber, including AuthContext.
    await act(async () => {
      await apiFetch('/api/corpora')
    })

    await waitFor(() => expect(result.current.currentUser).toBeNull())
    expect(getStoredToken()).toBeNull()
  })
})

describe('AuthContext — personal Anthropic key status (025-user-profile-anthropic-key)', () => {
  it('fetches and exposes hasAnthropicKey once currentUser resolves', async () => {
    setStoredToken('tok-5')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/me')) {
          return jsonResponse({ id: 'u5', email: 'has-key@example.com' })
        }
        if (href.includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: true, maskedKey: '...wxyz' })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.hasAnthropicKey).toBe(true))
  })

  it('defaults hasAnthropicKey to false when no key is on file', async () => {
    setStoredToken('tok-6')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/me')) {
          return jsonResponse({ id: 'u6', email: 'no-key@example.com' })
        }
        if (href.includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: false, maskedKey: null })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasAnthropicKey).toBe(false)
  })

  it('refreshAnthropicKeyStatus re-fetches the status', async () => {
    setStoredToken('tok-7')
    let hasKey = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/me')) {
          return jsonResponse({ id: 'u7', email: 'refresh@example.com' })
        }
        if (href.includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey, maskedKey: hasKey ? '...wxyz' : null })
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasAnthropicKey).toBe(false)

    hasKey = true
    await act(async () => {
      await result.current.refreshAnthropicKeyStatus()
    })

    expect(result.current.hasAnthropicKey).toBe(true)
  })

  it('resets hasAnthropicKey to false on logout', async () => {
    setStoredToken('tok-8')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = url.toString()
        if (href.includes('/me')) {
          return jsonResponse({ id: 'u8', email: 'logout-key@example.com' })
        }
        if (href.includes('/api/profile/anthropic-key')) {
          return jsonResponse({ hasKey: true, maskedKey: '...wxyz' })
        }
        if (href.includes('/logout')) {
          return jsonResponse(null, 204)
        }
        return jsonResponse({ detail: 'Not authenticated' }, 401)
      }),
    )

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.hasAnthropicKey).toBe(true))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.hasAnthropicKey).toBe(false)
  })
})
