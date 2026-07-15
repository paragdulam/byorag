export interface PlaygroundContext {
  documentId: string
  chunkingStrategy: string | null
  embeddingModel: string | null
}

export interface CreateTurnRequest {
  documentId: string
  model: string
  query: string
}

export interface TurnChunk {
  chunkId: string
  index: number
  content: string
  score: number
}

export interface Turn {
  id: string
  question: string
  queryEmbedding: number[]
  chunks: TurnChunk[]
  llmProvider: string | null
  llmModel: string | null
  prompt: string | null
  answer: string | null
  error: string | null
  createdAt: string
  answeredAt: string | null
}

export interface ListTurnsResponse {
  documentId: string
  turns: Turn[]
}
