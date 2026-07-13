import { useState } from 'react'
import { DataSourcesScreen } from '../components/sources/DataSourcesScreen'
import { FixedSizeChunkingScreen } from '../components/experiments/FixedSizeChunkingScreen'
import type { ScreenId } from '../components/layout/SidebarNav'

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('sources')

  if (activeScreen === 'fixed-size-chunking') {
    return <FixedSizeChunkingScreen onNavigate={setActiveScreen} />
  }

  return <DataSourcesScreen onNavigate={setActiveScreen} />
}

export default App
