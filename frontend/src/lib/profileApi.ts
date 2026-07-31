import { apiFetch } from './apiClient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const PROFILE_ENDPOINT = `${API_BASE_URL}/api/profile`

export interface AnthropicKeyStatus {
  hasKey: boolean
  maskedKey: string | null
}

async function parseErrorDetail(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { detail?: string } | null
  return body?.detail ?? `Request failed: ${response.status}`
}

export async function getAnthropicKeyStatus(): Promise<AnthropicKeyStatus> {
  const response = await apiFetch(`${PROFILE_ENDPOINT}/anthropic-key`)
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return (await response.json()) as AnthropicKeyStatus
}

export async function setAnthropicKey(apiKey: string): Promise<AnthropicKeyStatus> {
  const response = await apiFetch(`${PROFILE_ENDPOINT}/anthropic-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return (await response.json()) as AnthropicKeyStatus
}

export async function deleteAnthropicKey(): Promise<void> {
  await apiFetch(`${PROFILE_ENDPOINT}/anthropic-key`, { method: 'DELETE' })
}
