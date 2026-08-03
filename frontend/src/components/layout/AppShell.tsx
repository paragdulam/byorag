import type { ReactNode } from 'react'
import { SidebarNav } from './SidebarNav'
import type { ScreenId } from './SidebarNav'
import { TopBar } from './TopBar'

export interface AppShellProps {
  activeScreen: ScreenId
  onNavigate: (screen: ScreenId) => void
  children: ReactNode
}

export function AppShell({ activeScreen, onNavigate, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-background">
      <SidebarNav activeScreen={activeScreen} onNavigate={onNavigate} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar onNavigateToProfile={() => onNavigate('profile')} />
        {/* min-w-0: without it, this flex item refuses to shrink below its content's intrinsic
            width (default min-width: auto) — wide zoomed content (PDF preview panes) would grow
            this element, and everything inside it, past the viewport instead of scrolling
            (028-golden-dataset-split-view research.md §1 / SC-002). */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
