import type { ScreenId } from '../components/layout/SidebarNav'

/**
 * The addressable combination of screen, active corpus, and (screen-dependent) a specific
 * entity within it that a URL represents (032-deep-linking data-model.md "Route", extended for
 * per-screen entity deep links). Every field beyond `screen`/`corpusId` is meaningful only for
 * the screen(s) noted — always `null`/`false` elsewhere:
 * - `documentId`: Sources (selected document); Fixed Size Chunking (selected document, paired
 *   with `chunkIndex`)
 * - `chunkIndex`: Fixed Size Chunking only (positional index within `documentId`'s current
 *   chunk run — chunks there have no stable id, see research note in urlScheme.ts)
 * - `chunkId`: Vector View only (a saved chunk's stable id)
 * - `entryId`: Golden Dataset (an existing entry)
 * - `isCreatingEntry`: Golden Dataset (the "Write Manually" creation form is open)
 * - `turnId`: Playground (a specific conversation turn)
 */
export interface AppRoute {
  screen: ScreenId
  corpusId: string | null
  documentId: string | null
  chunkIndex: number | null
  chunkId: string | null
  entryId: string | null
  isCreatingEntry: boolean
  turnId: string | null
}

/** Screens with no corpus context — never take a `:corpusId` URL segment. */
export const SCREEN_ONLY_SCREENS: ReadonlySet<ScreenId> = new Set(['corpora', 'profile'])

/** Every other screen is corpus-scoped and takes a `:corpusId` URL segment. */
export const CORPUS_SCOPED_SCREENS: ReadonlySet<ScreenId> = new Set([
  'sources',
  'fixed-size-chunking',
  'embeddings',
  'vector-view',
  'golden-dataset',
  'playground',
  'metrics',
])

export function isCorpusScopedScreen(screen: ScreenId): boolean {
  return CORPUS_SCOPED_SCREENS.has(screen)
}

/** An `AppRoute` with every entity field at its default (no entity selected). */
export function baseRoute(screen: ScreenId, corpusId: string | null): AppRoute {
  return {
    screen,
    corpusId,
    documentId: null,
    chunkIndex: null,
    chunkId: null,
    entryId: null,
    isCreatingEntry: false,
    turnId: null,
  }
}
