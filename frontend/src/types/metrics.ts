export interface CorpusSummary {
  corpusId: string
  name: string
  chunkingStrategies: string[]
  hasPipelines: boolean
}

export interface ListCorporaResponse {
  corpora: CorpusSummary[]
}

export interface ScopeBreakdown {
  corpus: number
  document: number
}

export interface QualityScores {
  contextPrecision: number
  contextRecall: number
  responseRelevancy: number
  faithfulness: number
  sampleSize: number
}

export interface PipelineSummary {
  chunkingStrategy: string
  embeddingModel: string
  retrievalStrategy: string
  chunkCount: number
  questionCount: number
  answerCount: number
  scopeBreakdown: ScopeBreakdown
  generationLlm: string | null
  judgeLlm: string | null
  scores: QualityScores | null
}

export interface ListPipelinesResponse {
  corpusId: string
  pipelines: PipelineSummary[]
}
