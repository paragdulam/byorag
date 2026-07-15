import type { CreateTurnRequest, ListTurnsResponse, PlaygroundContext, Turn } from '../types/playground'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const PLAYGROUND_CONTEXT_ENDPOINT = `${API_BASE_URL}/api/playground/context`
const PLAYGROUND_TURNS_ENDPOINT = `${API_BASE_URL}/api/playground/turns`

/** Distinguishes the "query too long" case (contracts/playground-api.md's 422) from other
 * turn-creation failures, so the UI can show a specific message instead of a generic one. */
export class QueryTooLongError extends Error {}

/**
 * Reads a document's currently active chunking strategy and embedding model
 * (contracts/playground-api.md) — server-driven, so the Playground's context display
 * (and the model a turn is created with) always reflects what was actually saved.
 */
export async function getPlaygroundContext(documentId: string): Promise<PlaygroundContext> {
  const url = `${PLAYGROUND_CONTEXT_ENDPOINT}?documentId=${encodeURIComponent(documentId)}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load playground context: ${response.status}`)
  }

  return (await response.json()) as PlaygroundContext
}

/**
 * Embeds `request.query` with `request.model`, retrieves and persists the ranked chunks for
 * `request.documentId` as a new conversation turn (contracts/playground-api.md). Throws
 * `QueryTooLongError` for the 422 case specifically; any other non-2xx status throws a
 * generic `Error` (FR-011/FR-014 rely on the empty-query guard happening before this is
 * ever called, so a 422 in practice always means "query too long").
 */
export async function createTurn(request: CreateTurnRequest): Promise<Turn> {
  const response = await fetch(PLAYGROUND_TURNS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (response.status === 422) {
    throw new QueryTooLongError("Query exceeds the embedding model's maximum input length")
  }
  if (!response.ok) {
    throw new Error(`Failed to create turn: ${response.status}`)
  }

  return (await response.json()) as Turn
}

/**
 * Sends `turnId`'s already-persisted question and retrieved chunks to the configured LLM
 * provider and returns the updated turn (contracts/playground-api.md). Calling this again on
 * a turn whose last attempt failed is the retry path (FR-014) — no new retrieval happens.
 */
export async function generateAnswer(turnId: string): Promise<Turn> {
  const response = await fetch(
    `${PLAYGROUND_TURNS_ENDPOINT}/${encodeURIComponent(turnId)}/generate`,
    { method: 'POST' },
  )

  if (!response.ok) {
    throw new Error(`Failed to generate an answer: ${response.status}`)
  }

  return (await response.json()) as Turn
}

/** A document's full persisted conversation, oldest first (FR-017's automatic reload). */
export async function listTurns(documentId: string): Promise<ListTurnsResponse> {
  const url = `${PLAYGROUND_TURNS_ENDPOINT}?documentId=${encodeURIComponent(documentId)}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load conversation: ${response.status}`)
  }

  return (await response.json()) as ListTurnsResponse
}
