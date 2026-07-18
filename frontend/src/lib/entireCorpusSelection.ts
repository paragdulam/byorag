// Sentinel document-selector value meaning "every document in the active corpus," shared by
// the Chunking, Embeddings, and Vector View screens (018-ui-polish-batch research.md §1). Never
// a valid Document.id (server-generated UUIDs), so no schema/API change is needed to distinguish
// "a document" from "the whole corpus" — the distinction lives entirely in frontend selection
// state.
export const ENTIRE_CORPUS_SELECTION = '__entire-corpus__'

export type DocumentSelectionValue = string

export function isEntireCorpusSelection(value: string): boolean {
  return value === ENTIRE_CORPUS_SELECTION
}
