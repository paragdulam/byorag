import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

test.describe('Chunking Section Redesign & Embeddings Entry Point', () => {
  test('upload -> navigate -> configure -> run -> see progress and chunks -> move to Embeddings', async ({
    page,
  }) => {
    await page.goto('/')

    // Upload a document with real extractable text (60 words).
    const chunkingPdf = path.join(FIXTURES_DIR, 'chunking-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', chunkingPdf)
    await expect(page.getByText('chunking-sample.pdf').first()).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    // US1: reach the screen via the renamed "Chunking" section — no "Experiments" anywhere.
    await expect(page.getByRole('link', { name: 'EXPERIMENTS' })).toHaveCount(0)
    await page.getByRole('link', { name: 'CHUNKING' }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING' }).click()
    await expect(page.getByRole('heading', { name: 'Fixed Size Chunking' })).toBeVisible()

    // US1: horizontal control bar, no algorithm-selection control anywhere.
    await expect(page.getByTestId('chunking-control-bar')).toBeVisible()
    await expect(page.getByLabel(/recursive character/i)).toHaveCount(0)
    await expect(page.getByLabel(/semantic chunking/i)).toHaveCount(0)

    // "Move to Embeddings" starts disabled — no successful run yet this session.
    await expect(page.getByRole('button', { name: 'Move to Embeddings' })).toBeDisabled()

    // US1/US2: configure via the horizontal bar and run; the picker may default to another
    // document already in this corpus, so select the freshly uploaded fixture explicitly.
    await page.getByLabel('Select document').selectOption({ label: 'chunking-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()

    // US2: real progress bar appears while the run is in flight.
    await expect(page.getByRole('progressbar')).toBeVisible()

    // 60 words / chunk size 10 = 6 chunks.
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    await expect(page.getByText('CHUNK_5')).toBeVisible()
    await expect(page.getByText('CHUNK_6')).toHaveCount(0)
    await expect(
      page
        .getByText(/sample sample sample sample sample sample sample sample sample sample/)
        .first(),
    ).toBeVisible()
    await expect(page.getByRole('progressbar')).toHaveCount(0)

    // US3: "Move to Embeddings" is now enabled after the successful run.
    const moveToEmbeddings = page.getByRole('button', { name: 'Move to Embeddings' })
    await expect(moveToEmbeddings).toBeEnabled()
    await moveToEmbeddings.click()

    await expect(page.getByRole('heading', { name: 'Embeddings' })).toBeVisible()
    await expect(page.getByText(/coming soon/i)).toBeVisible()
  })
})
