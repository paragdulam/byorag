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
      <div className="flex min-h-0 flex-1 flex-col">
        <TopBar onNavigateToProfile={() => onNavigate('profile')} />
        <main className="min-h-0 flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
