import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SignupScreen } from '../../src/components/auth/SignupScreen'
import { useAuth } from '../../src/context/AuthContext'

vi.mock('../../src/context/AuthContext')

const mockedUseAuth = vi.mocked(useAuth)

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockedUseAuth.mockReturnValue({
    currentUser: null,
    isLoading: false,
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  })
}

describe('SignupScreen', () => {
  it('submits email and password via useAuth().signup', async () => {
    const signup = vi.fn().mockResolvedValue(undefined)
    mockAuth({ signup })

    render(<SignupScreen onSwitchToLogin={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'new@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
    await userEvent.click(screen.getByRole('button', { name: /^sign up$/i }))

    expect(signup).toHaveBeenCalledWith('new@example.com', 'hunter22')
  })

  it('shows an inline error on a duplicate-email failure', async () => {
    const signup = vi.fn().mockRejectedValue(new Error("An account with email 'dup@example.com' already exists"))
    mockAuth({ signup })

    render(<SignupScreen onSwitchToLogin={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'dup@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
    await userEvent.click(screen.getByRole('button', { name: /^sign up$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i)
  })

  it('offers a link to switch to login', async () => {
    const onSwitchToLogin = vi.fn()
    mockAuth()

    render(<SignupScreen onSwitchToLogin={onSwitchToLogin} />)

    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(onSwitchToLogin).toHaveBeenCalled()
  })
})
