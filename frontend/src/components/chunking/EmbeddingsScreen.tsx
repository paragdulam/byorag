import { AppShell } from '../layout/AppShell'
import type { ScreenId } from '../layout/SidebarNav'

export interface EmbeddingsScreenProps {
  onNavigate: (screen: ScreenId) => void
}

export function EmbeddingsScreen({ onNavigate }: EmbeddingsScreenProps) {
  return (
    <AppShell activeScreen="embeddings" onNavigate={onNavigate}>
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-on-surface">Embeddings</h1>
        <p className="mt-2 text-on-surface-variant">
          Embeddings configuration is coming soon.
        </p>
      </div>
    </AppShell>
  )
}
