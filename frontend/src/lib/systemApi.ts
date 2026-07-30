import { apiFetch } from './apiClient'
import type { SystemCapacity } from '../types/systemCapacity'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const SYSTEM_CAPACITY_ENDPOINT = `${API_BASE_URL}/api/system/capacity`

export async function getSystemCapacity(): Promise<SystemCapacity> {
  const response = await apiFetch(SYSTEM_CAPACITY_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to load system capacity: ${response.status}`)
  }
  return (await response.json()) as SystemCapacity
}
