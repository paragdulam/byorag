import type { ChunkRunResponse } from '../types/chunking'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CHUNKING_RUN_ENDPOINT = `${API_BASE_URL}/api/chunking/run`

export async function runChunking(
  documentId: string,
  chunkSize: number,
  strategy: 'fixed-size' = 'fixed-size',
): Promise<ChunkRunResponse> {
  const response = await fetch(CHUNKING_RUN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, chunkSize, strategy }),
  })
  if (!response.ok) {
    throw new Error(`Failed to run chunking: ${response.status}`)
  }
  return (await response.json()) as ChunkRunResponse
}
