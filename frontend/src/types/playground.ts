export interface PlaygroundContext {
  documentId: string | null
  corpusId: string | null
  chunkingStrategy: string | null
  embeddingModel: string | null
}

export interface CreateTurnRequest {
  documentId?: string | null
  corpusId?: string | null
  model: string
  query: string
}

export interface TurnChunk {
  chunkId: string
  documentId: string | null
  index: number
  content: string
  score: number
}

export interface Turn {
  id: string
  scope: 'document' | 'corpus'
  documentId: string | null
  corpusId: string | null
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
  documentId: string | null
  corpusId: string | null
  turns: Turn[]
}
