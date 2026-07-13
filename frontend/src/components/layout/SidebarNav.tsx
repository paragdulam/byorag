import { useState } from 'react'

export type ScreenId = 'sources' | 'fixed-size-chunking' | 'embeddings'

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
  { label: 'Sources', screen: 'sources' },
  {
    label: 'Chunking',
    subItems: [
      { label: 'Fixed Size Chunking', screen: 'fixed-size-chunking' },
    ],
  },
  { label: 'Embeddings', screen: 'embeddings' },
  { label: 'Playground' },
  { label: 'Vector View' },
  { label: 'Logs' },
]

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

      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.screen === activeScreen
          const isExpanded = expandedLabel === item.label

          return (
            <li key={item.label}>
              <a
                href="#"
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  if (item.subItems) {
                    setExpandedLabel((prev) => (prev === item.label ? null : item.label))
                  } else if (item.screen) {
                    onNavigate(item.screen)
                  }
                }}
                className={
                  'block rounded px-3 py-2 font-mono text-xs font-medium tracking-widest ' +
                  (isActive
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container')
                }
              >
                {item.label.toUpperCase()}
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
                          className={
                            'block rounded px-3 py-2 font-mono text-xs font-medium tracking-widest ' +
                            (isSubActive
                              ? 'bg-primary-container text-on-primary-container'
                              : 'text-on-surface-variant hover:bg-surface-container')
                          }
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
