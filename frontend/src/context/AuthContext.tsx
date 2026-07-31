import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as authApi from '../lib/authApi'
import type { AuthUser } from '../lib/authApi'
import * as profileApi from '../lib/profileApi'
import { onUnauthorized, setStoredToken } from '../lib/apiClient'

export interface AuthContextValue {
  currentUser: AuthUser | null
  hasAnthropicKey: boolean
  isLoading: boolean
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAnthropicKeyStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [hasAnthropicKey, setHasAnthropicKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Best-effort: a failure here (network hiccup, session already gone) just means
  // Playground/Metrics stay gated as if there were no key, never a thrown error that
  // could break the rest of the app (025-user-profile-anthropic-key).
  const refreshAnthropicKeyStatus = useCallback(async () => {
    try {
      const status = await profileApi.getAnthropicKeyStatus()
      setHasAnthropicKey(status.hasKey)
    } catch {
      setHasAnthropicKey(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    authApi
      .me()
      .then(async (user) => {
        if (cancelled) return
        setCurrentUser(user)
        if (user) {
          await refreshAnthropicKeyStatus()
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [refreshAnthropicKeyStatus])

  useEffect(() => onUnauthorized(() => setCurrentUser(null)), [])

  const signup = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.signup(email, password)
      setStoredToken(result.token)
      setCurrentUser(result.user)
      await refreshAnthropicKeyStatus()
    },
    [refreshAnthropicKeyStatus],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password)
      setStoredToken(result.token)
      setCurrentUser(result.user)
      await refreshAnthropicKeyStatus()
    },
    [refreshAnthropicKeyStatus],
  )

  const logout = useCallback(async () => {
    // A network failure must never strand the user in a "still looks logged in" state
    // — clearing local state always succeeds, regardless of whether the server call
    // does.
    try {
      await authApi.logout()
    } catch {
      // ignored — see above
    } finally {
      setStoredToken(null)
      setCurrentUser(null)
      setHasAnthropicKey(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      hasAnthropicKey,
      isLoading,
      signup,
      login,
      logout,
      refreshAnthropicKeyStatus,
    }),
    [currentUser, hasAnthropicKey, isLoading, signup, login, logout, refreshAnthropicKeyStatus],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
