// A tiny external store (outside React's component tree) so a running batch generation's
// progress survives the owning screen unmounting and remounting (research.md §4's edge case —
// spec User Story 3 acceptance scenario 3: "navigate away and return, still see progress").
// Read via useSyncExternalStore in BatchGenerationProgress.tsx.

import { generateEntry } from './goldenDatasetApi'
import {
  runSequentialBatch,
  type BatchItemResult,
  type BatchProgress,
} from './batchRunner'
import type { GoldenEntry } from '../types/goldenDataset'

export interface BatchGenerationState {
  isRunning: boolean
  progress: BatchProgress | null
  results: BatchItemResult<GoldenEntry>[] | null
}

let state: BatchGenerationState = { isRunning: false, progress: null, results: null }
const listeners = new Set<() => void>()

function setState(next: Partial<BatchGenerationState>): void {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): BatchGenerationState {
  return state
}

/** Starts a batch if one isn't already running — a remount with the same props during an
 * in-flight batch is a no-op here, it just re-subscribes to what's already running. */
export function startBatchGeneration(corpusId: string, documentId: string | null, count: number): void {
  if (state.isRunning) {
    return
  }
  setState({ isRunning: true, progress: null, results: null })

  const items = Array.from({ length: count }, (_, index) => ({
    id: `generate-request-${index}`,
    name: `Entry ${index + 1}`,
  }))

  runSequentialBatch(
    items,
    () => generateEntry(corpusId, documentId),
    (progress) => setState({ progress }),
  ).then((results) => {
    setState({ isRunning: false, results })
  })
}

/** Test-only reset — a fresh module-level singleton otherwise leaks state across test cases. */
export function resetBatchGenerationStore(): void {
  state = { isRunning: false, progress: null, results: null }
  listeners.clear()
}
