import { apiFetch, getStoredToken } from './apiClient'
import type {
  DeletionResult,
  DocumentWithCorpora,
  SourceDocument,
  UploadRejection,
} from '../types/sourceDocument'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const SOURCES_ENDPOINT = `${API_BASE_URL}/api/sources`
const DELETE_SOURCES_ENDPOINT = `${SOURCES_ENDPOINT}/delete`
const ALL_SOURCES_ENDPOINT = `${SOURCES_ENDPOINT}/all`

interface RawSourceDocument {
  id: string
  name: string
  sizeBytes: number
  uploadedAt: string
  status: SourceDocument['status']
}

interface RawDocumentWithCorpora extends RawSourceDocument {
  corpusIds: string[]
}

interface ListSourcesResponse {
  documents: RawSourceDocument[]
}

interface ListAllSourcesResponse {
  documents: RawDocumentWithCorpora[]
}

interface UploadSourcesResponse {
  documents: RawSourceDocument[]
  rejections: UploadRejection[]
}

function toSourceDocument(raw: RawSourceDocument): SourceDocument {
  return {
    id: raw.id,
    name: raw.name,
    sizeBytes: raw.sizeBytes,
    uploadedAt: new Date(raw.uploadedAt),
    status: raw.status,
  }
}

export async function listSources(corpusId: string): Promise<SourceDocument[]> {
  const url = `${SOURCES_ENDPOINT}?corpusId=${encodeURIComponent(corpusId)}`
  const response = await apiFetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load sources: ${response.status}`)
  }
  const body = (await response.json()) as ListSourcesResponse
  return body.documents.map(toSourceDocument)
}

/**
 * URL for a document's stored PDF bytes (contracts/sources-file-api.md,
 * 021-sources-chunking-embeddings-refresh). Returned as a plain URL rather than a fetched
 * blob — the PDF viewer (`react-pdf`/`pdfjs`) fetches and parses it directly.
 */
export function sourceFileUrl(documentId: string): string {
  return `${SOURCES_ENDPOINT}/${encodeURIComponent(documentId)}/file`
}

/**
 * `react-pdf`'s `<Document file={...}>` accepts this `{ url, httpHeaders }` shape and passes
 * `httpHeaders` through to `pdfjs`'s own internal fetch — unlike the two `EventSource`-based
 * streaming endpoints (which can't send headers at all, research.md §5), the PDF viewer can
 * carry the session token as a normal `Authorization` header instead of a URL query parameter
 * (024-user-authentication research.md §6).
 */
export function sourceFileRequest(documentId: string): {
  url: string
  httpHeaders?: Record<string, string>
} {
  const token = getStoredToken()
  return {
    url: sourceFileUrl(documentId),
    httpHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
  }
}

export async function listAllSources(): Promise<DocumentWithCorpora[]> {
  const response = await apiFetch(ALL_SOURCES_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to load all sources: ${response.status}`)
  }
  const body = (await response.json()) as ListAllSourcesResponse
  return body.documents.map((raw) => ({
    ...toSourceDocument(raw),
    corpusIds: raw.corpusIds,
  }))
}

export interface UploadSourcesResult {
  documents: SourceDocument[]
  rejections: UploadRejection[]
}

export async function uploadSources(files: File[], corpusId: string): Promise<UploadSourcesResult> {
  const formData = new FormData()
  formData.append('corpusId', corpusId)
  for (const file of files) {
    formData.append('files', file)
  }

  const response = await apiFetch(SOURCES_ENDPOINT, {
    method: 'POST',
    body: formData,
  })
  if (!response.ok) {
    throw new Error(`Failed to upload sources: ${response.status}`)
  }
  const body = (await response.json()) as UploadSourcesResponse
  return {
    documents: body.documents.map(toSourceDocument),
    rejections: body.rejections,
  }
}

export async function attachDocumentToCorpus(documentId: string, corpusId: string): Promise<void> {
  const response = await apiFetch(`${SOURCES_ENDPOINT}/${encodeURIComponent(documentId)}/corpora`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corpusId }),
  })
  if (!response.ok) {
    throw new Error(`Failed to attach document to corpus: ${response.status}`)
  }
}

export async function removeDocumentFromCorpus(
  documentId: string,
  corpusId: string,
): Promise<void> {
  const response = await apiFetch(
    `${SOURCES_ENDPOINT}/${encodeURIComponent(documentId)}/corpora/${encodeURIComponent(corpusId)}`,
    { method: 'DELETE' },
  )
  if (!response.ok) {
    throw new Error(`Failed to remove document from corpus: ${response.status}`)
  }
}

interface DeleteSourcesResponse {
  results: DeletionResult[]
}

export async function deleteSources(ids: string[]): Promise<DeletionResult[]> {
  const response = await apiFetch(DELETE_SOURCES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!response.ok) {
    throw new Error(`Failed to delete sources: ${response.status}`)
  }
  const body = (await response.json()) as DeleteSourcesResponse
  return body.results
}
