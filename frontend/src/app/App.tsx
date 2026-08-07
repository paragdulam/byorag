import { useEffect, useState } from 'react'
import { BrowserRouter, useLocation, useNavigate } from 'react-router'
import { DataSourcesScreen } from '../components/sources/DataSourcesScreen'
import { FixedSizeChunkingScreen } from '../components/chunking/FixedSizeChunkingScreen'
import { EmbeddingsScreen } from '../components/embeddings/EmbeddingsScreen'
import { VectorViewScreen } from '../components/vector-view/VectorViewScreen'
import { PlaygroundScreen } from '../components/playground/PlaygroundScreen'
import { GoldenDatasetScreen } from '../components/golden-dataset/GoldenDatasetScreen'
import { CorporaScreen } from '../components/corpora/CorporaScreen'
import { MetricsScreen } from '../components/metrics/MetricsScreen'
import { ProfileScreen } from '../components/profile/ProfileScreen'
import { CorpusProvider, useCorpus } from '../context/CorpusContext'
import { AuthProvider, useAuth } from '../context/AuthContext'
import { LoginScreen } from '../components/auth/LoginScreen'
import { SignupScreen } from '../components/auth/SignupScreen'
import { NotFoundState } from '../components/router/NotFoundState'
import { useAppNavigate, useAppRoute } from '../router/AppRouter'
import { useCorpusRouteSync } from '../router/useCorpusRouteSync'
import { baseRoute } from '../router/types'
import { buildPath } from '../router/urlScheme'

const DEFAULT_SCREEN_PATH = buildPath(baseRoute('sources', null))

function AuthenticatedAppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  const route = useAppRoute()
  const {
    navigateToScreen,
    navigateToEntry,
    closeEntry,
    navigateToNewEntry,
    navigateToDocument,
    navigateToChunkingChunk,
    navigateToVectorChunk,
  } = useAppNavigate()
  const { corpora, isLoading: corporaLoading } = useCorpus()

  useCorpusRouteSync(route)

  // Root "/" -> default screen (matches today's default-landing behavior).
  useEffect(() => {
    if (location.pathname === '/') {
      navigate(DEFAULT_SCREEN_PATH, { replace: true })
    }
  }, [location.pathname, navigate])

  if (location.pathname === '/') {
    return null
  }

  if (route === null) {
    return (
      <NotFoundState
        message="We couldn't find that page."
        backHref={DEFAULT_SCREEN_PATH}
        backLabel="Back to Sources"
      />
    )
  }

  if (
    route.corpusId !== null &&
    !corporaLoading &&
    !corpora.some((corpus) => corpus.id === route.corpusId)
  ) {
    return (
      <NotFoundState
        message="That corpus doesn't exist, or you don't have access to it."
        backHref="/corpora"
        backLabel="Back to Corpora"
      />
    )
  }

  const activeScreen = route.screen
  const routeCorpusId = route.corpusId

  return activeScreen === 'corpora' ? (
    <CorporaScreen onNavigate={navigateToScreen} />
  ) : activeScreen === 'fixed-size-chunking' ? (
    <FixedSizeChunkingScreen
      onNavigate={navigateToScreen}
      linkedDocumentId={route.documentId}
      linkedChunkIndex={route.chunkIndex}
      onSelectionChanged={
        routeCorpusId !== null
          ? (documentId, chunkIndex) => navigateToChunkingChunk(routeCorpusId, documentId, chunkIndex)
          : undefined
      }
    />
  ) : activeScreen === 'embeddings' ? (
    <EmbeddingsScreen onNavigate={navigateToScreen} />
  ) : activeScreen === 'vector-view' ? (
    <VectorViewScreen
      onNavigate={navigateToScreen}
      linkedChunkId={route.chunkId}
      onChunkLinked={
        routeCorpusId !== null ? (chunkId) => navigateToVectorChunk(routeCorpusId, chunkId) : undefined
      }
    />
  ) : activeScreen === 'golden-dataset' ? (
    <GoldenDatasetScreen
      onNavigate={navigateToScreen}
      linkedEntryId={route.entryId}
      onCloseLinkedEntry={routeCorpusId !== null ? () => closeEntry(routeCorpusId) : undefined}
      onEntryOpened={
        routeCorpusId !== null ? (entryId) => navigateToEntry(routeCorpusId, entryId) : undefined
      }
      isCreatingEntry={route.isCreatingEntry}
      onCreatingEntryChanged={
        routeCorpusId !== null
          ? (isCreating) =>
              isCreating ? navigateToNewEntry(routeCorpusId) : closeEntry(routeCorpusId)
          : undefined
      }
    />
  ) : activeScreen === 'playground' ? (
    <PlaygroundScreen onNavigate={navigateToScreen} linkedTurnId={route.turnId} />
  ) : activeScreen === 'metrics' ? (
    <MetricsScreen onNavigate={navigateToScreen} />
  ) : activeScreen === 'profile' ? (
    <ProfileScreen onNavigate={navigateToScreen} />
  ) : (
    <DataSourcesScreen
      onNavigate={navigateToScreen}
      linkedDocumentId={route.documentId}
      onDocumentSelected={
        routeCorpusId !== null ? (documentId) => navigateToDocument(routeCorpusId, documentId) : undefined
      }
    />
  )
}

function AuthenticatedApp() {
  return (
    <CorpusProvider>
      <AuthenticatedAppRoutes />
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
    <BrowserRouter>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
