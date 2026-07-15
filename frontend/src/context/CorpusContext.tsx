import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as corporaApi from '../lib/corporaApi'
import type { Corpus } from '../types/corpus'

const ACTIVE_CORPUS_STORAGE_KEY = 'byorag:activeCorpusId'

export interface CorpusContextValue {
  corpora: Corpus[]
  activeCorpusId: string | null
  isLoading: boolean
  error: string | null
  selectCorpus: (id: string) => void
  createCorpus: (name: string) => Promise<Corpus>
  renameCorpus: (id: string, name: string) => Promise<void>
  deleteCorpus: (id: string) => Promise<void>
}

const CorpusContext = createContext<CorpusContextValue | undefined>(undefined)

function persistActiveCorpusId(id: string | null): void {
  if (id) {
    window.localStorage.setItem(ACTIVE_CORPUS_STORAGE_KEY, id)
  } else {
    window.localStorage.removeItem(ACTIVE_CORPUS_STORAGE_KEY)
  }
}

export function CorpusProvider({ children }: { children: ReactNode }) {
  const [corpora, setCorpora] = useState<Corpus[]>([])
  const [activeCorpusId, setActiveCorpusId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    corporaApi
      .listCorpora()
      .then((list) => {
        if (cancelled) return
        setCorpora(list)
        const stored = window.localStorage.getItem(ACTIVE_CORPUS_STORAGE_KEY)
        const initial = list.find((corpus) => corpus.id === stored) ?? list[0] ?? null
        setActiveCorpusId(initial ? initial.id : null)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load corpora')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectCorpus = useCallback((id: string) => {
    setActiveCorpusId(id)
    persistActiveCorpusId(id)
  }, [])

  const createCorpus = useCallback(
    async (name: string) => {
      const corpus = await corporaApi.createCorpus(name)
      setCorpora((prev) => [...prev, corpus])
      selectCorpus(corpus.id)
      return corpus
    },
    [selectCorpus],
  )

  const renameCorpus = useCallback(async (id: string, name: string) => {
    const updated = await corporaApi.renameCorpus(id, name)
    setCorpora((prev) => prev.map((corpus) => (corpus.id === id ? updated : corpus)))
  }, [])

  const deleteCorpus = useCallback(
    async (id: string) => {
      await corporaApi.deleteCorpus(id)
      setCorpora((prev) => {
        const next = prev.filter((corpus) => corpus.id !== id)
        if (activeCorpusId === id) {
          const fallback = next[0] ?? null
          setActiveCorpusId(fallback ? fallback.id : null)
          persistActiveCorpusId(fallback ? fallback.id : null)
        }
        return next
      })
    },
    [activeCorpusId],
  )

  const value = useMemo<CorpusContextValue>(
    () => ({
      corpora,
      activeCorpusId,
      isLoading,
      error,
      selectCorpus,
      createCorpus,
      renameCorpus,
      deleteCorpus,
    }),
    [corpora, activeCorpusId, isLoading, error, selectCorpus, createCorpus, renameCorpus, deleteCorpus],
  )

  return <CorpusContext.Provider value={value}>{children}</CorpusContext.Provider>
}

export function useCorpus(): CorpusContextValue {
  const context = useContext(CorpusContext)
  if (!context) {
    throw new Error('useCorpus must be used within a CorpusProvider')
  }
  return context
}
