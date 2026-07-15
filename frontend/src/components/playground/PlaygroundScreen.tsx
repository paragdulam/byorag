import { useEffect, useState } from 'react'
import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'
import { usePlaygroundConversation } from '../../hooks/usePlaygroundConversation'
import { useCorpus } from '../../context/CorpusContext'
import { ConversationPanel } from './ConversationPanel'
import { RetrievalPanel } from './RetrievalPanel'

export interface PlaygroundScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function PlaygroundScreen({ onNavigate }: PlaygroundScreenProps) {
  const { activeCorpusId } = useCorpus()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('')
  const [queryText, setQueryText] = useState('')

  const {
    documents,
    context,
    turns,
    sendStatus,
    generatingTurnId,
    isBusy,
    selectedTurnId,
    send,
    generate,
    selectTurn,
  } = usePlaygroundConversation(activeCorpusId, selectedDocumentId || null)

  // Keeps selectedDocumentId itself valid once documents load, so the hook call above
  // receives the auto-selected document — otherwise, with only one document, nothing
  // ever sets selectedDocumentId and context/conversation never load (015-fix-saved-chunks-
  // not-showing established this exact pattern for Embeddings/Vector View).
  useEffect(() => {
    setSelectedDocumentId((prev) => (documents.some((doc) => doc.id === prev) ? prev : documents[0]?.id ?? ''))
  }, [documents])

  const activeDocumentId = selectedDocumentId || documents[0]?.id || ''

  // The right panel reflects the selected turn, defaulting to the most recently submitted
  // question (spec FR-010) — User Story 2 lets the user override this by clicking a past
  // answer (TurnBubble's onSelect, wired below).
  const newestTurn = turns.length > 0 ? turns[turns.length - 1] : null
  const activeTurn = selectedTurnId !== null ? (turns.find((turn) => turn.id === selectedTurnId) ?? newestTurn) : newestTurn

  const handleSend = () => {
    send(queryText)
    setQueryText('')
  }

  const handleGenerate = (turnId: string) => {
    generate(turnId)
  }

  return (
    <AppShell activeScreen="playground" onNavigate={onNavigate}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Playground</h1>
          <p className="mt-2 text-on-surface-variant">
            Ask a question and see the most similar saved chunks, then generate an answer.
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
                  No saved embeddings for this document yet. Generate and save embeddings from the
                  Embeddings screen first.
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

            <div className="mt-4 flex min-h-0 flex-1 gap-6">
              <div
                data-testid="playground-conversation-panel"
                className="flex min-h-0 w-1/2 flex-col rounded-lg border border-outline-variant bg-surface-container p-4"
              >
                <ConversationPanel
                  turns={turns}
                  queryText={queryText}
                  onQueryChange={setQueryText}
                  onSend={handleSend}
                  isBusy={isBusy}
                  generatingTurnId={generatingTurnId}
                  onRetry={handleGenerate}
                  selectedTurnId={activeTurn?.id ?? null}
                  onSelectTurn={selectTurn}
                />
              </div>
              <div
                data-testid="playground-retrieval-panel"
                className="flex min-h-0 w-1/2 flex-col rounded-lg border border-outline-variant bg-surface-container p-4"
              >
                <RetrievalPanel
                  turn={activeTurn}
                  isBusy={isBusy}
                  isGenerating={generatingTurnId === activeTurn?.id}
                  onGenerate={() => activeTurn && handleGenerate(activeTurn.id)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
