import { useEffect, useRef, useState } from 'react'
import { createEntry, draftAnswer, searchCandidates, updateEntry } from '../../lib/goldenDatasetApi'
import type { GoldenCandidate, GoldenEntry, GoldenEntryStatus } from '../../types/goldenDataset'
import { EvidenceChunkPicker } from './EvidenceChunkPicker'

const SEARCH_DEBOUNCE_MS = 300

/** The search-facing scope is exactly one of documentId/corpusId (matching every other
 * search-like endpoint in this codebase, e.g. Playground's own `search`/`search_corpus`
 * split) — narrower than a search a document is part of. */
function toSearchScope(scope: { corpusId: string; documentId: string | null }) {
  return scope.documentId !== null
    ? { documentId: scope.documentId }
    : { corpusId: scope.corpusId }
}

/** An existing entry's saved chunks, shown in the same picker as fresh search candidates —
 * they weren't "matched" by any live search, they're just already part of this entry. */
function chunksAsCandidates(entry: GoldenEntry): GoldenCandidate[] {
  return entry.chunks.map((chunk) => ({
    // A snapshot chunk's live chunk_id can be null (re-chunk set it to NULL, FR-016) — fall
    // back to the snapshot row's own id so it still has a stable selection key.
    chunkId: chunk.chunkId ?? chunk.id,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    matchedQuestion: false,
    matchedAnswer: false,
  }))
}

export interface GoldenEntryEditorProps {
  scope: { corpusId: string; documentId: string | null }
  /** When given, the editor opens in edit/review mode for this existing entry (US2 FR-012,
   * FR-017) instead of creating a new one. */
  initialEntry?: GoldenEntry
  onSaved: (entry: GoldenEntry) => void
  /** Closes the editor without saving — omitted (no Cancel button rendered) if the caller has
   * no way to dismiss it, e.g. no embedding context provides one. */
  onCancel?: () => void
}

export function GoldenEntryEditor({ scope, initialEntry, onSaved, onCancel }: GoldenEntryEditorProps) {
  const [question, setQuestion] = useState(initialEntry?.question ?? '')
  const [answer, setAnswer] = useState(initialEntry?.preferredAnswer ?? '')
  const [candidates, setCandidates] = useState<GoldenCandidate[]>(
    initialEntry ? chunksAsCandidates(initialEntry) : [],
  )
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(
    new Set(initialEntry ? chunksAsCandidates(initialEntry).map((c) => c.chunkId) : []),
  )
  const [isDrafting, setIsDrafting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Never re-force a chunk's checkbox state once the user has seen (and possibly toggled) it,
  // even if it reappears in a later search — only the *first* appearance of a "matched both"
  // chunk gets auto-checked (FR-005).
  const seenChunkIds = useRef<Set<string>>(
    new Set(initialEntry ? chunksAsCandidates(initialEntry).map((c) => c.chunkId) : []),
  )
  const candidateByChunkId = useRef<Map<string, GoldenCandidate>>(
    new Map((initialEntry ? chunksAsCandidates(initialEntry) : []).map((c) => [c.chunkId, c])),
  )

  useEffect(() => {
    if (!question.trim()) {
      return
    }
    const timer = setTimeout(() => {
      searchCandidates(toSearchScope(scope), question, answer).then((results) => {
        setCandidates((prev) => {
          const existingIds = new Set(prev.map((candidate) => candidate.chunkId))
          const merged = [...prev]
          for (const candidate of results) {
            if (!existingIds.has(candidate.chunkId)) {
              merged.push(candidate)
            }
          }
          return merged
        })
        setSelectedChunkIds((prev) => {
          const next = new Set(prev)
          for (const candidate of results) {
            candidateByChunkId.current.set(candidate.chunkId, candidate)
            if (!seenChunkIds.current.has(candidate.chunkId)) {
              seenChunkIds.current.add(candidate.chunkId)
              if (candidate.matchedQuestion && candidate.matchedAnswer) {
                next.add(candidate.chunkId)
              }
            }
          }
          return next
        })
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [question, answer, scope])

  function handleToggle(chunkId: string, candidate: GoldenCandidate) {
    candidateByChunkId.current.set(chunkId, candidate)
    setSelectedChunkIds((prev) => {
      const next = new Set(prev)
      if (next.has(chunkId)) {
        next.delete(chunkId)
      } else {
        next.add(chunkId)
      }
      return next
    })
  }

  async function handleManualSearch(query: string) {
    const results = await searchCandidates(toSearchScope(scope), query)
    setCandidates((prev) => {
      const existingIds = new Set(prev.map((candidate) => candidate.chunkId))
      const merged = [...prev]
      for (const candidate of results) {
        candidateByChunkId.current.set(candidate.chunkId, candidate)
        if (!existingIds.has(candidate.chunkId)) {
          merged.push(candidate)
        }
      }
      return merged
    })
  }

  function selectedCandidates(): GoldenCandidate[] {
    return [...selectedChunkIds]
      .map((chunkId) => candidateByChunkId.current.get(chunkId))
      .filter((candidate): candidate is GoldenCandidate => candidate !== undefined)
  }

  async function handleDraft() {
    setIsDrafting(true)
    try {
      const chunks = selectedCandidates().map((candidate) => ({
        chunkIndex: candidate.chunkIndex,
        content: candidate.content,
      }))
      const draft = await draftAnswer(question, chunks)
      setAnswer(draft)
    } finally {
      setIsDrafting(false)
    }
  }

  function currentChunks() {
    return selectedCandidates().map((candidate) => ({
      chunkId: candidate.chunkId,
      documentId: candidate.documentId,
      chunkIndex: candidate.chunkIndex,
      content: candidate.content,
    }))
  }

  async function handleSave(status?: GoldenEntryStatus) {
    // Manual creation always becomes "approved"; editing an existing entry keeps its current
    // status unless a transition is explicitly requested — either way, "approved" always
    // requires at least one evidence chunk (FR-002/FR-018's invariant applies to every save).
    const resultingStatus = status ?? initialEntry?.status ?? 'approved'
    if (resultingStatus === 'approved' && selectedChunkIds.size === 0) {
      setSaveError('At least one evidence chunk is required before saving.')
      return
    }
    setSaveError(null)
    setIsSaving(true)
    try {
      if (initialEntry === undefined) {
        const entry = await createEntry({
          corpusId: scope.corpusId,
          documentId: scope.documentId,
          question,
          preferredAnswer: answer,
          chunks: currentChunks(),
        })
        onSaved(entry)
      } else {
        const entry = await updateEntry(initialEntry.id, {
          question,
          preferredAnswer: answer,
          chunks: currentChunks(),
          ...(status !== undefined ? { status } : {}),
        })
        onSaved(entry)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const status = initialEntry?.status

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="golden-entry-question" className="block text-sm text-on-surface-variant">
          Question
        </label>
        <textarea
          id="golden-entry-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
          rows={2}
        />
      </div>

      <div>
        <label htmlFor="golden-entry-answer" className="block text-sm text-on-surface-variant">
          Preferred Answer
        </label>
        <textarea
          id="golden-entry-answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
          rows={4}
        />
        <button
          type="button"
          onClick={handleDraft}
          disabled={isDrafting || selectedChunkIds.size === 0}
          className="mt-2 rounded border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
        >
          Draft from selected chunks →
        </button>
      </div>

      <div>
        <h3 className="text-sm font-medium text-on-surface">Evidence Chunks</h3>
        <div className="mt-2">
          <EvidenceChunkPicker
            candidates={candidates}
            selectedChunkIds={selectedChunkIds}
            onToggle={handleToggle}
            onManualSearch={handleManualSearch}
          />
        </div>
      </div>

      {saveError !== null && (
        <p role="alert" className="text-sm text-error">
          {saveError}
        </p>
      )}

      <div className="flex gap-2">
        {status === undefined && (
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        )}

        {status === 'approved' && (
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Changes
          </button>
        )}

        {status === 'pending_review' && (
          <>
            <button
              type="button"
              onClick={() => handleSave('approved')}
              disabled={isSaving}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => handleSave('rejected')}
              disabled={isSaving}
              className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}

        {status === 'rejected' && (
          <>
            <button
              type="button"
              onClick={() => handleSave('pending_review')}
              disabled={isSaving}
              className="rounded border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
            >
              Move to Pending Review
            </button>
            <button
              type="button"
              onClick={() => handleSave('approved')}
              disabled={isSaving}
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
          </>
        )}

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
