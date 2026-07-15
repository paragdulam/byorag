import type { Corpus } from '../types/corpus'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CORPORA_ENDPOINT = `${API_BASE_URL}/api/corpora`

interface RawCorpus {
  id: string
  name: string
  createdAt: string
}

interface ListCorporaResponse {
  corpora: RawCorpus[]
}

function toCorpus(raw: RawCorpus): Corpus {
  return {
    id: raw.id,
    name: raw.name,
    createdAt: new Date(raw.createdAt),
  }
}

export class CorpusApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
  }
}

async function parseErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail ?? fallback
  } catch {
    return fallback
  }
}

export async function listCorpora(): Promise<Corpus[]> {
  const response = await fetch(CORPORA_ENDPOINT)
  if (!response.ok) {
    throw new CorpusApiError(`Failed to load corpora: ${response.status}`, response.status)
  }
  const body = (await response.json()) as ListCorporaResponse
  return body.corpora.map(toCorpus)
}

export async function createCorpus(name: string): Promise<Corpus> {
  const response = await fetch(CORPORA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    throw new CorpusApiError(
      await parseErrorDetail(response, `Failed to create corpus: ${response.status}`),
      response.status,
    )
  }
  return toCorpus((await response.json()) as RawCorpus)
}

export async function renameCorpus(id: string, name: string): Promise<Corpus> {
  const response = await fetch(`${CORPORA_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    throw new CorpusApiError(
      await parseErrorDetail(response, `Failed to rename corpus: ${response.status}`),
      response.status,
    )
  }
  return toCorpus((await response.json()) as RawCorpus)
}

export async function deleteCorpus(id: string): Promise<void> {
  const response = await fetch(`${CORPORA_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new CorpusApiError(
      await parseErrorDetail(response, `Failed to delete corpus: ${response.status}`),
      response.status,
    )
  }
}
