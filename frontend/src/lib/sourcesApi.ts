import type { DeletionResult, SourceDocument, UploadRejection } from '../types/sourceDocument'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const SOURCES_ENDPOINT = `${API_BASE_URL}/api/sources`
const DELETE_SOURCES_ENDPOINT = `${SOURCES_ENDPOINT}/delete`

interface RawSourceDocument {
  id: string
  name: string
  sizeBytes: number
  uploadedAt: string
  status: SourceDocument['status']
}

interface ListSourcesResponse {
  documents: RawSourceDocument[]
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

export async function listSources(): Promise<SourceDocument[]> {
  const response = await fetch(SOURCES_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to load sources: ${response.status}`)
  }
  const body = (await response.json()) as ListSourcesResponse
  return body.documents.map(toSourceDocument)
}

export interface UploadSourcesResult {
  documents: SourceDocument[]
  rejections: UploadRejection[]
}

export async function uploadSources(files: File[]): Promise<UploadSourcesResult> {
  const formData = new FormData()
  for (const file of files) {
    formData.append('files', file)
  }

  const response = await fetch(SOURCES_ENDPOINT, {
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

interface DeleteSourcesResponse {
  results: DeletionResult[]
}

export async function deleteSources(ids: string[]): Promise<DeletionResult[]> {
  const response = await fetch(DELETE_SOURCES_ENDPOINT, {
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
