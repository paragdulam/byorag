import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
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
        'uv run uvicorn app.main:app --port 8000',
      cwd: '../backend',
      url: 'http://localhost:8000/openapi.json',
      env: {
        PDFS_DIR: './pdfs-e2e',
        DATABASE_URL: 'postgresql+psycopg://byorag:byorag@localhost:5432/byorag_e2e',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
