import { useEffect, useState } from 'react'
import type { ProjectionMethodOption, SavedChunk, SavedEmbedding } from '../types/embeddings'
import type { SourceDocument } from '../types/sourceDocument'
import { listProjectionMethods, listSavedEmbeddings } from '../lib/embeddingsApi'
import { listSavedChunks } from '../lib/chunkingApi'
import { listSources } from '../lib/sourcesApi'
import { isEntireCorpusSelection } from '../lib/entireCorpusSelection'

export interface ChunkGroup {
  documentId: string
  documentName: string
  chunks: SavedChunk[]
}

export interface UseVectorView {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  savedChunks: SavedChunk[]
  isLoadingSavedChunks: boolean
  savedEmbeddings: SavedEmbedding[]
  isLoadingSavedEmbeddings: boolean
  projectionMethods: ProjectionMethodOption[]
  isEntireCorpus: boolean
  chunkGroups: ChunkGroup[]
  isLoadingChunkGroups: boolean
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
  const [chunkGroups, setChunkGroups] = useState<ChunkGroup[]>([])
  const [isLoadingChunkGroups, setIsLoadingChunkGroups] = useState(false)

  const isEntireCorpus = documentId !== null && isEntireCorpusSelection(documentId)

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
    // "Entire Corpus" has no single document's saved chunks to load here — its combined
    // list is built by the chunkGroups effect below instead (018-ui-polish-batch research.md §1).
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

  useEffect(() => {
    if (documentId === null || !isEntireCorpusSelection(documentId)) {
      setChunkGroups([])
      setIsLoadingChunkGroups(false)
      return
    }

    let cancelled = false
    setIsLoadingChunkGroups(true)

    // Read-only GETs against today's existing per-document endpoint — no ordering/streaming
    // contract to preserve (unlike the entire-corpus chunk/embed *run* batches), so they're
    // fetched concurrently and re-assembled in document-list order
    // (contracts/vector-view-entire-corpus-listing.md).
    Promise.all(
      documents.map((doc) => listSavedChunks(doc.id).then((chunks) => ({ doc, chunks }))),
    )
      .then((results) => {
        if (cancelled) {
          return
        }
        setChunkGroups(
          results
            .filter((r) => r.chunks.length > 0)
            .map((r) => ({ documentId: r.doc.id, documentName: r.doc.name, chunks: r.chunks })),
        )
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingChunkGroups(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [documentId, documents])

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
    isEntireCorpus,
    chunkGroups,
    isLoadingChunkGroups,
  }
}
