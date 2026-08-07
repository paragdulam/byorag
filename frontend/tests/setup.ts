import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// jsdom has no Canvas/DOMMatrix support at all; `pdfjs-dist` (via `react-pdf`) references
// `DOMMatrix` at import time, which would otherwise throw for every test file that transitively
// renders SourceDocumentPreview without itself mocking `react-pdf`
// (021-sources-chunking-embeddings-refresh). A minimal stand-in is enough — no test in this
// suite exercises pdfjs's real canvas rendering path.
if (typeof globalThis.DOMMatrix === 'undefined') {
  class MockDOMMatrix {
    constructor(..._args: unknown[]) {}
  }
  // @ts-expect-error - test-only polyfill, not a full DOMMatrix implementation
  globalThis.DOMMatrix = MockDOMMatrix
}

// jsdom has no IntersectionObserver at all; SourceDocumentPreview uses one to track which
// page is predominantly visible for its page indicator (029-pdf-preview-page-count). A no-op
// stand-in is enough here — tests that need to drive visibility changes stub
// globalThis.IntersectionObserver themselves with a capturing mock before rendering.
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class MockIntersectionObserver {
    constructor(..._args: unknown[]) {}
    observe(..._args: unknown[]) {}
    unobserve(..._args: unknown[]) {}
    disconnect(..._args: unknown[]) {}
  }
  // @ts-expect-error - test-only polyfill, not a full IntersectionObserver implementation
  globalThis.IntersectionObserver = MockIntersectionObserver
}

// jsdom's `window.location`/`history` persists across tests within the same file (a fresh jsdom
// environment is only created per test *file*, not per test) — since 032-deep-linking made the
// URL a real, meaningful piece of app state (App.tsx's router reads it on mount), a path left
// over from a previous test would otherwise silently bleed into the next one, e.g. auto-selecting
// whatever corpus was in a stale URL before a test's own setup runs.
beforeEach(() => {
  window.history.pushState({}, '', '/')
})

// Default fetch mock: routes by URL so every hook that fetches on mount
// (useSourceDocuments, useSystemCapacity, CorpusContext) gets a sane
// empty/ready response without a real network call, unless a test overrides
// global.fetch itself. A single default corpus is returned so components
// nested under SidebarNav (which requires a CorpusProvider ancestor) render
// with a non-null active corpus by default. See
// specs/002-persist-pdf-sources/quickstart.md,
// specs/003-system-capacity-widget/quickstart.md, and
// specs/008-corpora-management/quickstart.md.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (url.includes('/api/auth/me')) {
        return new Response(
          JSON.stringify({
            id: 'default-user',
            email: 'test@example.com',
            createdAt: '2026-07-14T00:00:00Z',
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/corpora')) {
        return new Response(
          JSON.stringify({
            corpora: [
              { id: 'default-corpus', name: 'Uncategorized', createdAt: '2026-07-14T00:00:00Z' },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/profile/anthropic-key')) {
        // Defaults to "has a key" so pre-existing tests that reach Playground/Metrics
        // through the real nav (not mocking AuthContext) aren't blocked by
        // 025-user-profile-anthropic-key's gating; tests exercising the gating itself
        // override this route explicitly.
        return new Response(JSON.stringify({ hasKey: true, maskedKey: '...test' }), { status: 200 })
      }

      if (url.includes('/api/embeddings/models')) {
        return new Response(
          JSON.stringify({ models: [{ id: 'bert', label: 'BERT (bert-base-uncased)' }] }),
          { status: 200 },
        )
      }

      if (url.includes('/api/chunking/saved-chunks')) {
        return new Response(JSON.stringify({ chunks: [] }), { status: 200 })
      }

      if (url.includes('/api/embeddings/projection-methods')) {
        return new Response(
          JSON.stringify({
            methods: [
              { id: 'vector', label: 'Vector', available: true },
              { id: 'umap', label: 'UMAP', available: false },
              { id: 'pca', label: 'PCA', available: false },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.includes('/api/embeddings/saved')) {
        return new Response(JSON.stringify({ embeddings: [] }), { status: 200 })
      }

      if (url.includes('/api/system/capacity')) {
        return new Response(
          JSON.stringify({
            hardware: {
              processorName: 'Test Processor',
              cpuCores: 8,
              totalMemoryGb: 16.0,
              gpuDetected: false,
              gpuName: null,
              detectionFailed: false,
            },
            estimate: {
              maxPdfCount: 100,
              maxTotalSizeGb: 2.0,
              basis: 'cpu-only',
            },
          }),
          { status: 200 },
        )
      }

      return new Response(JSON.stringify({ documents: [], rejections: [] }), { status: 200 })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})
