import { useState } from 'react'
import { DataSourcesScreen } from '../components/sources/DataSourcesScreen'
import { FixedSizeChunkingScreen } from '../components/chunking/FixedSizeChunkingScreen'
import { EmbeddingsScreen } from '../components/embeddings/EmbeddingsScreen'
import { VectorViewScreen } from '../components/vector-view/VectorViewScreen'
import { PlaygroundScreen } from '../components/playground/PlaygroundScreen'
import { CorporaScreen } from '../components/corpora/CorporaScreen'
import { MetricsScreen } from '../components/metrics/MetricsScreen'
import { ProfileScreen } from '../components/profile/ProfileScreen'
import type { ScreenId } from '../components/layout/SidebarNav'
import { CorpusProvider } from '../context/CorpusContext'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { LoginScreen } from '../components/auth/LoginScreen'
import { SignupScreen } from '../components/auth/SignupScreen'

function AuthenticatedApp() {
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
      ) : activeScreen === 'metrics' ? (
        <MetricsScreen onNavigate={setActiveScreen} />
      ) : activeScreen === 'profile' ? (
        <ProfileScreen onNavigate={setActiveScreen} />
      ) : (
        <DataSourcesScreen onNavigate={setActiveScreen} />
      )}
    </CorpusProvider>
  )
}

function AuthGate() {
  const { currentUser, isLoading } = useAuth()
  const [showSignup, setShowSignup] = useState(false)

  if (isLoading) {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-surface">
        <p className="text-on-surface-variant">Loading…</p>
      </div>
    )
  }

  if (currentUser === null) {
    return showSignup ? (
      <SignupScreen onSwitchToLogin={() => setShowSignup(false)} />
    ) : (
      <LoginScreen onSwitchToSignup={() => setShowSignup(true)} />
    )
  }

  return <AuthenticatedApp />
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}

export default App
