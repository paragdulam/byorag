import { apiFetch, appendTokenQueryParam } from './apiClient'
import type { ChunkProgressEvent, ChunkRunResponse } from '../types/chunking'
import type { SavedChunk } from '../types/embeddings'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CHUNKING_STREAM_ENDPOINT = `${API_BASE_URL}/api/chunking/run/stream`
const CHUNKING_SAVE_STREAM_ENDPOINT = `${API_BASE_URL}/api/chunking/save/stream`
const CHUNKING_SAVED_CHUNKS_ENDPOINT = `${API_BASE_URL}/api/chunking/saved-chunks`
const CHUNKING_STRUCTURED_PREVIEW_ENDPOINT = `${API_BASE_URL}/api/chunking/structured-preview`

export interface PreviewSegment {
  start: number
  end: number
  kind: 'chunk' | 'overlap'
  chunkIndex: number | null
}

export interface PagePosition {
  pageNumber: number
  start: number
  end: number
}

export interface ChunkRange {
  chunkIndex: number
  start: number
  end: number
}

export interface StructuredPreview {
  fullText: string
  segments: PreviewSegment[]
  pages: PagePosition[]
  chunkRanges: ChunkRange[]
}

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
  overlap: number,
  { onProgress, onResult, onError }: ChunkingStreamHandlers,
): () => void {
  const url = `${CHUNKING_STREAM_ENDPOINT}?documentId=${encodeURIComponent(documentId)}&chunkSize=${encodeURIComponent(String(chunkSize))}&overlap=${encodeURIComponent(String(overlap))}`
  const source = new EventSource(appendTokenQueryParam(url))

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

/**
 * Opens an SSE connection to the chunking save-stream endpoint
 * (contracts/chunking-save-stream-api.md) and returns a function to close it early — mirrors
 * `runChunkingStream`/`saveEmbeddingsStream`. Recomputes and persists a chunking result for a
 * document, fully replacing any previously saved chunks for it. Strategy is not a parameter —
 * same "fixed-size"-only scope as `runChunkingStream`.
 */
export function saveChunksStream(
  documentId: string,
  chunkSize: number,
  overlap: number,
  { onProgress, onResult, onError }: ChunkingStreamHandlers,
): () => void {
  const url = `${CHUNKING_SAVE_STREAM_ENDPOINT}?documentId=${encodeURIComponent(documentId)}&chunkSize=${encodeURIComponent(String(chunkSize))}&overlap=${encodeURIComponent(String(overlap))}`
  const source = new EventSource(appendTokenQueryParam(url))

  source.addEventListener('progress', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as ChunkProgressEvent
    onProgress(data.percent)
  })

  source.addEventListener('result', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as ChunkRunResponse
    source.close()
    onResult(data)
  })

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

/**
 * Reads a document's currently saved chunks (contracts/embeddings-api.md — added for
 * 013-bert-pgvector-embeddings). An empty list is a normal response for a document with
 * nothing saved yet, not an error.
 */
export async function listSavedChunks(documentId: string): Promise<SavedChunk[]> {
  const url = `${CHUNKING_SAVED_CHUNKS_ENDPOINT}?documentId=${encodeURIComponent(documentId)}`
  const response = await apiFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load saved chunks: ${response.status}`)
  }

  const body = (await response.json()) as { chunks: SavedChunk[] }
  return body.chunks
}

/**
 * Reads a document's structure-preserving extracted text plus its chunk/overlap segment map
 * (contracts/chunking-structured-preview-api.md, 022-chunk-preview-ui-fixes) for Chunked Preview
 * v2's continuous, background-only-highlighted rendering.
 */
export async function fetchStructuredPreview(documentId: string): Promise<StructuredPreview> {
  const url = `${CHUNKING_STRUCTURED_PREVIEW_ENDPOINT}?documentId=${encodeURIComponent(documentId)}`
  const response = await apiFetch(url)

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `Failed to load structured preview: ${response.status}`)
  }

  return (await response.json()) as StructuredPreview
}
