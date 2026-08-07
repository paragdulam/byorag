import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../../src/app/App'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

// tests/setup.ts resets window.history to "/" before every test.
describe('App auth gate (024-user-authentication FR-006)', () => {
  it('signed-out: renders the login screen and no BYORAG screen is reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/auth/me')) {
          return jsonResponse({ detail: 'Not authenticated' }, 401)
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Log in to BYORAG' })).toBeInTheDocument()
    expect(screen.queryByText('SOURCES')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })

  it('signed-out: can switch to the signup screen and back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'Not authenticated' }, 401)),
    )
    const { default: userEvent } = await import('@testing-library/user-event')

    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sign up/i }))
    expect(screen.getByRole('heading', { name: 'Create your BYORAG account' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /log in/i }))
    expect(screen.getByRole('heading', { name: 'Log in to BYORAG' })).toBeInTheDocument()
  })

  it('signed-in: renders the existing screen-switcher exactly as before', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        if (url.includes('/api/auth/me')) {
          return jsonResponse({ id: 'user-1', email: 'signed-in@example.com' })
        }
        if (url.includes('/api/corpora')) {
          return jsonResponse({
            corpora: [{ id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' }],
          })
        }
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Data Sources' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Log in to BYORAG' })).not.toBeInTheDocument()
    expect(screen.getByText('SOURCES')).toBeInTheDocument()
  })

  // 032-deep-linking FR-008: opening a deep link while signed out must land on that same
  // location after signing in, not the default screen. Neither LoginScreen nor SignupScreen
  // ever touches the URL (research.md §5), so this only requires that the router reads whatever
  // is already in the address bar once AuthenticatedApp mounts post-login.
  it('signed-out deep link: after logging in, lands on the originally requested screen/corpus', async () => {
    window.history.pushState({}, '', '/playground/default-corpus')
    let signedIn = false

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString()

        if (url.includes('/api/auth/login')) {
          signedIn = true
          return jsonResponse({
            user: { id: 'user-1', email: 'signed-in@example.com', createdAt: '2026-07-14T00:00:00Z' },
            token: 'test-token',
          })
        }
        if (url.includes('/api/auth/me')) {
          return signedIn
            ? jsonResponse({ id: 'user-1', email: 'signed-in@example.com', createdAt: '2026-07-14T00:00:00Z' })
            : jsonResponse({ detail: 'Not authenticated' }, 401)
        }
        if (url.includes('/api/corpora')) {
          return jsonResponse({
            corpora: [{ id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' }],
          })
        }
        void init
        return jsonResponse({ documents: [], rejections: [] })
      }),
    )
    const { default: userEvent } = await import('@testing-library/user-event')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Log in to BYORAG' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Email'), 'signed-in@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22')
    await userEvent.click(screen.getByRole('button', { name: 'Log In' }))

    expect(await screen.findByRole('heading', { name: 'Playground' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/playground/default-corpus')
  })
})
