export interface EmbeddingModelOption {
  id: string
  label: string
}

export interface SavedChunk {
  id: string
  index: number
  content: string
}

export interface EmbeddingVector {
  chunkId: string
  model: string
  dims: number
  vector: number[]
}

export interface EmbeddingGenerateResult {
  documentId: string
  model: string
  vectors: EmbeddingVector[]
}

export interface EmbeddingSaveResult {
  documentId: string
  model: string
  savedCount: number
}

export interface EmbeddingProgressEvent {
  percent: number
  chunksEmbedded: number
  totalChunks: number
}

export interface SavedEmbedding {
  id: string
  model: string
  createdAt: string
  dims: number
  vector: number[]
}

export interface ProjectionMethodOption {
  id: string
  label: string
  available: boolean
}
