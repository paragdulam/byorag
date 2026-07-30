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
import { onUnauthorized, setStoredToken } from '../lib/apiClient'

export interface AuthContextValue {
  currentUser: AuthUser | null
  isLoading: boolean
  signup: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    authApi
      .me()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user)
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
  }, [])

  useEffect(() => onUnauthorized(() => setCurrentUser(null)), [])

  const signup = useCallback(async (email: string, password: string) => {
    const result = await authApi.signup(email, password)
    setStoredToken(result.token)
    setCurrentUser(result.user)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    setStoredToken(result.token)
    setCurrentUser(result.user)
  }, [])

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
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ currentUser, isLoading, signup, login, logout }),
    [currentUser, isLoading, signup, login, logout],
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
