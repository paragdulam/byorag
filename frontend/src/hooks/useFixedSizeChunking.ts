import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunkingResult } from '../types/chunking'
import type { SourceDocument } from '../types/sourceDocument'
import { runChunkingStream, saveChunks } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'

export type ChunkingRunStatus = 'idle' | 'running' | 'success' | 'extraction-failed' | 'error'
export type ChunkingSaveStatus = 'idle' | 'saving' | 'success' | 'error'

interface RunParams {
  documentId: string
  chunkSize: number
  overlap: number
}

export interface UseFixedSizeChunking {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  status: ChunkingRunStatus
  progressPercent: number
  result: ChunkingResult | null
  saveStatus: ChunkingSaveStatus
  hasSavedOnce: boolean
  isSaved: boolean
  run: (documentId: string, chunkSize: number, overlap?: number) => void
  save: () => Promise<void>
}

export function useFixedSizeChunking(corpusId: string | null): UseFixedSizeChunking {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(corpusId !== null)
  const [status, setStatus] = useState<ChunkingRunStatus>('idle')
  const [progressPercent, setProgressPercent] = useState(0)
  const [result, setResult] = useState<ChunkingResult | null>(null)
  const [saveStatus, setSaveStatus] = useState<ChunkingSaveStatus>('idle')
  const [hasSavedOnce, setHasSavedOnce] = useState(false)
  const [currentRunParams, setCurrentRunParams] = useState<RunParams | null>(null)
  // Each run() call gets its own identity (a monotonically increasing counter), not just
  // its parameters — the spec requires that re-running with identical settings shows
  // "unsaved" again, even though a save of that new run would persist byte-identical
  // chunks (spec User Story 3, Acceptance Scenario 2). `savedRunId` tracks *which run*
  // was actually saved, not merely which params were saved.
  const [currentRunId, setCurrentRunId] = useState(0)
  const [savedRunId, setSavedRunId] = useState<number | null>(null)
  const closeStreamRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (corpusId === null) {
      setDocuments([])
      setIsLoadingDocuments(false)
      return
    }

    let cancelled = false
    setIsLoadingDocuments(true)

    listSources(corpusId)
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
  }, [corpusId])

  const run = useCallback((documentId: string, chunkSize: number, overlap = 0) => {
    closeStreamRef.current?.()
    setStatus('running')
    setProgressPercent(0)
    setResult(null)
    setSaveStatus('idle')
    setCurrentRunParams({ documentId, chunkSize, overlap })
    setCurrentRunId((id) => id + 1)

    closeStreamRef.current = runChunkingStream(documentId, chunkSize, overlap, {
      onProgress: (percent) => setProgressPercent(percent),
      onResult: (response) => {
        if (response.extractionFailed) {
          setStatus('extraction-failed')
          setResult(null)
        } else {
          setStatus('success')
          setResult(response.result)
        }
      },
      onError: () => {
        setStatus('error')
        setResult(null)
      },
    })
  }, [])

  // save() persists the chunks currently on screen — the parameters from the run that
  // produced them (research.md §1: chunking is deterministic, so re-running the same
  // params server-side reproduces exactly what's displayed). It is a no-op guard against
  // calling before any successful preview exists (FR-004).
  const save = useCallback(async () => {
    if (currentRunParams === null) {
      return
    }

    setSaveStatus('saving')
    try {
      await saveChunks(currentRunParams.documentId, currentRunParams.chunkSize, currentRunParams.overlap)
      setSaveStatus('success')
      setSavedRunId(currentRunId)
      // hasSavedOnce is a one-way latch (research.md §6): it is only ever set to true
      // here, on a successful save, and is never reset — even if a later save or
      // preview fails.
      setHasSavedOnce(true)
    } catch {
      setSaveStatus('error')
    }
  }, [currentRunParams, currentRunId])

  const isSaved = status === 'success' && savedRunId === currentRunId

  return {
    documents,
    isLoadingDocuments,
    status,
    progressPercent,
    result,
    saveStatus,
    hasSavedOnce,
    isSaved,
    run,
    save,
  }
}
