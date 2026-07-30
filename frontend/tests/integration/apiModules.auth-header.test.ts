import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCorpora } from '../../src/lib/corporaApi'
import { setStoredToken } from '../../src/lib/apiClient'

describe('lib/*Api.ts modules send the session token end-to-end (024-user-authentication T039)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('corporaApi.listCorpora sends Authorization: Bearer <token> once a token is stored', async () => {
    setStoredToken('the-stored-token')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ corpora: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await listCorpora()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer the-stored-token')
  })

  it('corporaApi.listCorpora sends no Authorization header when signed out', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ corpora: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await listCorpora()

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.has('Authorization')).toBe(false)
  })
})
