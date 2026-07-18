import type { ListCorporaResponse, ListPipelinesResponse } from '../types/metrics'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const METRICS_CORPORA_ENDPOINT = `${API_BASE_URL}/api/metrics/corpora`

/** Every corpus with the chunking techniques it has saved chunks for (contracts/metrics-api.md). */
export async function fetchCorpora(): Promise<ListCorporaResponse> {
  const response = await fetch(METRICS_CORPORA_ENDPOINT)

  if (!response.ok) {
    throw new Error(`Failed to load corpora: ${response.status}`)
  }

  return (await response.json()) as ListCorporaResponse
}

/**
 * Every chunking-technique/embedding-model pipeline for one corpus, each with its own chunk
 * count, question/answer counts, scope breakdown, and quality scores (contracts/metrics-api.md).
 */
export async function fetchPipelines(corpusId: string): Promise<ListPipelinesResponse> {
  const response = await fetch(`${METRICS_CORPORA_ENDPOINT}/${encodeURIComponent(corpusId)}/pipelines`)

  if (!response.ok) {
    throw new Error(`Failed to load pipelines: ${response.status}`)
  }

  return (await response.json()) as ListPipelinesResponse
}

/**
 * Every pipeline for a corpus in one response, for the side-by-side comparison modal
 * (contracts/metrics-api.md) — same shape as `fetchPipelines`, backed by a dedicated endpoint
 * that 400s when the corpus has fewer than 2 pipelines.
 */
export async function fetchComparison(corpusId: string): Promise<ListPipelinesResponse> {
  const response = await fetch(`${METRICS_CORPORA_ENDPOINT}/${encodeURIComponent(corpusId)}/compare`)

  if (!response.ok) {
    throw new Error(`Failed to load comparison: ${response.status}`)
  }

  return (await response.json()) as ListPipelinesResponse
}
