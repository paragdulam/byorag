import { useState } from 'react'
import { DataSourcesScreen } from '../components/sources/DataSourcesScreen'
import { FixedSizeChunkingScreen } from '../components/chunking/FixedSizeChunkingScreen'
import { EmbeddingsScreen } from '../components/chunking/EmbeddingsScreen'
import type { ScreenId } from '../components/layout/SidebarNav'

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('sources')

  if (activeScreen === 'fixed-size-chunking') {
    return <FixedSizeChunkingScreen onNavigate={setActiveScreen} />
  }

  if (activeScreen === 'embeddings') {
    return <EmbeddingsScreen onNavigate={setActiveScreen} />
  }

  return <DataSourcesScreen onNavigate={setActiveScreen} />
}

export default App
