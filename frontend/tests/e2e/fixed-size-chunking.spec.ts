import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

test.describe('Fixed Size Chunking Experiment', () => {
  test('upload -> navigate -> run -> see chunks', async ({ page }) => {
    await page.goto('/')

    // Upload a document with real extractable text (60 words).
    const chunkingPdf = path.join(FIXTURES_DIR, 'chunking-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', chunkingPdf)
    await expect(page.getByText('chunking-sample.pdf')).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    // 005-fixed-size-chunking US1: reach the screen via the sidebar.
    await page.getByText('EXPERIMENTS').click()
    await page.getByText('FIXED SIZE CHUNKING').click()
    await expect(page.getByRole('heading', { name: 'Fixed Size Chunking' })).toBeVisible()

    // 005-fixed-size-chunking US2: run chunking and see the results. The
    // picker may default to another document already in this corpus, so
    // select the freshly uploaded fixture explicitly.
    await page.getByLabel('Select document').selectOption({ label: 'chunking-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()

    // 60 words / chunk size 10 = 6 chunks.
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    await expect(page.getByText('CHUNK_5')).toBeVisible()
    await expect(page.getByText('CHUNK_6')).toHaveCount(0)
    await expect(
      page.getByText(/sample sample sample sample sample sample sample sample sample sample/).first(),
    ).toBeVisible()

    // 005-fixed-size-chunking US3: no Comparison section anywhere.
    await expect(page.getByText(/comparison/i)).toHaveCount(0)
  })
})
