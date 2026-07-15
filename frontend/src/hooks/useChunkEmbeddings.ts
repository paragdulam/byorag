import { useCallback, useEffect, useRef, useState } from 'react'
import type { EmbeddingGenerateResult, EmbeddingModelOption, SavedChunk } from '../types/embeddings'
import type { SourceDocument } from '../types/sourceDocument'
import {
  generateEmbeddingsStream,
  listEmbeddingModels,
  saveEmbeddingsStream,
} from '../lib/embeddingsApi'
import { listSavedChunks } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'

export type EmbeddingsGenerateStatus = 'idle' | 'generating' | 'success' | 'error'
export type EmbeddingsSaveStatus = 'idle' | 'saving' | 'success' | 'error'

export interface UseChunkEmbeddings {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  models: EmbeddingModelOption[]
  savedChunks: SavedChunk[]
  isLoadingSavedChunks: boolean
  generateStatus: EmbeddingsGenerateStatus
  progressPercent: number
  preview: EmbeddingGenerateResult | null
  generate: (documentId: string, model: string) => void
  saveStatus: EmbeddingsSaveStatus
  saveProgressPercent: number
  save: () => void
  hasSavedOnce: boolean
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
    if (documentId === null) {
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

  const generate = useCallback((documentId: string, model: string) => {
    closeGenerateStreamRef.current?.()
    setGenerateStatus('generating')
    setProgressPercent(0)
    setPreview(null)

    closeGenerateStreamRef.current = generateEmbeddingsStream(documentId, model, {
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
  }, [])

  // save() persists the most recently generated preview — its documentId/model, not a
  // separately tracked "last generate call" (the preview itself is the source of truth
  // for what to save). Independent of generateStatus/progressPercent, and entirely
  // independent of the Chunking screen's own save state (no shared hook/state between
  // the two screens — spec FR-008).
  const save = useCallback(() => {
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
        // hasSavedOnce is a one-way latch (research.md §5, mirrors 012's hasSavedOnce):
        // set true only here, on a successful save, and never reset — even if a later
        // generate or save fails.
        setHasSavedOnce(true)
      },
      onError: () => {
        setSaveStatus('error')
      },
    })
  }, [preview])

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
  }
}
