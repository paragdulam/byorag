import type {
  EmbeddingGenerateResult,
  EmbeddingModelOption,
  EmbeddingSaveResult,
  ProjectionMethodOption,
  SavedEmbedding,
} from '../types/embeddings'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const EMBEDDINGS_MODELS_ENDPOINT = `${API_BASE_URL}/api/embeddings/models`
const EMBEDDINGS_GENERATE_ENDPOINT = `${API_BASE_URL}/api/embeddings/generate/stream`
const EMBEDDINGS_SAVE_ENDPOINT = `${API_BASE_URL}/api/embeddings/save/stream`
const EMBEDDINGS_SAVED_ENDPOINT = `${API_BASE_URL}/api/embeddings/saved`
const EMBEDDINGS_PROJECTION_METHODS_ENDPOINT = `${API_BASE_URL}/api/embeddings/projection-methods`

/**
 * Lists the registered embedding models for the model picker (contracts/embeddings-api.md)
 * — server-driven, not hardcoded, so the dropdown can grow without a frontend redesign.
 */
export async function listEmbeddingModels(): Promise<EmbeddingModelOption[]> {
  const response = await fetch(EMBEDDINGS_MODELS_ENDPOINT)

  if (!response.ok) {
    throw new Error(`Failed to load embedding models: ${response.status}`)
  }

  const body = (await response.json()) as { models: EmbeddingModelOption[] }
  return body.models
}

export interface EmbeddingsStreamHandlers {
  onProgress: (percent: number) => void
  onResult: (result: EmbeddingGenerateResult) => void
  onError: (message?: string) => void
}

/**
 * Opens an SSE connection to the embeddings generate endpoint (contracts/embeddings-api.md)
 * and returns a function to close it early — mirrors `runChunkingStream`.
 */
export function generateEmbeddingsStream(
  documentId: string,
  model: string,
  { onProgress, onResult, onError }: EmbeddingsStreamHandlers,
): () => void {
  const url = `${EMBEDDINGS_GENERATE_ENDPOINT}?documentId=${encodeURIComponent(documentId)}&model=${encodeURIComponent(model)}`
  const source = new EventSource(url)

  source.addEventListener('progress', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { percent: number }
    onProgress(data.percent)
  })

  source.addEventListener('result', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as EmbeddingGenerateResult
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

export interface EmbeddingsSaveStreamHandlers {
  onProgress: (percent: number) => void
  onResult: (result: EmbeddingSaveResult) => void
  onError: (message?: string) => void
}

/**
 * Opens an SSE connection to the embeddings save endpoint (contracts/embeddings-api.md).
 * Unlike chunking's chunk-save (a plain POST), this is streaming because it re-runs the
 * same expensive embedding computation as generate (research.md §4-5).
 */
export function saveEmbeddingsStream(
  documentId: string,
  model: string,
  { onProgress, onResult, onError }: EmbeddingsSaveStreamHandlers,
): () => void {
  const url = `${EMBEDDINGS_SAVE_ENDPOINT}?documentId=${encodeURIComponent(documentId)}&model=${encodeURIComponent(model)}`
  const source = new EventSource(url)

  source.addEventListener('progress', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as { percent: number }
    onProgress(data.percent)
  })

  source.addEventListener('result', (event) => {
    const data = JSON.parse((event as MessageEvent).data) as EmbeddingSaveResult
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
 * Reads a chunk's currently saved embeddings, newest first (contracts/vector-view-api.md —
 * added for 014-vector-view-screen). An empty list is a normal response for a chunk with
 * nothing saved yet, not an error.
 */
export async function listSavedEmbeddings(chunkId: string): Promise<SavedEmbedding[]> {
  const url = `${EMBEDDINGS_SAVED_ENDPOINT}?chunkId=${encodeURIComponent(chunkId)}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load saved embeddings: ${response.status}`)
  }

  const body = (await response.json()) as { embeddings: SavedEmbedding[] }
  return body.embeddings
}

/**
 * Lists the registered projection methods for the dropdown above the vector display
 * (contracts/vector-view-api.md) — server-driven, mirroring `listEmbeddingModels`. Only
 * entries with `available: true` do anything; others are visible placeholders.
 */
export async function listProjectionMethods(): Promise<ProjectionMethodOption[]> {
  const response = await fetch(EMBEDDINGS_PROJECTION_METHODS_ENDPOINT)

  if (!response.ok) {
    throw new Error(`Failed to load projection methods: ${response.status}`)
  }

  const body = (await response.json()) as { methods: ProjectionMethodOption[] }
  return body.methods
}
