import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { usePlaygroundConversation } from '../../hooks/usePlaygroundConversation'
import { useCorpus } from '../../context/CorpusContext'
import { ENTIRE_CORPUS_SELECTION, isEntireCorpusSelection } from '../../lib/entireCorpusSelection'
import { PlaygroundTurnDetail } from './PlaygroundTurnDetail'

export interface PlaygroundScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function PlaygroundScreen({ onNavigate }: PlaygroundScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [queryText, setQueryText] = useState('')

  const { documents, context, turns, sendStatus, generatingTurnId, isBusy, send, generate } =
    usePlaygroundConversation(activeCorpusId, selectedDocumentId || null)

  // Keeps selectedDocumentId itself valid once documents load, so the hook call above
  // receives the auto-selected document — otherwise, with only one document, nothing
  // ever sets selectedDocumentId and context/conversation never load (015-fix-saved-chunks-
  // not-showing established this exact pattern for Embeddings/Vector View). "Entire Corpus" is
  // always a valid selection regardless of the current document list (018-ui-polish-batch) —
  // it must never be reset back to a single document here.
  useEffect(() => {
    setSelectedDocumentId((prev) =>
      documents.some((doc) => doc.id === prev) || isEntireCorpusSelection(prev)
        ? prev
        : (documents[0]?.id ?? ''),
    )
  }, [documents])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''
  const isEntireCorpus = isEntireCorpusSelection(activeDocumentId)

  const handleSend = () => {
    send(queryText)
    setQueryText('')
  }

  return (
    <AppShell activeScreen="playground" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Playground</h1>
          <p className="mt-2 text-on-surface-variant">
            Ask a question and see, in sequence, its query embedding, the evidence it
            retrieved, and its generated answer (031-playground-metrics-redesign).
          </p>
        </div>

        {documents.length === 0 ? (
          <p className="mt-8 text-on-surface-variant">
            No documents available. Upload a PDF from the Sources screen first.
          </p>
        ) : (
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <div className="shrink-0">
              <label className="block text-sm text-on-surface-variant" htmlFor="playground-document">
                Select Document
              </label>
              <select
                id="playground-document"
                aria-label="Select document"
                value={activeDocumentId}
                onChange={(event) => setSelectedDocumentId(event.target.value)}
                className="mt-1 rounded border border-outline-variant bg-surface p-2 text-on-surface"
              >
                <option value={ENTIRE_CORPUS_SELECTION}>Entire Corpus</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>

            <div data-testid="playground-context" className="mt-4 shrink-0 text-sm text-on-surface-variant">
              <p>
                Chunking strategy: <strong>{context?.chunkingStrategy ?? '—'}</strong>
              </p>
              <p>
                Embedding model: <strong>{context?.embeddingModel ?? '—'}</strong>
              </p>
              {context !== null && context.embeddingModel === null && (
                <p className="mt-1 text-on-surface-variant">
                  No saved embeddings for {isEntireCorpus ? 'this corpus' : 'this document'} yet.
                  Generate and save embeddings from the Embeddings screen first.
                </p>
              )}
            </div>

            {sendStatus === 'error' && (
              <p role="alert" className="mt-2 shrink-0 text-sm text-error">
                Something went wrong retrieving chunks for that question. Please try again.
              </p>
            )}
            {sendStatus === 'query-too-long' && (
              <p role="alert" className="mt-2 shrink-0 text-sm text-error">
                Question is too long. Try a shorter question.
              </p>
            )}

            {/* Single full-width sequential flow (031-playground-metrics-redesign US1
                FR-001): every turn shows its own question, query embedding, retrieved
                evidence, and answer inline — no left/right panel split. */}
            <div
              data-testid="playground-turns"
              className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
            >
              {turns.map((turn) => (
                <PlaygroundTurnDetail
                  key={turn.id}
                  turn={turn}
                  isBusy={isBusy}
                  isGenerating={generatingTurnId === turn.id}
                  onRetry={() => generate(turn.id)}
                />
              ))}
            </div>

            <div className="mt-4 flex shrink-0 items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm text-on-surface-variant" htmlFor="playground-query">
                  Question
                </label>
                <input
                  id="playground-query"
                  aria-label="Question"
                  type="text"
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSend()
                    }
                  }}
                  className="mt-1 w-full rounded border border-outline-variant bg-surface p-2 text-on-surface"
                />
              </div>
              <button
                type="button"
                aria-label="Send"
                onClick={handleSend}
                disabled={isBusy || queryText.trim().length === 0}
                className="rounded bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
