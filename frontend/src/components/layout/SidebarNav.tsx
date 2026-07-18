import { useEffect, useRef, useState } from 'react'
import { useCorpus } from '../../context/CorpusContext'

export type ScreenId =
  | 'corpora'
  | 'sources'
  | 'fixed-size-chunking'
  | 'embeddings'
  | 'vector-view'
  | 'playground'
  | 'metrics'

interface SubNavItem {
  label: string
  screen: ScreenId
}

interface NavItem {
  label: string
  screen?: ScreenId
  subItems?: SubNavItem[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Corpora', screen: 'corpora' },
  { label: 'Sources', screen: 'sources' },
  {
    label: 'Chunking',
    subItems: [
      { label: 'Fixed Size Chunking', screen: 'fixed-size-chunking' },
    ],
  },
  { label: 'Embeddings', screen: 'embeddings' },
  { label: 'Vector View', screen: 'vector-view' },
  { label: 'Playground', screen: 'playground' },
  { label: 'Metrics', screen: 'metrics' },
]

const navLinkClassName = (isActive: boolean) =>
  'block rounded px-3 py-2 font-mono text-xs font-medium tracking-widest ' +
  (isActive
    ? 'bg-primary-container text-on-primary-container'
    : 'text-on-surface-variant hover:bg-surface-container')

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      data-testid="chevron-icon"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        'h-3 w-3 shrink-0 transition-transform duration-150 ' + (expanded ? 'rotate-90' : 'rotate-0')
      }
      aria-hidden="true"
    >
      <path d="M7 4l6 6-6 6" />
    </svg>
  )
}

function CorporaSection() {
  const { corpora, activeCorpusId, isLoading, selectCorpus } = useCorpus()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const activeCorpus = corpora.find((corpus) => corpus.id === activeCorpusId)
  const toggleLabel = activeCorpus ? activeCorpus.name : 'No corpus selected'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="active-corpus-dropdown-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 font-mono text-xs font-medium tracking-widest text-on-surface hover:bg-surface-container"
      >
        <span className="truncate uppercase">{toggleLabel}</span>
        <ChevronIcon expanded={isOpen} />
      </button>

      {isOpen && (
        <div
          data-testid="active-corpus-dropdown-panel"
          className="mt-1 flex flex-col gap-1 rounded border border-outline-variant bg-surface p-1"
        >
          {!isLoading && corpora.length === 0 && (
            <div className="px-3 py-2 text-xs text-on-surface-variant">No corpora yet.</div>
          )}
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {corpora.map((corpus) => {
              const isActive = corpus.id === activeCorpusId
              return (
                <li key={corpus.id}>
                  <button
                    type="button"
                    data-testid={`dropdown-corpus-row-${corpus.id}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => selectCorpus(corpus.id)}
                    className={navLinkClassName(isActive) + ' block w-full truncate text-left uppercase'}
                  >
                    {corpus.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export interface SidebarNavProps {
  activeScreen: ScreenId
  onNavigate: (screen: ScreenId) => void
}

export function SidebarNav({ activeScreen, onNavigate }: SidebarNavProps) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null)

  return (
    <nav
      aria-label="Primary"
      className="flex w-60 shrink-0 flex-col gap-6 border-r border-outline-variant bg-surface p-6"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-primary-container" aria-hidden="true" />
        <div>
          <div className="font-mono text-xs font-medium tracking-widest text-on-surface">
            BYORAG
          </div>
          <div className="text-sm text-on-surface-variant">Project Alpha</div>
        </div>
      </div>

      <CorporaSection />

      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.screen === activeScreen
          const isExpanded = expandedLabel === item.label

          return (
            <li key={item.label}>
              <a
                href="#"
                aria-current={isActive ? 'page' : undefined}
                aria-expanded={item.subItems ? isExpanded : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  if (item.subItems) {
                    setExpandedLabel((prev) => (prev === item.label ? null : item.label))
                  } else if (item.screen) {
                    onNavigate(item.screen)
                  }
                }}
                className={
                  item.subItems
                    ? navLinkClassName(isActive) + ' flex items-center justify-between gap-2'
                    : navLinkClassName(isActive)
                }
              >
                {item.subItems ? (
                  <>
                    <span>{item.label.toUpperCase()}</span>
                    <ChevronIcon expanded={isExpanded} />
                  </>
                ) : (
                  item.label.toUpperCase()
                )}
              </a>

              {item.subItems && isExpanded && (
                <ul className="mt-1 flex flex-col gap-1 pl-4">
                  {item.subItems.map((subItem) => {
                    const isSubActive = subItem.screen === activeScreen
                    return (
                      <li key={subItem.label}>
                        <a
                          href="#"
                          aria-current={isSubActive ? 'page' : undefined}
                          onClick={(event) => {
                            event.preventDefault()
                            onNavigate(subItem.screen)
                          }}
                          className={navLinkClassName(isSubActive)}
                        >
                          {subItem.label.toUpperCase()}
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
