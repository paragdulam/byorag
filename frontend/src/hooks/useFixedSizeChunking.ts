import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunkingResult, ChunkRunResponse } from '../types/chunking'
import type { SourceDocument } from '../types/sourceDocument'
import { runChunkingStream, saveChunksStream } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'
import { isEntireCorpusSelection } from '../lib/entireCorpusSelection'
import { runSequentialBatch, type BatchItemResult, type BatchProgress } from '../lib/batchRunner'

export type ChunkingRunStatus = 'idle' | 'running' | 'success' | 'extraction-failed' | 'error'
export type ChunkingSaveStatus = 'idle' | 'saving' | 'success' | 'error'

interface RunParams {
  chunkSize: number
  overlap: number
}

// Adapts the streaming (callback-based) chunking calls into a Promise the shared
// runSequentialBatch() helper can await per document (018-ui-polish-batch research.md §2).
// Rejects on `extractionFailed` too (not just a stream error) — the backend's terminal
// `result` event reports extraction failure as a normal, successfully-received response
// (never an `error` stream event), so without this the batch runner would otherwise count
// an extraction failure as a per-document "success" (spec FR-007 requires it be reported
// as a failure, alongside genuine stream errors).
function runChunkingStreamAsPromise(
  documentId: string,
  chunkSize: number,
  overlap: number,
  onDocumentProgress: (percent: number) => void,
): Promise<ChunkRunResponse> {
  return new Promise((resolve, reject) => {
    runChunkingStream(documentId, chunkSize, overlap, {
      onProgress: onDocumentProgress,
      onResult: (response) => {
        if (response.extractionFailed) {
          reject(new Error('Text could not be extracted from this document'))
        } else {
          resolve(response)
        }
      },
      onError: (message) => reject(new Error(message ?? 'Chunking failed')),
    })
  })
}

function saveChunksStreamAsPromise(
  documentId: string,
  chunkSize: number,
  overlap: number,
  onDocumentProgress: (percent: number) => void,
): Promise<ChunkRunResponse> {
  return new Promise((resolve, reject) => {
    saveChunksStream(documentId, chunkSize, overlap, {
      onProgress: onDocumentProgress,
      onResult: (response) => {
        if (response.extractionFailed) {
          reject(new Error('Text could not be extracted from this document'))
        } else {
          resolve(response)
        }
      },
      onError: (message) => reject(new Error(message ?? 'Failed to save chunks')),
    })
  })
}

export interface UseFixedSizeChunking {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  status: ChunkingRunStatus
  progressPercent: number
  result: ChunkingResult | null
  saveStatus: ChunkingSaveStatus
  saveProgressPercent: number
  hasSavedOnce: boolean
  isSaved: boolean
  isEntireCorpus: boolean
  batchProgress: BatchProgress | null
  batchResults: BatchItemResult<ChunkRunResponse>[]
  run: (selection: string, chunkSize: number, overlap?: number) => void
  save: () => Promise<void>
}

export function useFixedSizeChunking(corpusId: string | null): UseFixedSizeChunking {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(corpusId !== null)
  const [status, setStatus] = useState<ChunkingRunStatus>('idle')
  const [progressPercent, setProgressPercent] = useState(0)
  const [result, setResult] = useState<ChunkingResult | null>(null)
  const [saveStatus, setSaveStatus] = useState<ChunkingSaveStatus>('idle')
  const [saveProgressPercent, setSaveProgressPercent] = useState(0)
  const [hasSavedOnce, setHasSavedOnce] = useState(false)
  const [currentSelection, setCurrentSelection] = useState<string | null>(null)
  const [currentRunParams, setCurrentRunParams] = useState<RunParams | null>(null)
  // Each run() call gets its own identity (a monotonically increasing counter), not just
  // its parameters — the spec requires that re-running with identical settings shows
  // "unsaved" again, even though a save of that new run would persist byte-identical
  // chunks (spec User Story 3, Acceptance Scenario 2). `savedRunId` tracks *which run*
  // was actually saved, not merely which params were saved.
  const [currentRunId, setCurrentRunId] = useState(0)
  const [savedRunId, setSavedRunId] = useState<number | null>(null)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchResults, setBatchResults] = useState<BatchItemResult<ChunkRunResponse>[]>([])
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

  const isEntireCorpus = currentSelection !== null && isEntireCorpusSelection(currentSelection)

  const run = useCallback(
    (selection: string, chunkSize: number, overlap = 0) => {
      closeStreamRef.current?.()
      setSaveStatus('idle')
      setSaveProgressPercent(0)
      setBatchResults([])
      setBatchProgress(null)
      setResult(null)
      setCurrentSelection(selection)
      setCurrentRunParams({ chunkSize, overlap })
      setCurrentRunId((id) => id + 1)
      setStatus('running')

      if (isEntireCorpusSelection(selection)) {
        void runSequentialBatch(
          documents,
          (doc, reportDocumentProgress) =>
            runChunkingStreamAsPromise(doc.id, chunkSize, overlap, reportDocumentProgress),
          (progress) => setBatchProgress(progress),
        ).then((results) => {
          setBatchProgress(null)
          setBatchResults(results)
          setStatus(results.some((r) => r.status === 'success') ? 'success' : 'error')
        })
        return
      }

      setProgressPercent(0)
      closeStreamRef.current = runChunkingStream(selection, chunkSize, overlap, {
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
    },
    [documents],
  )

  // save() persists whatever the last run() produced — for a single document, the
  // parameters from that run (research.md §1: chunking is deterministic, so re-running the
  // same params server-side reproduces exactly what's displayed); for "Entire Corpus", a
  // sequential per-document save batch using that same shared chunkSize/overlap
  // (018-ui-polish-batch contracts/entire-corpus-batch-orchestration.md). It is a no-op guard
  // against calling before any successful preview exists (FR-004).
  const save = useCallback(async () => {
    if (currentRunParams === null || currentSelection === null) {
      return
    }

    setSaveStatus('saving')

    if (isEntireCorpusSelection(currentSelection)) {
      setBatchProgress(null)
      try {
        const results = await runSequentialBatch(
          documents,
          (doc, reportDocumentProgress) =>
            saveChunksStreamAsPromise(
              doc.id,
              currentRunParams.chunkSize,
              currentRunParams.overlap,
              reportDocumentProgress,
            ),
          (progress) => setBatchProgress(progress),
        )
        setBatchProgress(null)
        setBatchResults(results)
        if (results.some((r) => r.status === 'success')) {
          setSaveStatus('success')
          setSavedRunId(currentRunId)
          setHasSavedOnce(true)
        } else {
          setSaveStatus('error')
        }
      } catch {
        setBatchProgress(null)
        setSaveStatus('error')
      }
      return
    }

    setSaveProgressPercent(0)
    try {
      await new Promise<void>((resolve, reject) => {
        saveChunksStream(currentSelection, currentRunParams.chunkSize, currentRunParams.overlap, {
          onProgress: (percent) => setSaveProgressPercent(percent),
          onResult: () => resolve(),
          onError: (message) => reject(new Error(message ?? 'Failed to save chunks')),
        })
      })
      setSaveStatus('success')
      setSavedRunId(currentRunId)
      setHasSavedOnce(true)
    } catch {
      setSaveStatus('error')
    }
  }, [currentRunParams, currentRunId, currentSelection, documents])

  const isSaved = status === 'success' && savedRunId === currentRunId

  return {
    documents,
    isLoadingDocuments,
    status,
    progressPercent,
    result,
    saveStatus,
    saveProgressPercent,
    hasSavedOnce,
    isSaved,
    isEntireCorpus,
    batchProgress,
    batchResults,
    run,
    save,
  }
}
