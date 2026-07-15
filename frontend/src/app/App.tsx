import { useState } from 'react'
import { DataSourcesScreen } from '../components/sources/DataSourcesScreen'
import { FixedSizeChunkingScreen } from '../components/chunking/FixedSizeChunkingScreen'
import { EmbeddingsScreen } from '../components/embeddings/EmbeddingsScreen'
import { VectorViewScreen } from '../components/vector-view/VectorViewScreen'
import { PlaygroundScreen } from '../components/playground/PlaygroundScreen'
import { CorporaScreen } from '../components/corpora/CorporaScreen'
import type { ScreenId } from '../components/layout/SidebarNav'
import { CorpusProvider } from '../context/CorpusContext'

function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('sources')

  return (
    <CorpusProvider>
      {activeScreen === 'corpora' ? (
        <CorporaScreen onNavigate={setActiveScreen} />
      ) : activeScreen === 'fixed-size-chunking' ? (
        <FixedSizeChunkingScreen onNavigate={setActiveScreen} />
      ) : activeScreen === 'embeddings' ? (
        <EmbeddingsScreen onNavigate={setActiveScreen} />
      ) : activeScreen === 'vector-view' ? (
        <VectorViewScreen onNavigate={setActiveScreen} />
      ) : activeScreen === 'playground' ? (
        <PlaygroundScreen onNavigate={setActiveScreen} />
      ) : (
        <DataSourcesScreen onNavigate={setActiveScreen} />
      )}
    </CorpusProvider>
  )
}

export default App
