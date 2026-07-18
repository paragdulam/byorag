import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  EmbeddingGenerateResult,
  EmbeddingModelOption,
  EmbeddingSaveResult,
  SavedChunk,
} from '../types/embeddings'
import type { SourceDocument } from '../types/sourceDocument'
import {
  generateEmbeddingsStream,
  listEmbeddingModels,
  saveEmbeddingsStream,
} from '../lib/embeddingsApi'
import { listSavedChunks } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'
import { isEntireCorpusSelection } from '../lib/entireCorpusSelection'
import { runSequentialBatch, type BatchItemResult, type BatchProgress } from '../lib/batchRunner'

export type EmbeddingsGenerateStatus = 'idle' | 'generating' | 'success' | 'error'
export type EmbeddingsSaveStatus = 'idle' | 'saving' | 'success' | 'error'

function generateEmbeddingsStreamAsPromise(
  documentId: string,
  model: string,
  onDocumentProgress: (percent: number) => void,
): Promise<EmbeddingGenerateResult> {
  return new Promise((resolve, reject) => {
    generateEmbeddingsStream(documentId, model, {
      onProgress: onDocumentProgress,
      onResult: (result) => resolve(result),
      onError: (message) => reject(new Error(message ?? 'Failed to generate embeddings')),
    })
  })
}

function saveEmbeddingsStreamAsPromise(
  documentId: string,
  model: string,
  onDocumentProgress: (percent: number) => void,
): Promise<EmbeddingSaveResult> {
  return new Promise((resolve, reject) => {
    saveEmbeddingsStream(documentId, model, {
      onProgress: onDocumentProgress,
      onResult: (result) => resolve(result),
      onError: (message) => reject(new Error(message ?? 'Failed to save embeddings')),
    })
  })
}

export interface UseChunkEmbeddings {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  models: EmbeddingModelOption[]
  savedChunks: SavedChunk[]
  isLoadingSavedChunks: boolean
  generateStatus: EmbeddingsGenerateStatus
  progressPercent: number
  preview: EmbeddingGenerateResult | null
  generate: (selection: string, model: string) => void
  saveStatus: EmbeddingsSaveStatus
  saveProgressPercent: number
  save: () => void
  hasSavedOnce: boolean
  isEntireCorpus: boolean
  batchProgress: BatchProgress | null
  batchResults: BatchItemResult<EmbeddingGenerateResult>[]
}

export function useChunkEmbeddings(
  corpusId: string | null,
  documentId: string | null,
): UseChunkEmbeddings {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(corpusId !== null)
  const [models, setModels] = useState<EmbeddingModelOption[]>([])
  const [savedChunks, setSavedChunks] = useState<SavedChunk[]>([])
  const [isLoadingSavedChunks, setIsLoadingSavedChunks] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<EmbeddingsGenerateStatus>('idle')
  const [progressPercent, setProgressPercent] = useState(0)
  const [preview, setPreview] = useState<EmbeddingGenerateResult | null>(null)
  const [saveStatus, setSaveStatus] = useState<EmbeddingsSaveStatus>('idle')
  const [saveProgressPercent, setSaveProgressPercent] = useState(0)
  const [hasSavedOnce, setHasSavedOnce] = useState(false)
  const [currentSelection, setCurrentSelection] = useState<string | null>(null)
  const [currentModel, setCurrentModel] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [batchResults, setBatchResults] = useState<BatchItemResult<EmbeddingGenerateResult>[]>([])
  const closeGenerateStreamRef = useRef<(() => void) | null>(null)
  const closeSaveStreamRef = useRef<(() => void) | null>(null)

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
    }
  }, [corpusId])

  useEffect(() => {
    let cancelled = false

    listEmbeddingModels().then((options) => {
      if (!cancelled) {
        setModels(options)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // "Entire Corpus" has no single document's saved chunks to preview — treated the same
    // as no selection for this effect (018-ui-polish-batch research.md §1).
    if (documentId === null || isEntireCorpusSelection(documentId)) {
      setSavedChunks([])
      setIsLoadingSavedChunks(false)
      return
    }

    let cancelled = false
    setIsLoadingSavedChunks(true)

    listSavedChunks(documentId)
      .then((chunks) => {
        if (!cancelled) {
          setSavedChunks(chunks)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSavedChunks(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [documentId])

  const isEntireCorpus = documentId !== null && isEntireCorpusSelection(documentId)

  const generate = useCallback(
    (selection: string, model: string) => {
      closeGenerateStreamRef.current?.()
      setGenerateStatus('generating')
      setProgressPercent(0)
      setPreview(null)
      setSaveStatus('idle')
      setSaveProgressPercent(0)
      setBatchResults([])
      setBatchProgress(null)
      setCurrentSelection(selection)
      setCurrentModel(model)

      if (isEntireCorpusSelection(selection)) {
        void runSequentialBatch(
          documents,
          (doc, reportDocumentProgress) =>
            generateEmbeddingsStreamAsPromise(doc.id, model, reportDocumentProgress),
          (progress) => setBatchProgress(progress),
        ).then((results) => {
          setBatchProgress(null)
          setBatchResults(results)
          setGenerateStatus(results.some((r) => r.status === 'success') ? 'success' : 'error')
        })
        return
      }

      closeGenerateStreamRef.current = generateEmbeddingsStream(selection, model, {
        onProgress: (percent) => setProgressPercent(percent),
        onResult: (result) => {
          setGenerateStatus('success')
          setPreview(result)
        },
        onError: () => {
          setGenerateStatus('error')
          setPreview(null)
        },
      })
    },
    [documents],
  )

  // save() persists whatever the last generate() call produced — for a single document, the
  // preview's own documentId/model (the source of truth for what to save, independent of
  // generateStatus/progressPercent); for "Entire Corpus", a sequential per-document save batch
  // using that same selected model (018-ui-polish-batch contracts/entire-corpus-batch-orchestration.md).
  // Entirely independent of the Chunking screen's own save state (no shared hook/state between
  // the two screens — spec FR-008).
  const save = useCallback(() => {
    if (currentSelection !== null && isEntireCorpusSelection(currentSelection)) {
      if (currentModel === null) {
        return
      }
      setSaveStatus('saving')
      setBatchProgress(null)
      void runSequentialBatch(
        documents,
        (doc, reportDocumentProgress) =>
          saveEmbeddingsStreamAsPromise(doc.id, currentModel, reportDocumentProgress),
        (progress) => setBatchProgress(progress),
      ).then((results) => {
        setBatchProgress(null)
        setBatchResults(results)
        if (results.some((r) => r.status === 'success')) {
          setSaveStatus('success')
          setHasSavedOnce(true)
        } else {
          setSaveStatus('error')
        }
      })
      return
    }

    if (preview === null) {
      return
    }

    closeSaveStreamRef.current?.()
    setSaveStatus('saving')
    setSaveProgressPercent(0)

    closeSaveStreamRef.current = saveEmbeddingsStream(preview.documentId, preview.model, {
      onProgress: (percent) => setSaveProgressPercent(percent),
      onResult: () => {
        setSaveStatus('success')
        setHasSavedOnce(true)
      },
      onError: () => {
        setSaveStatus('error')
      },
    })
  }, [preview, currentSelection, currentModel, documents])

  return {
    documents,
    isLoadingDocuments,
    models,
    savedChunks,
    isLoadingSavedChunks,
    generateStatus,
    progressPercent,
    preview,
    generate,
    saveStatus,
    saveProgressPercent,
    save,
    hasSavedOnce,
    isEntireCorpus,
    batchProgress,
    batchResults,
  }
}
