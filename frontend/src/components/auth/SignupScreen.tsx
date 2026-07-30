import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export interface SignupScreenProps {
  onSwitchToLogin: () => void
}

export function SignupScreen({ onSwitchToLogin }: SignupScreenProps) {
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await signup(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.')
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
        <h1 className="text-2xl font-bold text-on-surface">Create your BYORAG account</h1>

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm text-on-surface-variant" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
          />
        </div>

        <div>
          <label className="block text-sm text-on-surface-variant" htmlFor="signup-password">
            Password
          </label>
          <input
            id="signup-password"
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
          Sign Up
        </button>

        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm text-on-surface-variant underline"
        >
          Already have an account? Log In
        </button>
      </form>
    </div>
  )
}
