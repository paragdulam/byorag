import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'

// Default fetch mock: routes by URL so every hook that fetches on mount
// (useSourceDocuments, useSystemCapacity) gets a sane empty/ready response
// without a real network call, unless a test overrides global.fetch itself.
// See specs/002-persist-pdf-sources/quickstart.md and
// specs/003-system-capacity-widget/quickstart.md.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()

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
