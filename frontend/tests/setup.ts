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
