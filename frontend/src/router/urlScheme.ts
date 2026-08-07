import type { ScreenId } from '../components/layout/SidebarNav'
import type { AppRoute } from './types'
import { CORPUS_SCOPED_SCREENS, SCREEN_ONLY_SCREENS, baseRoute, isCorpusScopedScreen } from './types'

const ALL_SCREENS: ReadonlySet<ScreenId> = new Set([
  ...SCREEN_ONLY_SCREENS,
  ...CORPUS_SCOPED_SCREENS,
])

function isScreenId(value: string): value is ScreenId {
  return ALL_SCREENS.has(value as ScreenId)
}

/**
 * Parses a URL pathname into an `AppRoute`, per contracts/url-scheme.md. Returns `null` for `/`
 * (caller redirects to the default screen) and for any path that doesn't match a known route
 * shape — both cases are treated identically as "not found" by callers (032-deep-linking
 * data-model.md).
 *
 * Trailing segments beyond `:corpusId` are screen-specific (see `AppRoute`'s doc comment).
 * `fixed-size-chunking` is the one screen with two trailing segments (`:documentId/:chunkIndex`)
 * because a chunk there has no stable id of its own — it's only ever addressable as "the Nth
 * chunk of this document's current chunk run" (its `Chunk` type, unlike Vector View's persisted
 * `SavedChunk`, carries no `id` field at all).
 */
export function parseRoute(pathname: string): AppRoute | null {
  const segments = pathname.split('/').filter((segment) => segment.length > 0)

  if (segments.length === 0) {
    return null
  }

  const [screenSegment, corpusId, third, fourth, ...rest] = segments

  if (!isScreenId(screenSegment)) {
    return null
  }

  if (SCREEN_ONLY_SCREENS.has(screenSegment)) {
    return corpusId === undefined ? baseRoute(screenSegment, null) : null
  }

  if (corpusId === undefined) {
    // No corpus selected yet (e.g. a brand-new account with no corpora) — the screen renders
    // its own existing "select or create a corpus" empty state, not a not-found state (FR-011).
    return baseRoute(screenSegment, null)
  }

  const base = baseRoute(screenSegment, corpusId)

  switch (screenSegment) {
    case 'sources': {
      if (rest.length > 0 || fourth !== undefined) return null
      return third === undefined ? base : { ...base, documentId: third }
    }
    case 'fixed-size-chunking': {
      if (rest.length > 0) return null
      if (third === undefined) return base
      if (fourth === undefined) return { ...base, documentId: third }
      const chunkIndex = Number(fourth)
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || String(chunkIndex) !== fourth) {
        return null
      }
      return { ...base, documentId: third, chunkIndex }
    }
    case 'vector-view': {
      if (rest.length > 0 || fourth !== undefined) return null
      return third === undefined ? base : { ...base, chunkId: third }
    }
    case 'golden-dataset': {
      if (rest.length > 0 || fourth !== undefined) return null
      if (third === undefined) return base
      return third === 'new' ? { ...base, isCreatingEntry: true } : { ...base, entryId: third }
    }
    case 'playground': {
      if (rest.length > 0 || fourth !== undefined) return null
      return third === undefined ? base : { ...base, turnId: third }
    }
    case 'embeddings':
    case 'metrics': {
      if (third !== undefined || rest.length > 0) return null
      return base
    }
    default:
      return null
  }
}

/** Serializes an `AppRoute` into a URL pathname, per contracts/url-scheme.md. */
export function buildPath(route: AppRoute): string {
  if (!isCorpusScopedScreen(route.screen)) {
    return `/${route.screen}`
  }

  if (route.corpusId === null) {
    return `/${route.screen}`
  }

  const prefix = `/${route.screen}/${route.corpusId}`

  switch (route.screen) {
    case 'sources':
      return route.documentId !== null ? `${prefix}/${route.documentId}` : prefix
    case 'fixed-size-chunking':
      if (route.documentId !== null && route.chunkIndex !== null) {
        return `${prefix}/${route.documentId}/${route.chunkIndex}`
      }
      return route.documentId !== null ? `${prefix}/${route.documentId}` : prefix
    case 'vector-view':
      return route.chunkId !== null ? `${prefix}/${route.chunkId}` : prefix
    case 'golden-dataset':
      if (route.isCreatingEntry) return `${prefix}/new`
      return route.entryId !== null ? `${prefix}/${route.entryId}` : prefix
    case 'playground':
      return route.turnId !== null ? `${prefix}/${route.turnId}` : prefix
    default:
      return prefix
  }
}

/** Builds the shareable path for a specific Golden Dataset entry (FR-006). */
export function buildEntryLink(corpusId: string, entryId: string): string {
  return buildPath({ ...baseRoute('golden-dataset', corpusId), entryId })
}

/** Builds the path for the Golden Dataset "Write Manually" creation form. */
export function buildNewEntryLink(corpusId: string): string {
  return buildPath({ ...baseRoute('golden-dataset', corpusId), isCreatingEntry: true })
}

/** Builds the shareable path for a specific Sources document. */
export function buildDocumentLink(corpusId: string, documentId: string): string {
  return buildPath({ ...baseRoute('sources', corpusId), documentId })
}

/** Builds the shareable path for a specific Fixed Size Chunking chunk (within its document). */
export function buildChunkingChunkLink(corpusId: string, documentId: string, chunkIndex: number): string {
  return buildPath({ ...baseRoute('fixed-size-chunking', corpusId), documentId, chunkIndex })
}

/** Builds the shareable path for a specific Vector View saved chunk. */
export function buildVectorChunkLink(corpusId: string, chunkId: string): string {
  return buildPath({ ...baseRoute('vector-view', corpusId), chunkId })
}

/** Builds the shareable path for a specific Playground turn. */
export function buildTurnLink(corpusId: string, turnId: string): string {
  return buildPath({ ...baseRoute('playground', corpusId), turnId })
}
