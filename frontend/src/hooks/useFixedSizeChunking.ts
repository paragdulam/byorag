import { useCallback, useEffect, useState } from 'react'
import type { ChunkingResult } from '../types/chunking'
import type { SourceDocument } from '../types/sourceDocument'
import { runChunking } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'

export type ChunkingRunStatus = 'idle' | 'running' | 'success' | 'extraction-failed' | 'error'

export interface UseFixedSizeChunking {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  status: ChunkingRunStatus
  result: ChunkingResult | null
  run: (documentId: string, chunkSize: number) => void
}

export function useFixedSizeChunking(): UseFixedSizeChunking {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [status, setStatus] = useState<ChunkingRunStatus>('idle')
  const [result, setResult] = useState<ChunkingResult | null>(null)

  useEffect(() => {
    let cancelled = false

    listSources()
      .then((docs) => {
        if (!cancelled) {
          setDocuments(docs)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDocuments(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const run = useCallback((documentId: string, chunkSize: number) => {
    setStatus('running')
    setResult(null)

    runChunking(documentId, chunkSize)
      .then((response) => {
        if (response.extractionFailed) {
          setStatus('extraction-failed')
          setResult(null)
        } else {
          setStatus('success')
          setResult(response.result)
        }
      })
      .catch(() => {
        setStatus('error')
        setResult(null)
      })
  }, [])

  return { documents, isLoadingDocuments, status, result, run }
}
