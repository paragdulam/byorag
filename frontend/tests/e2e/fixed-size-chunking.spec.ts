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

    // 008-corpora-management: create and use a dedicated corpus (name avoids
    // any substring collision with real nav labels like "CHUNKING") so this
    // test never races with other specs over a shared default corpus under
    // parallel execution.
    // 010-corpora-dropdown-nav: corpus creation now lives only on the
    // dedicated Corpora screen, not the sidebar.
    const corpusName = `E2E Fixture Corpus ${Date.now()}`
    const main = page.locator('main')
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()

    // Upload a document with real extractable text (60 words).
    const chunkingPdf = path.join(FIXTURES_DIR, 'chunking-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', chunkingPdf)
    await expect(page.getByText('chunking-sample.pdf').first()).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    // US1: reach the screen via the renamed "Chunking" section — no "Experiments" anywhere.
    await expect(page.getByRole('link', { name: 'EXPERIMENTS' })).toHaveCount(0)
    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Fixed Size Chunking' })).toBeVisible()

    // US1: horizontal control bar, no algorithm-selection control anywhere.
    await expect(page.getByTestId('chunking-control-bar')).toBeVisible()
    await expect(page.getByLabel(/recursive character/i)).toHaveCount(0)
    await expect(page.getByLabel(/semantic chunking/i)).toHaveCount(0)

    // "Move to Embeddings" starts disabled — no successful save yet this session
    // (012-save-chunks-button: gated on save, not merely a successful preview).
    await expect(page.getByRole('button', { name: 'Move to Embeddings' })).toBeDisabled()
    // "Save Chunks" starts disabled too — no successful preview to save yet.
    await expect(page.getByRole('button', { name: 'Save Chunks' })).toBeDisabled()

    // US1/US2: configure via the horizontal bar and run; the picker may default to another
    // document already in this corpus, so select the freshly uploaded fixture explicitly.
    await page.getByLabel('Select document').selectOption({ label: 'chunking-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
    // Overlap must be below chunk size (007-chunking-overlap-controls) — start at 0 for a
    // non-overlapping baseline run.
    await page.getByLabel(/^overlap$/i).fill('0')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()

    // US2: real progress bar appears while the run is in flight.
    await expect(page.getByRole('progressbar')).toBeVisible()

    // 60 words / chunk size 10, no overlap = 6 chunks.
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    await expect(page.getByText('CHUNK_5')).toBeVisible()
    await expect(page.getByText('CHUNK_6')).toHaveCount(0)
    await expect(
      page
        .getByText(/sample sample sample sample sample sample sample sample sample sample/)
        .first(),
    ).toBeVisible()
    await expect(page.getByRole('progressbar')).toHaveCount(0)

    // 007-chunking-overlap-controls US2: the chunk count below the Overlap slider matches.
    await expect(page.getByTestId('overlap-chunk-count')).toHaveText('6 chunks')

    // 012-save-chunks-button US1/US3: a preview alone never persists — the indicator says
    // unsaved, and Move to Embeddings is still disabled even after a successful run.
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/not saved/i)
    await expect(page.getByRole('button', { name: 'Move to Embeddings' })).toBeDisabled()

    // 012-save-chunks-button US2: an explicit Save Chunks click persists this result and
    // flips the indicator to saved; Move to Embeddings now becomes enabled.
    await page.getByRole('button', { name: 'Save Chunks' }).click()
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)
    await expect(page.getByRole('button', { name: 'Move to Embeddings' })).toBeEnabled()

    // 007-chunking-overlap-controls US1/US3: raising Overlap and re-running produces more,
    // genuinely overlapping chunks, and the below-slider count updates to match.
    await page.getByLabel(/^overlap$/i).fill('5')
    await expect(page.getByTestId('overlap-value')).toHaveText('5')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0)

    // stride = chunk_size(10) - overlap(5) = 5 -> ceil(60 / 5) = 12 chunks.
    await expect(page.getByText('CHUNK_11')).toBeVisible()
    await expect(page.getByText('CHUNK_12')).toHaveCount(0)
    await expect(page.getByTestId('overlap-chunk-count')).toHaveText('12 chunks')

    // 012-save-chunks-button US3: re-running after the earlier save reverts the indicator
    // to unsaved — this new result hasn't itself been saved yet — even though "Move to
    // Embeddings" stays enabled (hasSavedOnce is a one-way latch, spec Assumptions).
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/not saved/i)
    await expect(page.getByRole('button', { name: 'Move to Embeddings' })).toBeEnabled()

    // 007-chunking-overlap-controls US3: overlap >= chunk size is blocked with a message.
    await page.getByLabel(/^overlap$/i).fill('10')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
    await expect(page.getByText(/overlap must be smaller than chunk size/i)).toBeVisible()

    // US3: "Move to Embeddings" remains enabled from the earlier save.
    const moveToEmbeddings = page.getByRole('button', { name: 'Move to Embeddings' })
    await expect(moveToEmbeddings).toBeEnabled()
    await moveToEmbeddings.click()

    await expect(page.getByRole('heading', { name: 'Embeddings' })).toBeVisible()
  })
})
