export type GoldenEntryStatus = 'approved' | 'pending_review' | 'rejected'
export type GoldenEntrySource = 'manual' | 'llm_generated'

export interface GoldenCandidate {
  chunkId: string
  documentId: string | null
  chunkIndex: number
  content: string
  matchedQuestion: boolean
  matchedAnswer: boolean
}

export interface GoldenEntryChunk {
  id: string
  chunkId: string | null
  documentId: string | null
  chunkIndex: number
  content: string
}

export interface GoldenEntry {
  id: string
  corpusId: string
  documentId: string | null
  question: string
  preferredAnswer: string
  status: GoldenEntryStatus
  source: GoldenEntrySource
  chunks: GoldenEntryChunk[]
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
}

export interface GoldenEntrySummary {
  id: string
  corpusId: string
  documentId: string | null
  question: string
  status: GoldenEntryStatus
  source: GoldenEntrySource
  createdAt: string
}
