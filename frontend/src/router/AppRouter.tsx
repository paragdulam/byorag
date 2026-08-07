import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { ScreenId } from '../components/layout/SidebarNav'
import type { AppRoute } from './types'
import { baseRoute } from './types'
import { buildPath, parseRoute } from './urlScheme'

/** The current `AppRoute` parsed from the browser URL (032-deep-linking). */
export function useAppRoute(): AppRoute | null {
  const location = useLocation()
  return useMemo(() => parseRoute(location.pathname), [location.pathname])
}

export interface NavigateOptions {
  /** Replace the current history entry instead of pushing a new one — for URL
   * auto-completion (e.g. filling in a missing corpus segment) rather than a user-initiated
   * navigation, so Back/Forward aren't cluttered with an extra, invisible-to-the-user step. */
  replace?: boolean
}

export interface AppNavigate {
  navigateToScreen: (screen: ScreenId, corpusId?: string | null, options?: NavigateOptions) => void
  navigateToEntry: (corpusId: string, entryId: string, options?: NavigateOptions) => void
  closeEntry: (corpusId: string, options?: NavigateOptions) => void
  navigateToNewEntry: (corpusId: string, options?: NavigateOptions) => void
  navigateToDocument: (corpusId: string, documentId: string, options?: NavigateOptions) => void
  navigateToChunkingChunk: (
    corpusId: string,
    documentId: string,
    chunkIndex: number,
    options?: NavigateOptions,
  ) => void
  navigateToVectorChunk: (corpusId: string, chunkId: string, options?: NavigateOptions) => void
  navigateToTurn: (corpusId: string, turnId: string, options?: NavigateOptions) => void
}

/**
 * Navigation helpers that update the URL (and therefore `useAppRoute()`) via react-router. Every
 * entity-selection helper here (document, chunk, entry, turn) defaults to `replace: true` — these
 * reflect the user's *current viewing state* within a screen, not a distinct page, so clicking
 * through several of them shouldn't clutter Back/Forward with one history entry per click. Pass
 * `{ replace: false }` explicitly if a call site ever needs push behavior instead.
 */
export function useAppNavigate(): AppNavigate {
  const navigate = useNavigate()

  const navigateToScreen = useCallback(
    (screen: ScreenId, corpusId: string | null = null, options?: NavigateOptions) => {
      navigate(buildPath(baseRoute(screen, corpusId)), { replace: options?.replace })
    },
    [navigate],
  )

  const navigateToEntry = useCallback(
    (corpusId: string, entryId: string, options?: NavigateOptions) => {
      navigate(buildPath({ ...baseRoute('golden-dataset', corpusId), entryId }), {
        replace: options?.replace ?? true,
      })
    },
    [navigate],
  )

  const closeEntry = useCallback(
    (corpusId: string, options?: NavigateOptions) => {
      navigate(buildPath(baseRoute('golden-dataset', corpusId)), { replace: options?.replace ?? true })
    },
    [navigate],
  )

  const navigateToNewEntry = useCallback(
    (corpusId: string, options?: NavigateOptions) => {
      navigate(buildPath({ ...baseRoute('golden-dataset', corpusId), isCreatingEntry: true }), {
        replace: options?.replace,
      })
    },
    [navigate],
  )

  const navigateToDocument = useCallback(
    (corpusId: string, documentId: string, options?: NavigateOptions) => {
      navigate(buildPath({ ...baseRoute('sources', corpusId), documentId }), {
        replace: options?.replace ?? true,
      })
    },
    [navigate],
  )

  const navigateToChunkingChunk = useCallback(
    (corpusId: string, documentId: string, chunkIndex: number, options?: NavigateOptions) => {
      navigate(
        buildPath({ ...baseRoute('fixed-size-chunking', corpusId), documentId, chunkIndex }),
        { replace: options?.replace ?? true },
      )
    },
    [navigate],
  )

  const navigateToVectorChunk = useCallback(
    (corpusId: string, chunkId: string, options?: NavigateOptions) => {
      navigate(buildPath({ ...baseRoute('vector-view', corpusId), chunkId }), {
        replace: options?.replace ?? true,
      })
    },
    [navigate],
  )

  const navigateToTurn = useCallback(
    (corpusId: string, turnId: string, options?: NavigateOptions) => {
      navigate(buildPath({ ...baseRoute('playground', corpusId), turnId }), {
        replace: options?.replace ?? true,
      })
    },
    [navigate],
  )

  return useMemo(
    () => ({
      navigateToScreen,
      navigateToEntry,
      closeEntry,
      navigateToNewEntry,
      navigateToDocument,
      navigateToChunkingChunk,
      navigateToVectorChunk,
      navigateToTurn,
    }),
    [
      navigateToScreen,
      navigateToEntry,
      closeEntry,
      navigateToNewEntry,
      navigateToDocument,
      navigateToChunkingChunk,
      navigateToVectorChunk,
      navigateToTurn,
    ],
  )
}
