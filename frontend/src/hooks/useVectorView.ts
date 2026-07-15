import { useEffect, useState } from 'react'
import type { ProjectionMethodOption, SavedChunk, SavedEmbedding } from '../types/embeddings'
import type { SourceDocument } from '../types/sourceDocument'
import { listProjectionMethods, listSavedEmbeddings } from '../lib/embeddingsApi'
import { listSavedChunks } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'

export interface UseVectorView {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  savedChunks: SavedChunk[]
  isLoadingSavedChunks: boolean
  savedEmbeddings: SavedEmbedding[]
  isLoadingSavedEmbeddings: boolean
  projectionMethods: ProjectionMethodOption[]
}

export function useVectorView(
  corpusId: string | null,
  documentId: string | null,
  chunkId: string | null,
): UseVectorView {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(corpusId !== null)
  const [savedChunks, setSavedChunks] = useState<SavedChunk[]>([])
  const [isLoadingSavedChunks, setIsLoadingSavedChunks] = useState(false)
  const [savedEmbeddings, setSavedEmbeddings] = useState<SavedEmbedding[]>([])
  const [isLoadingSavedEmbeddings, setIsLoadingSavedEmbeddings] = useState(false)
  const [projectionMethods, setProjectionMethods] = useState<ProjectionMethodOption[]>([])

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

  useEffect(() => {
    if (chunkId === null) {
      setSavedEmbeddings([])
      setIsLoadingSavedEmbeddings(false)
      return
    }

    let cancelled = false
    setIsLoadingSavedEmbeddings(true)

    listSavedEmbeddings(chunkId)
      .then((embeddings) => {
        if (!cancelled) {
          setSavedEmbeddings(embeddings)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSavedEmbeddings(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [chunkId])

  useEffect(() => {
    let cancelled = false

    listProjectionMethods().then((methods) => {
      if (!cancelled) {
        setProjectionMethods(methods)
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  return {
    documents,
    isLoadingDocuments,
    savedChunks,
    isLoadingSavedChunks,
    savedEmbeddings,
    isLoadingSavedEmbeddings,
    projectionMethods,
  }
}
