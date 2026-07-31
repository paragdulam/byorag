import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { useAuth } from '../../context/AuthContext'
import * as profileApi from '../../lib/profileApi'
import type { AnthropicKeyStatus } from '../../lib/profileApi'

export interface ProfileScreenProps {
  onNavigate: (screen: ScreenId) => void
}

function formatCreatedAt(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function AnthropicKeySection() {
  const { refreshAnthropicKeyStatus } = useAuth()
  const [status, setStatus] = useState<AnthropicKeyStatus | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    profileApi.getAnthropicKeyStatus().then((result) => {
      if (!cancelled) {
        setStatus(result)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await profileApi.setAnthropicKey(inputValue)
      setStatus(result)
      setInputValue('')
      setIsEditing(false)
      await refreshAnthropicKeyStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the key. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete your Anthropic API key? Playground and Metrics will be disabled until you add a new one.')) {
      return
    }
    await profileApi.deleteAnthropicKey()
    setStatus({ hasKey: false, maskedKey: null })
    await refreshAnthropicKeyStatus()
  }

  const showForm = status !== null && (!status.hasKey || isEditing)

  return (
    <div className="mt-8 max-w-lg rounded-lg border border-outline-variant bg-surface-container p-6">
      <h2 className="text-sm font-medium uppercase tracking-widest text-on-surface-variant">
        Anthropic API Key
      </h2>
      <p className="mt-1 text-xs text-on-surface-variant">
        Used for your own Playground answer generation and Metrics quality scoring. Never
        shown again in full once saved.
      </p>

      {status && !showForm && (
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="font-mono text-sm text-on-surface">{status.maskedKey}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-outline-variant px-3 py-1 text-sm text-on-surface hover:bg-surface-container-high"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              className="rounded border border-outline-variant px-3 py-1 text-sm text-error hover:bg-surface-container-high"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <div>
            <label className="block text-sm text-on-surface-variant" htmlFor="anthropic-api-key">
              Anthropic API Key
            </label>
            <input
              id="anthropic-api-key"
              type="password"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
            >
              Save
            </button>
            {status?.hasKey && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false)
                  setError(null)
                  setInputValue('')
                }}
                className="rounded border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

export function ProfileScreen({ onNavigate }: ProfileScreenProps) {
  const { currentUser, logout } = useAuth()

  return (
    <AppShell activeScreen="profile" onNavigate={onNavigate}>
      <h1 className="text-4xl font-bold tracking-tight text-on-surface">Profile</h1>

      <div className="mt-8 max-w-lg rounded-lg border border-outline-variant bg-surface-container p-6">
        <h2 className="text-sm font-medium uppercase tracking-widest text-on-surface-variant">
          Account
        </h2>
        {currentUser && (
          <dl className="mt-4 flex flex-col gap-3">
            <div>
              <dt className="text-xs text-on-surface-variant">Email</dt>
              <dd className="text-on-surface">{currentUser.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Member since</dt>
              <dd className="text-on-surface">{formatCreatedAt(currentUser.createdAt)}</dd>
            </div>
          </dl>
        )}

        <button
          type="button"
          onClick={() => logout()}
          className="mt-6 rounded border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-high"
        >
          Log out
        </button>
      </div>

      <AnthropicKeySection />
    </AppShell>
  )
}
