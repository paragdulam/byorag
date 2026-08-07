import { useEffect } from 'react'
import { useNavigationType } from 'react-router'
import { useCorpus } from '../context/CorpusContext'
import { useAppNavigate } from './AppRouter'
import type { AppRoute } from './types'
import { isCorpusScopedScreen } from './types'

/**
 * Bidirectional sync between the URL's `corpusId` and `CorpusContext`'s `activeCorpusId`
 * (032-deep-linking research.md §3).
 */
export function useCorpusRouteSync(route: AppRoute | null): void {
  const { corpora, activeCorpusId, isLoading, selectCorpus } = useCorpus()
  const { navigateToScreen } = useAppNavigate()
  const navigationType = useNavigationType()

  // URL -> CorpusContext: once corpora have loaded, if the URL names a corpus the signed-in
  // user owns and it differs from the active one, adopt it (deep link / reload / pasted URL).
  useEffect(() => {
    if (isLoading || route === null || route.corpusId === null) {
      return
    }
    if (route.corpusId === activeCorpusId) {
      return
    }
    const owned = corpora.some((corpus) => corpus.id === route.corpusId)
    if (owned) {
      selectCorpus(route.corpusId)
    }
  }, [route, corpora, isLoading, activeCorpusId, selectCorpus])

  // CorpusContext -> URL: only fills in a *missing* corpus segment (e.g. navigating to a
  // corpus-scoped screen with no corpus in the URL yet) with the last-used corpus. Never
  // overrides a corpus the URL already names — that's the effect above's job; overriding it
  // here would race a freshly opened deep link's corpusId against `activeCorpusId` still
  // catching up to it. Also never fires on a POP (Back/Forward) — those restore a history entry
  // exactly as it was, e.g. a "/sources" visited back when the account had no corpus yet;
  // silently rewriting it via replaceState mid-Back/Forward would corrupt the very history stack
  // the user is trying to navigate (confirmed via e2e: it broke Forward navigation).
  useEffect(() => {
    if (
      navigationType === 'POP' ||
      route === null ||
      route.corpusId !== null ||
      !isCorpusScopedScreen(route.screen) ||
      activeCorpusId === null
    ) {
      return
    }
    navigateToScreen(route.screen, activeCorpusId, { replace: true })
  }, [route, activeCorpusId, navigateToScreen, navigationType])
}
