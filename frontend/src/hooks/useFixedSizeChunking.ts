import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunkingResult } from '../types/chunking'
import type { SourceDocument } from '../types/sourceDocument'
import { runChunkingStream } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'

export type ChunkingRunStatus = 'idle' | 'running' | 'success' | 'extraction-failed' | 'error'

export interface UseFixedSizeChunking {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  status: ChunkingRunStatus
  progressPercent: number
  result: ChunkingResult | null
  hasSucceededOnce: boolean
  run: (documentId: string, chunkSize: number) => void
}

export function useFixedSizeChunking(): UseFixedSizeChunking {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [status, setStatus] = useState<ChunkingRunStatus>('idle')
  const [progressPercent, setProgressPercent] = useState(0)
  const [result, setResult] = useState<ChunkingResult | null>(null)
  const [hasSucceededOnce, setHasSucceededOnce] = useState(false)
  const closeStreamRef = useRef<(() => void) | null>(null)

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
      closeStreamRef.current?.()
    }
  }, [])

  const run = useCallback((documentId: string, chunkSize: number) => {
    closeStreamRef.current?.()
    setStatus('running')
    setProgressPercent(0)
    setResult(null)

    // hasSucceededOnce is a one-way latch (research.md §7): it is only ever set to true here
    // and is never reset, even if a later run fails.
    closeStreamRef.current = runChunkingStream(documentId, chunkSize, {
      onProgress: (percent) => setProgressPercent(percent),
      onResult: (response) => {
        if (response.extractionFailed) {
          setStatus('extraction-failed')
          setResult(null)
        } else {
          setStatus('success')
          setResult(response.result)
          setHasSucceededOnce(true)
        }
      },
      onError: () => {
        setStatus('error')
        setResult(null)
      },
    })
  }, [])

  return {
    documents,
    isLoadingDocuments,
    status,
    progressPercent,
    result,
    hasSucceededOnce,
    run,
  }
}
