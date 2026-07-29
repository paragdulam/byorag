import { useEffect, useState } from 'react'
import type { ProjectionPoint, SavedChunk } from '../types/embeddings'
import { fetchProjection, listSavedEmbeddings } from '../lib/embeddingsApi'
import type { ProjectionEntryInput } from '../lib/embeddingsApi'

export const MIN_PROJECTION_ENTRIES = 5

export interface ProjectionDocumentGroup {
  documentId: string
  documentName: string
  chunks: SavedChunk[]
}

export interface ExcludedDocument {
  documentId: string
  documentName: string
}

export interface UseEmbeddingProjection {
  isResolvingEntries: boolean
  entryCount: number
  excludedDocuments: ExcludedDocument[]
  isComputing: boolean
  points: ProjectionPoint[] | null
  error: string | null
}

/**
 * Resolves the embedded-chunk entries for a document or entire-corpus scope (one group per
 * document — a single-document scope is just a one-element `groups` array) and, once `method`
 * is `"umap"`/`"pca"` and the 5-entry minimum is met, computes the 2D projection
 * (021-sources-chunking-embeddings-refresh spec FR-014–FR-018, contracts/embeddings-projection-
 * api.md). Documents contributing zero embedded chunks are reported via `excludedDocuments`
 * (FR-017) rather than silently dropped.
 */
export function useEmbeddingProjection(
  groups: ProjectionDocumentGroup[],
  method: string,
): UseEmbeddingProjection {
  const [entries, setEntries] = useState<ProjectionEntryInput[]>([])
  const [excludedDocuments, setExcludedDocuments] = useState<ExcludedDocument[]>([])
  const [isResolvingEntries, setIsResolvingEntries] = useState(false)
  const [points, setPoints] = useState<ProjectionPoint[] | null>(null)
  const [isComputing, setIsComputing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsResolvingEntries(true)

    Promise.all(
      groups.map((group) =>
        Promise.all(
          group.chunks.map((chunk) =>
            listSavedEmbeddings(chunk.id).then((embeddings): ProjectionEntryInput | null =>
              embeddings[0]
                ? { chunkId: chunk.id, documentId: group.documentId, vector: embeddings[0].vector }
                : null,
            ),
          ),
        ).then((resolved) => ({ group, resolved })),
      ),
    )
      .then((groupResults) => {
        if (cancelled) {
          return
        }
        const resolvedEntries: ProjectionEntryInput[] = []
        const excluded: ExcludedDocument[] = []
        for (const { group, resolved } of groupResults) {
          const groupEntries = resolved.filter((entry): entry is ProjectionEntryInput => entry !== null)
          if (groupEntries.length === 0) {
            excluded.push({ documentId: group.documentId, documentName: group.documentName })
          } else {
            resolvedEntries.push(...groupEntries)
          }
        }
        setEntries(resolvedEntries)
        setExcludedDocuments(excluded)
      })
      .finally(() => {
        if (!cancelled) {
          setIsResolvingEntries(false)
        }
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  useEffect(() => {
    if ((method !== 'umap' && method !== 'pca') || entries.length < MIN_PROJECTION_ENTRIES) {
      setPoints(null)
      setError(null)
      return
    }

    let cancelled = false
    setIsComputing(true)
    setError(null)

    fetchProjection(method, entries)
      .then((result) => {
        if (!cancelled) {
          setPoints(result)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to compute projection')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsComputing(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [entries, method])

  return {
    isResolvingEntries,
    entryCount: entries.length,
    excludedDocuments,
    isComputing,
    points,
    error,
  }
}
