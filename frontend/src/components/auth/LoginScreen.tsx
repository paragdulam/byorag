import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export interface LoginScreenProps {
  onSwitchToSignup: () => void
}

export function LoginScreen({ onSwitchToSignup }: LoginScreenProps) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-surface p-8">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-outline-variant bg-surface-container p-8"
      >
        <h1 className="text-2xl font-bold text-on-surface">Log in to BYORAG</h1>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm text-on-surface-variant" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
          />
        </div>

        <div>
          <label className="block text-sm text-on-surface-variant" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
        >
          Log In
        </button>

        <button
          type="button"
          onClick={onSwitchToSignup}
          className="text-sm text-on-surface-variant underline"
        >
          Need an account? Sign Up
        </button>
      </form>
    </div>
  )
}
