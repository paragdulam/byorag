/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Lets sourcesApi.ts use relative URLs in local dev without setting
      // VITE_API_BASE_URL; the backend is expected on :8000 (see
      // specs/002-persist-pdf-sources/quickstart.md). E2E_API_PROXY_TARGET lets
      // playwright.config.ts point this at its own isolated backend instance
      // instead, so an e2e run never proxies into a developer's real dev server
      // (post-020-metrics-stage-groups incident — e2e reused a live server bound
      // to the real database and destructive tests corrupted real data).
      '/api': process.env.E2E_API_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
  },
})
