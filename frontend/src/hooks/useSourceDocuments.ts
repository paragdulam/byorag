import { useCallback, useEffect, useState } from 'react'
import type { DeletionResult, SourceDocument, UploadRejection } from '../types/sourceDocument'
import { validateFile } from '../lib/fileValidation'
import { MAX_UPLOAD_SIZE_BYTES, ACCEPTED_UPLOAD_TYPES } from '../lib/uploadConstraints'
import { deleteSources, listSources, uploadSources } from '../lib/sourcesApi'

export interface UseSourceDocuments {
  documents: SourceDocument[]
  rejections: UploadRejection[]
  deletionErrors: DeletionResult[]
  isLoading: boolean
  addFiles: (files: File[]) => void
  clearRejections: () => void
  deleteDocuments: (ids: string[]) => void
  clearDeletionErrors: () => void
}

export function useSourceDocuments(): UseSourceDocuments {
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [rejections, setRejections] = useState<UploadRejection[]>([])
  const [deletionErrors, setDeletionErrors] = useState<DeletionResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    listSources()
      .then((docs) => {
        if (!cancelled) {
          // Merge rather than overwrite: an upload triggered before this
          // mount-time fetch resolves (e.g. in tests, or a very fast user)
          // may have already added optimistic/server-confirmed documents to
          // state, and those must not be clobbered by the initial load.
          setDocuments((prev) => {
            const prevIds = new Set(prev.map((doc) => doc.id))
            const notAlreadyPresent = docs.filter((doc) => !prevIds.has(doc.id))
            return [...prev, ...notAlreadyPresent]
          })
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const addFiles = useCallback((files: File[]) => {
    const clientRejections: UploadRejection[] = []
    const candidateFiles: File[] = []

    for (const file of files) {
      const result = validateFile(file, MAX_UPLOAD_SIZE_BYTES, ACCEPTED_UPLOAD_TYPES)
      if (result.valid) {
        candidateFiles.push(file)
      } else {
        clientRejections.push({ fileName: file.name, reason: result.reason })
      }
    }

    if (clientRejections.length > 0) {
      setRejections((prev) => [...prev, ...clientRejections])
    }

    if (candidateFiles.length === 0) {
      return
    }

    // Optimistic "processing" placeholders while the upload request is in
    // flight; replaced by the server-confirmed (already "processed")
    // documents once the request resolves. No fixed timer delay is used —
    // pre-existing documents loaded via listSources() are never given this
    // placeholder treatment (FR-007).
    const placeholderIds = candidateFiles.map(
      (file) => `pending:${file.name}:${crypto.randomUUID()}`,
    )
    const placeholders: SourceDocument[] = candidateFiles.map((file, index) => ({
      id: placeholderIds[index],
      name: file.name,
      sizeBytes: file.size,
      uploadedAt: new Date(),
      status: 'processing',
    }))
    setDocuments((prev) => [...prev, ...placeholders])

    uploadSources(candidateFiles)
      .then(({ documents: savedDocuments, rejections: serverRejections }) => {
        setDocuments((prev) => [
          ...prev.filter((doc) => !placeholderIds.includes(doc.id)),
          ...savedDocuments,
        ])
        if (serverRejections.length > 0) {
          setRejections((prev) => [...prev, ...serverRejections])
        }
      })
      .catch(() => {
        setDocuments((prev) => prev.filter((doc) => !placeholderIds.includes(doc.id)))
        setRejections((prev) => [
          ...prev,
          ...candidateFiles.map((file) => ({
            fileName: file.name,
            reason: 'save-failed' as const,
          })),
        ])
      })
  }, [])

  const clearRejections = useCallback(() => {
    setRejections([])
  }, [])

  const deleteDocuments = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      return
    }

    deleteSources(ids)
      .then((results) => {
        const deletedIds = new Set(
          results.filter((result) => result.status === 'deleted').map((result) => result.id),
        )
        const failedResults = results.filter((result) => result.status === 'failed')

        if (deletedIds.size > 0) {
          setDocuments((prev) => prev.filter((doc) => !deletedIds.has(doc.id)))
        }
        if (failedResults.length > 0) {
          setDeletionErrors((prev) => [...prev, ...failedResults])
        }
      })
      .catch(() => {
        setDeletionErrors((prev) => [
          ...prev,
          ...ids.map((id) => ({ id, status: 'failed' as const, reason: 'Request failed' })),
        ])
      })
  }, [])

  const clearDeletionErrors = useCallback(() => {
    setDeletionErrors([])
  }, [])

  return {
    documents,
    rejections,
    deletionErrors,
    isLoading,
    addFiles,
    clearRejections,
    deleteDocuments,
    clearDeletionErrors,
  }
}
