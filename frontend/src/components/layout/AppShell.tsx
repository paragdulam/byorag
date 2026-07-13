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
    <div className="flex min-h-screen bg-background text-on-background">
      <SidebarNav activeScreen={activeScreen} onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col">
        <TopBar />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
