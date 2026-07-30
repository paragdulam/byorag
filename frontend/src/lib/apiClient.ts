const TOKEN_STORAGE_KEY = 'byorag:sessionToken'

type UnauthorizedListener = () => void

let unauthorizedListeners: UnauthorizedListener[] = []

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string | null): void {
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}

/**
 * Subscribes to "the current session just got rejected by the server" (a `401` seen by
 * `apiFetch`) — `AuthContext` uses this to drop the app back to the signed-out state
 * immediately, rather than waiting for the next explicit user action
 * (024-user-authentication research.md §6). Returns an unsubscribe function.
 */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.push(listener)
  return () => {
    unauthorizedListeners = unauthorizedListeners.filter((existing) => existing !== listener)
  }
}

/**
 * Thin wrapper around `fetch` that attaches the stored session token as
 * `Authorization: Bearer <token>` when one exists, and reacts to a `401` by clearing
 * the token and notifying every `onUnauthorized` subscriber. Every existing
 * `lib/*Api.ts` module calls this instead of the global `fetch` directly
 * (024-user-authentication research.md §6).
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, { ...init, headers })

  if (response.status === 401) {
    setStoredToken(null)
    unauthorizedListeners.forEach((listener) => listener())
  }

  return response
}

/**
 * Appends the stored session token as a `?token=` query parameter — used only by the
 * two `EventSource`-based streaming endpoints (chunking/embeddings run+save progress),
 * since `EventSource` cannot send custom headers at all (024-user-authentication
 * research.md §5).
 */
export function appendTokenQueryParam(url: string): string {
  const token = getStoredToken()
  if (!token) {
    return url
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${encodeURIComponent(token)}`
}
