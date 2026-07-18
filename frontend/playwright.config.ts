import { defineConfig, devices } from '@playwright/test'

// Deliberately distinct from the normal dev ports (backend :8000, frontend :5173) so an e2e run
// can never silently attach to a developer's real running dev server via `reuseExistingServer`
// — it can only ever reuse a previous *e2e* server instance, which is always bound to the
// isolated byorag_e2e database and pdfs-e2e directory below. Before this, a live dev server
// happening to already be up on :8000/:5173 got reused as-is, and destructive e2e tests
// (attach/unlink/delete) ran against the real database, permanently deleting real documents.
const BACKEND_PORT = 8100
const FRONTEND_PORT = 5273

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // Reset both the DB schema and the PDF directory before every run so they
      // never drift out of sync (a document row pointing at a file that a
      // filesystem-only reset already deleted) — 008-corpora-management.
      command:
        'rm -rf ./pdfs-e2e && ' +
        'PGPASSWORD=byorag psql -h localhost -U byorag -d byorag_e2e -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" && ' +
        `uv run uvicorn app.main:app --port ${BACKEND_PORT}`,
      cwd: '../backend',
      url: `http://localhost:${BACKEND_PORT}/openapi.json`,
      env: {
        PDFS_DIR: './pdfs-e2e',
        DATABASE_URL: 'postgresql+psycopg://byorag:byorag@localhost:5432/byorag_e2e',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      env: {
        E2E_API_PROXY_TARGET: `http://localhost:${BACKEND_PORT}`,
      },
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
