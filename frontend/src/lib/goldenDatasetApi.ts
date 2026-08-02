import { apiFetch } from './apiClient'
import type { GoldenCandidate, GoldenEntry, GoldenEntrySummary } from '../types/goldenDataset'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CANDIDATES_ENDPOINT = `${API_BASE_URL}/api/golden-dataset/candidates`
const DRAFT_ANSWER_ENDPOINT = `${API_BASE_URL}/api/golden-dataset/draft-answer`
const ENTRIES_ENDPOINT = `${API_BASE_URL}/api/golden-dataset/entries`

export interface EntryScope {
  corpusId?: string | null
  documentId?: string | null
}

/** contracts/golden-dataset-api.md `POST /candidates` — merged, RRF-fused, deduplicated
 * question/answer-search results, labeled by which search(es) matched (FR-003, FR-004). */
export async function searchCandidates(
  scope: EntryScope,
  question: string,
  answer?: string,
): Promise<GoldenCandidate[]> {
  const response = await apiFetch(CANDIDATES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corpusId: scope.corpusId ?? null,
      documentId: scope.documentId ?? null,
      question,
      answer: answer && answer.trim() ? answer : null,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to search evidence candidates: ${response.status}`)
  }

  const body = (await response.json()) as { candidates: GoldenCandidate[] }
  return body.candidates
}

export interface DraftAnswerChunkInput {
  chunkIndex: number
  content: string
}

/** contracts/golden-dataset-api.md `POST /draft-answer` — grounded only in the given chunks
 * (FR-007); never persisted, purely a suggestion the caller may edit or discard. */
export async function draftAnswer(
  question: string,
  chunks: DraftAnswerChunkInput[],
): Promise<string> {
  const response = await apiFetch(DRAFT_ANSWER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, chunks }),
  })

  if (!response.ok) {
    throw new Error(`Failed to draft an answer: ${response.status}`)
  }

  const body = (await response.json()) as { draftAnswer: string }
  return body.draftAnswer
}

export interface EntryChunkInput {
  chunkId: string | null
  documentId: string | null
  chunkIndex: number
  content: string
}

export interface CreateEntryInput {
  corpusId: string
  documentId: string | null
  question: string
  preferredAnswer: string
  chunks: EntryChunkInput[]
}

/** contracts/golden-dataset-api.md `POST /entries` — saved immediately as approved (FR-008). */
export async function createEntry(input: CreateEntryInput): Promise<GoldenEntry> {
  const response = await apiFetch(ENTRIES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Failed to create entry: ${response.status}`)
  }

  return (await response.json()) as GoldenEntry
}

export interface ListEntriesFilter {
  status?: string[]
  source?: string[]
}

/** contracts/golden-dataset-api.md `GET /entries` (FR-015). */
export async function listEntries(
  corpusId: string,
  filter: ListEntriesFilter = {},
): Promise<GoldenEntrySummary[]> {
  const params = new URLSearchParams({ corpusId })
  for (const status of filter.status ?? []) {
    params.append('status', status)
  }
  for (const source of filter.source ?? []) {
    params.append('source', source)
  }

  const response = await apiFetch(`${ENTRIES_ENDPOINT}?${params.toString()}`)

  if (!response.ok) {
    throw new Error(`Failed to list entries: ${response.status}`)
  }

  const body = (await response.json()) as { entries: GoldenEntrySummary[] }
  return body.entries
}

/** contracts/golden-dataset-api.md `POST /generate` — evidence-first synthetic QA generation
 * (FR-009), always saved as `pending_review` (FR-011). `corpusId` is always required —
 * unlike `searchCandidates`'s scope, a generated entry always needs a home corpus. */
export async function generateEntry(corpusId: string, documentId: string | null): Promise<GoldenEntry> {
  const response = await apiFetch(`${API_BASE_URL}/api/golden-dataset/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corpusId, documentId }),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate an entry: ${response.status}`)
  }

  return (await response.json()) as GoldenEntry
}

/** contracts/golden-dataset-api.md `DELETE /entries/{id}` (FR-018). */
export async function deleteEntry(entryId: string): Promise<void> {
  const response = await apiFetch(`${ENTRIES_ENDPOINT}/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(`Failed to delete entry: ${response.status}`)
  }
}

/** contracts/golden-dataset-api.md `GET /entries/{id}` — full entry, for the shared editor. */
export async function getEntry(entryId: string): Promise<GoldenEntry> {
  const response = await apiFetch(`${ENTRIES_ENDPOINT}/${encodeURIComponent(entryId)}`)

  if (!response.ok) {
    throw new Error(`Failed to load entry: ${response.status}`)
  }

  return (await response.json()) as GoldenEntry
}

export interface UpdateEntryInput {
  question?: string
  preferredAnswer?: string
  chunks?: EntryChunkInput[]
  status?: GoldenEntry['status']
}

/** contracts/golden-dataset-api.md `PATCH /entries/{id}` — edits fields and/or moves status
 * (FR-012, FR-013, FR-013a, FR-017) — one endpoint for every post-creation change. */
export async function updateEntry(entryId: string, input: UpdateEntryInput): Promise<GoldenEntry> {
  const response = await apiFetch(`${ENTRIES_ENDPOINT}/${encodeURIComponent(entryId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error(`Failed to update entry: ${response.status}`)
  }

  return (await response.json()) as GoldenEntry
}
