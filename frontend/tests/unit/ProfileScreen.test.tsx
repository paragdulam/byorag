import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProfileScreen } from '../../src/components/profile/ProfileScreen'
import { useAuth } from '../../src/context/AuthContext'
import { CorpusProvider } from '../../src/context/CorpusContext'

vi.mock('../../src/context/AuthContext')

const mockedUseAuth = vi.mocked(useAuth)

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockedUseAuth.mockReturnValue({
    currentUser: { id: 'user-1', email: 'person@example.com', createdAt: '2026-07-14T00:00:00Z' },
    hasAnthropicKey: false,
    isLoading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshAnthropicKeyStatus: vi.fn(),
    ...overrides,
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

function stubKeyFetch(
  initialStatus: { hasKey: boolean; maskedKey: string | null } = { hasKey: false, maskedKey: null },
  putHandler?: (apiKey: string) => Response,
) {
  let status = initialStatus
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString()
    if (url.includes('/api/profile/anthropic-key') && init?.method === 'PUT') {
      const body = JSON.parse(init.body as string) as { apiKey: string }
      const response = putHandler ? putHandler(body.apiKey) : jsonResponse({ hasKey: true, maskedKey: '...wxyz' })
      if (response.ok) {
        status = (await response.clone().json()) as { hasKey: boolean; maskedKey: string | null }
      }
      return response
    }
    if (url.includes('/api/profile/anthropic-key') && init?.method === 'DELETE') {
      status = { hasKey: false, maskedKey: null }
      return new Response(null, { status: 204 })
    }
    if (url.includes('/api/profile/anthropic-key')) {
      return jsonResponse(status)
    }
    return jsonResponse({ corpora: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderScreen() {
  return render(
    <CorpusProvider>
      <ProfileScreen onNavigate={vi.fn()} />
    </CorpusProvider>,
  )
}

describe('ProfileScreen — account info & logout (US1)', () => {
  it("displays the current user's email and account-creation date", () => {
    mockAuth({
      currentUser: { id: 'user-1', email: 'person@example.com', createdAt: '2026-07-14T00:00:00Z' },
    })

    renderScreen()

    expect(screen.getByText('person@example.com')).toBeInTheDocument()
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('calls useAuth().logout() when Log out is clicked', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    mockAuth({ logout })

    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: /log out/i }))

    expect(logout).toHaveBeenCalledOnce()
  })
})

describe('ProfileScreen — Anthropic key form (US2)', () => {
  it('submits a new key and shows the masked value on success', async () => {
    mockAuth({ hasAnthropicKey: false })
    stubKeyFetch({ hasKey: false, maskedKey: null }, () => jsonResponse({ hasKey: true, maskedKey: '...wxyz' }))

    renderScreen()
    await waitFor(() => expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument())

    await userEvent.type(screen.getByLabelText(/anthropic api key/i), 'sk-ant-testwxyz')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('...wxyz')).toBeInTheDocument()
  })

  it('calls refreshAnthropicKeyStatus() after a successful save', async () => {
    const refreshAnthropicKeyStatus = vi.fn()
    mockAuth({ hasAnthropicKey: false, refreshAnthropicKeyStatus })
    stubKeyFetch({ hasKey: false, maskedKey: null }, () => jsonResponse({ hasKey: true, maskedKey: '...wxyz' }))

    renderScreen()
    await waitFor(() => expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/anthropic api key/i), 'sk-ant-testwxyz')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(refreshAnthropicKeyStatus).toHaveBeenCalledOnce())
  })

  it('shows an inline error and keeps the input on a rejected (invalid) key, without clearing it', async () => {
    mockAuth({ hasAnthropicKey: false })
    stubKeyFetch({ hasKey: false, maskedKey: null }, () =>
      jsonResponse({ detail: 'Anthropic rejected this API key' }, 400),
    )

    renderScreen()
    await waitFor(() => expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument())
    await userEvent.type(screen.getByLabelText(/anthropic api key/i), 'sk-ant-badxxxx')
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejected/i)
    expect(screen.getByLabelText(/anthropic api key/i)).toHaveValue('sk-ant-badxxxx')
  })

  it('shows the masked key (not an empty-state form) when a key is already on file', async () => {
    mockAuth({ hasAnthropicKey: true })
    stubKeyFetch({ hasKey: true, maskedKey: '...wxyz' })

    renderScreen()

    expect(await screen.findByText('...wxyz')).toBeInTheDocument()
    expect(screen.queryByLabelText(/anthropic api key/i)).not.toBeInTheDocument()
  })
})

describe('ProfileScreen — delete Anthropic key (US3)', () => {
  it('removes the stored key and shows the empty-state form again after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockAuth({ hasAnthropicKey: true })
    stubKeyFetch({ hasKey: true, maskedKey: '...wxyz' })

    renderScreen()
    await screen.findByText('...wxyz')

    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(await screen.findByLabelText(/anthropic api key/i)).toBeInTheDocument()
    expect(screen.queryByText('...wxyz')).not.toBeInTheDocument()
  })

  it('calls refreshAnthropicKeyStatus() after deleting', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const refreshAnthropicKeyStatus = vi.fn()
    mockAuth({ hasAnthropicKey: true, refreshAnthropicKeyStatus })
    stubKeyFetch({ hasKey: true, maskedKey: '...wxyz' })

    renderScreen()
    await screen.findByText('...wxyz')
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => expect(refreshAnthropicKeyStatus).toHaveBeenCalledOnce())
  })

  it('does nothing when the confirmation is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockAuth({ hasAnthropicKey: true })
    const fetchMock = stubKeyFetch({ hasKey: true, maskedKey: '...wxyz' })

    renderScreen()
    await screen.findByText('...wxyz')
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))

    expect(screen.getByText('...wxyz')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/profile/anthropic-key'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('has no Delete button when there is no key to delete', async () => {
    mockAuth({ hasAnthropicKey: false })
    stubKeyFetch({ hasKey: false, maskedKey: null })

    renderScreen()
    await waitFor(() => expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
