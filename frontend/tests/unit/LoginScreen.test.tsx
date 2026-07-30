import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginScreen } from '../../src/components/auth/LoginScreen'
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

describe('LoginScreen', () => {
  it('submits email and password via useAuth().login', async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    mockAuth({ login })

    render(<LoginScreen onSwitchToSignup={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'person@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(login).toHaveBeenCalledWith('person@example.com', 'hunter22')
  })

  it('shows an inline error on failure without navigating away', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Incorrect email or password'))
    mockAuth({ login })

    render(<LoginScreen onSwitchToSignup={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/email/i), 'person@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect email or password/i)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('offers a link to switch to sign-up', async () => {
    const onSwitchToSignup = vi.fn()
    mockAuth()

    render(<LoginScreen onSwitchToSignup={onSwitchToSignup} />)

    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(onSwitchToSignup).toHaveBeenCalled()
  })
})
