import { useCallback, useEffect, useState } from 'react'
import type { PlaygroundContext, Turn } from '../types/playground'
import type { SourceDocument } from '../types/sourceDocument'
import {
  QueryTooLongError,
  createTurn,
  generateAnswer,
  getPlaygroundContext,
  listTurns,
} from '../lib/playgroundApi'
import { listSources } from '../lib/sourcesApi'
import { isEntireCorpusSelection } from '../lib/entireCorpusSelection'

export type SendStatus = 'idle' | 'sending' | 'error' | 'query-too-long'

export interface UsePlaygroundConversation {
  documents: SourceDocument[]
  isLoadingDocuments: boolean
  context: PlaygroundContext | null
  isLoadingContext: boolean
  turns: Turn[]
  sendStatus: SendStatus
  /** Non-null while a Generate/retry request for that specific turn is in flight. */
  generatingTurnId: string | null
  /** True while any retrieval or generation request is in flight (spec FR-013) — the UI
   * disables Send and every Generate/retry control while this is true. */
  isBusy: boolean
  /** The turn whose retrieval/generation details the right panel should show. `null` means
   * "no explicit selection" — the UI falls back to the newest turn (spec FR-010). */
  selectedTurnId: string | null
  send: (query: string) => void
  generate: (turnId: string) => void
  /** Selects a turn to inspect (spec FR-018) — purely client-side, no network request,
   * since the turn's data is already loaded. */
  selectTurn: (turnId: string) => void
}

export function usePlaygroundConversation(
  corpusId: string | null,
  documentId: string | null,
): UsePlaygroundConversation {
  // "Entire Corpus" is a valid selection value for `documentId` (the shared sentinel from
  // 018-ui-polish-batch's document selectors) meaning every question in this hook should be
  // scoped to the whole corpus instead of one document (019-metrics-dashboard US4).
  const isEntireCorpus = documentId !== null && isEntireCorpusSelection(documentId)
  const scope: { documentId: string } | { corpusId: string } | null =
    isEntireCorpus && corpusId !== null
      ? { corpusId }
      : documentId !== null && !isEntireCorpus
        ? { documentId }
        : null
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(corpusId !== null)
  const [context, setContext] = useState<PlaygroundContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle')
  const [generatingTurnId, setGeneratingTurnId] = useState<string | null>(null)
  const [selectedTurnId, setSelectedTurnId] = useState<string | null>(null)

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
    // Clearing before the fetch resolves (not just on failure) ensures a document switch
    // never briefly shows the previous document's context or conversation (spec FR-017).
    setContext(null)
    setTurns([])
    setSendStatus('idle')
    setGeneratingTurnId(null)
    setSelectedTurnId(null)

    if (scope === null) {
      setIsLoadingContext(false)
      return
    }

    let cancelled = false
    setIsLoadingContext(true)

    getPlaygroundContext(scope)
      .then((result) => {
        if (!cancelled) {
          setContext(result)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingContext(false)
        }
      })

    // Auto-loads this document's/corpus's full prior conversation (spec FR-017) —
    // independent of the context fetch above, so a slow/failed context load never blocks the
    // conversation from appearing (and vice versa).
    listTurns(scope)
      .then((result) => {
        if (!cancelled) {
          setTurns(result.turns)
        }
      })
      .catch(() => {
        // No prior conversation to restore is not an error state worth surfacing here —
        // the screen simply starts with an empty conversation, same as a document that
        // genuinely has none yet.
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, corpusId])

  const isBusy = sendStatus === 'sending' || generatingTurnId !== null

  const send = useCallback(
    (query: string) => {
      if (scope === null || context?.embeddingModel == null || !query.trim() || isBusy) {
        return
      }

      setSendStatus('sending')

      createTurn({ ...scope, model: context.embeddingModel, query })
        .then((turn) => {
          setTurns((prev) => [...prev, turn])
          setSendStatus('idle')
          setSelectedTurnId(null)
        })
        .catch((error: unknown) => {
          setSendStatus(error instanceof QueryTooLongError ? 'query-too-long' : 'error')
        })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documentId, corpusId, context, isBusy],
  )

  const generate = useCallback(
    (turnId: string) => {
      if (isBusy) {
        return
      }

      setGeneratingTurnId(turnId)

      generateAnswer(turnId)
        .then((updated) => {
          setTurns((prev) => prev.map((turn) => (turn.id === turnId ? updated : turn)))
        })
        .catch(() => {
          setTurns((prev) =>
            prev.map((turn) =>
              turn.id === turnId
                ? { ...turn, error: 'Failed to generate an answer. Please try again.' }
                : turn,
            ),
          )
        })
        .finally(() => {
          setGeneratingTurnId(null)
        })
    },
    [isBusy],
  )

  const selectTurn = useCallback((turnId: string) => {
    setSelectedTurnId(turnId)
  }, [])

  return {
    documents,
    isLoadingDocuments,
    context,
    isLoadingContext,
    turns,
    sendStatus,
    generatingTurnId,
    isBusy,
    selectedTurnId,
    send,
    generate,
    selectTurn,
  }
}
