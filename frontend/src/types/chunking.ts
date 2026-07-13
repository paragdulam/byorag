export interface Chunk {
  index: number
  content: string
}

export interface ChunkingResult {
  chunks: Chunk[]
  totalChunks: number
  strategy: 'fixed-size'
  chunkSize: number
}

export interface ChunkRunResponse {
  extractionFailed: boolean
  result: ChunkingResult | null
}
