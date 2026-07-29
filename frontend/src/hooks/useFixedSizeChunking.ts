import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunkingResult, ChunkRunResponse } from '../types/chunking'
import type { SourceDocument } from '../types/sourceDocument'
import { runChunkingStream, saveChunksStream, listSavedChunks } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'
import { isEntireCorpusSelection } from '../lib/entireCorpusSelection'
import { runSequentialBatch, type BatchItemResult, type BatchProgress } from '../lib/batchRunner'

export type ChunkOrigin = 'auto-loaded' | 'computed' | null

// Saved chunks (`GET /api/chunking/saved-chunks`) carry no chunkSize/overlap metadata — those
// values aren't rendered anywhere for an auto-loaded result (021-sources-chunking-embeddings-
// refresh research.md, data-model.md), so 0 is a safe placeholder, never displayed as such.
function toChunkingResult(chunks: { index: number; content: string }[]): ChunkingResult {
  return {
    chunks,
    totalChunks: chunks.length,
    strategy: 'fixed-size',
    chunkSize: 0,
    overlap: 0,
  }
}

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
  activeDocumentId: string
  status: ChunkingRunStatus
  progressPercent: number
  result: ChunkingResult | null
  chunkOrigin: ChunkOrigin
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

/**
 * `selectedDocumentId` is the raw dropdown value (may be `''` before the user picks anything,
 * or the `ENTIRE_CORPUS_SELECTION` sentinel). The hook derives `activeDocumentId` from it
 * (falling back to the first loaded document) and auto-loads that selection's saved chunks on
 * mount/selection-change (021-sources-chunking-embeddings-refresh spec FR-001–FR-003) — separate
 * from `run()`, which stays a purely explicit, caller-triggered recompute.
 */
export function useFixedSizeChunking(
  corpusId: string | null,
  selectedDocumentId: string = '',
): UseFixedSizeChunking {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(corpusId !== null)
  const [status, setStatus] = useState<ChunkingRunStatus>('idle')
  const [progressPercent, setProgressPercent] = useState(0)
  const [result, setResult] = useState<ChunkingResult | null>(null)
  const [chunkOrigin, setChunkOrigin] = useState<ChunkOrigin>(null)
  const [saveStatus, setSaveStatus] = useState<ChunkingSaveStatus>('idle')
  const [saveProgressPercent, setSaveProgressPercent] = useState(0)
  const [hasSavedOnce, setHasSavedOnce] = useState(false)
  const [currentSelection, setCurrentSelection] = useState<string | null>(null)
  const [currentRunParams, setCurrentRunParams] = useState<RunParams | null>(null)
  // Guards the auto-load effects below against clobbering a manual run() that completes (or is
  // triggered) while a saved-chunks fetch for the same selection is still in flight — reset
  // whenever the active selection changes, flipped true the moment run() is called.
  const userTriggeredRunRef = useRef(false)
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

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''

  // Auto-load a single document's saved chunks whenever the active selection changes (spec
  // FR-001/FR-002) — separate from run(), which is the only thing allowed to *recompute* them.
  useEffect(() => {
    userTriggeredRunRef.current = false

    if (activeDocumentId === '' || isEntireCorpusSelection(activeDocumentId)) {
      return
    }

    let cancelled = false
    listSavedChunks(activeDocumentId).then((chunks) => {
      if (cancelled || userTriggeredRunRef.current) {
        return
      }
      if (chunks.length > 0) {
        setResult(toChunkingResult(chunks))
        setStatus('success')
        setChunkOrigin('auto-loaded')
        setHasSavedOnce(true)
      } else {
        setResult(null)
        setStatus('idle')
        setChunkOrigin(null)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeDocumentId])

  // Same auto-load, fanned out across every document in the corpus for "Entire Corpus" (spec
  // FR-003) — mirrors the read-only concurrent-fetch pattern already used by useVectorView's
  // chunkGroups effect (018-ui-polish-batch).
  useEffect(() => {
    if (!isEntireCorpusSelection(activeDocumentId)) {
      return
    }

    if (documents.length === 0) {
      setBatchResults([])
      return
    }

    let cancelled = false
    Promise.all(
      documents.map((doc) =>
        listSavedChunks(doc.id).then((chunks) => ({
          documentId: doc.id,
          documentName: doc.name,
          status: 'success' as const,
          result: { extractionFailed: false, result: toChunkingResult(chunks) },
        })),
      ),
    ).then((results) => {
      if (cancelled || userTriggeredRunRef.current) {
        return
      }
      setBatchResults(results)
      setStatus('success')
      setChunkOrigin('auto-loaded')
      if (results.some((r) => r.result.result.totalChunks > 0)) {
        setHasSavedOnce(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeDocumentId, documents])

  // `isEntireCorpus` reflects the last completed run() once one has happened (`currentSelection`),
  // and otherwise falls back to the currently active dropdown selection — so the entire-corpus
  // summary UI renders for auto-loaded results too, before any run() has occurred.
  const effectiveSelection = currentSelection ?? activeDocumentId
  const isEntireCorpus = effectiveSelection !== '' && isEntireCorpusSelection(effectiveSelection)

  const run = useCallback(
    (selection: string, chunkSize: number, overlap = 0) => {
      userTriggeredRunRef.current = true
      closeStreamRef.current?.()
      setSaveStatus('idle')
      setSaveProgressPercent(0)
      setBatchResults([])
      setBatchProgress(null)
      setResult(null)
      setChunkOrigin(null)
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
          setChunkOrigin('computed')
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
            setChunkOrigin('computed')
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

  // Auto-loaded chunks are, by definition, already persisted (that's why they exist to load) —
  // "Saved" should read as such even though save() was never called in this session.
  const isSaved = chunkOrigin === 'auto-loaded' || (status === 'success' && savedRunId === currentRunId)

  return {
    documents,
    isLoadingDocuments,
    activeDocumentId,
    status,
    progressPercent,
    result,
    chunkOrigin,
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
