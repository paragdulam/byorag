import { apiFetch } from './apiClient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const AUTH_ENDPOINT = `${API_BASE_URL}/api/auth`

export interface AuthUser {
  id: string
  email: string
}

export interface AuthResult {
  user: AuthUser
  token: string
}

async function parseErrorDetail(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null
  return body?.detail ?? `Request failed: ${response.status}`
}

export async function signup(email: string, password: string): Promise<AuthResult> {
  const response = await apiFetch(`${AUTH_ENDPOINT}/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return (await response.json()) as AuthResult
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await apiFetch(`${AUTH_ENDPOINT}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return (await response.json()) as AuthResult
}

export async function logout(): Promise<void> {
  await apiFetch(`${AUTH_ENDPOINT}/logout`, { method: 'POST' })
}

export async function me(): Promise<AuthUser | null> {
  const response = await apiFetch(`${AUTH_ENDPOINT}/me`)
  if (!response.ok) {
    return null
  }
  return (await response.json()) as AuthUser
}
