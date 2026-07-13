import type { ChunkProgressEvent, ChunkRunResponse } from '../types/chunking'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CHUNKING_STREAM_ENDPOINT = `${API_BASE_URL}/api/chunking/run/stream`

export interface ChunkingStreamHandlers {
  onProgress: (percent: number) => void
  onResult: (response: ChunkRunResponse) => void
  onError: (message?: string) => void
}

/**
 * Opens an SSE connection to the streaming chunking endpoint (contracts/chunking-stream-api.md)
 * and returns a function to close it early. `strategy` is not a parameter — this screen only
 * ever runs "fixed-size" (FR-002).
 */
export function runChunkingStream(
  documentId: string,
  chunkSize: number,
  { onProgress, onResult, onError }: ChunkingStreamHandlers,
): () => void {
  const url = `${CHUNKING_STREAM_ENDPOINT}?documentId=${encodeURIComponent(documentId)}&chunkSize=${encodeURIComponent(String(chunkSize))}`
  const source = new EventSource(url)

  source.addEventListener('progress', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as ChunkProgressEvent
    onProgress(data.percent)
  })

  source.addEventListener('result', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as ChunkRunResponse
    source.close()
    onResult(data)
  })

  // Fires both for a genuine mid-stream "error" event from the backend (has `.data`) and for a
  // connection-level failure such as the pre-stream 400/404 responses (no `.data`) — research.md §3.
  source.addEventListener('error', (event) => {
    const message =
      'data' in event
        ? (JSON.parse((event as MessageEvent).data) as { message: string }).message
        : undefined
    source.close()
    onError(message)
  })

  return () => source.close()
}
