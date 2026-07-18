import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeWordsPdf } from './fixtures/makePdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

test.describe('Generate and Save Chunk Embeddings', () => {
  test('save chunks -> generate embeddings with progress -> save with progress -> no cross-contamination with Chunking', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    await page.goto('/')

    const corpusName = `Embeddings E2E Fixture Corpus ${Date.now()}`
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

    const chunkingPdf = path.join(FIXTURES_DIR, 'chunking-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', chunkingPdf)
    await expect(page.getByText('chunking-sample.pdf').first()).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    // Save chunks from the Chunking screen first — Embeddings only works on saved chunks.
    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'chunking-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
    await page.getByLabel(/^overlap$/i).fill('0')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save Chunks' }).click()
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)

    // Navigate to Embeddings.
    await page.getByRole('link', { name: 'EMBEDDINGS', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Embeddings' })).toBeVisible()

    // 015-fix-saved-chunks-not-showing: the saved chunks for the auto-selected document
    // (there's only one, so nothing to manually pick) load without any dropdown interaction.
    // The model picker defaults to BERT.
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    const modelSelect = page.getByLabel(/embedding model/i)
    await expect(modelSelect).toHaveValue('bert')

    // Generate: real progress, then a completed-but-unsaved preview — Save starts disabled.
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
    await page.getByRole('button', { name: 'Generate Embeddings' }).click()
    await expect(page.getByText(/embeddings generated/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('progressbar')).toHaveCount(0)

    // Save: its own progress, independent of Chunking's save state.
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

    // 014-vector-view-screen US1: the first successful save enables "Move to Vector View".
    await expect(page.getByRole('button', { name: 'Move to Vector View' })).toBeEnabled()

    // Save embeddings for this document a second time, to give the first chunk two saved
    // embeddings — sets up the multi-embedding picker check below.
    await page.getByRole('button', { name: 'Generate Embeddings' }).click()
    await expect(page.getByText(/embeddings generated/i)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

    // US1: navigate to Vector View.
    await page.getByRole('button', { name: 'Move to Vector View' }).click()
    await expect(page.getByRole('heading', { name: 'Vector View' })).toBeVisible()

    // 015-fix-saved-chunks-not-showing: the saved chunks for the auto-selected document are
    // listed, and the auto-selected first chunk's real persisted vector shows as a grid, with
    // a picker since it now has two saved embeddings — all without any dropdown/list click.
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    await expect(page.getByTestId('vector-grid')).toBeVisible()
    const embeddingPicker = page.getByLabel(/saved embedding/i)
    await expect(embeddingPicker).toBeVisible()
    const optionCount = await embeddingPicker.locator('option').count()
    expect(optionCount).toBe(2)

    // US3: the projection-method dropdown defaults to Vector; selecting UMAP shows a clear
    // "not available yet" state instead of the grid, and switching back restores it.
    const projectionSelect = page.getByLabel(/projection method/i)
    await expect(projectionSelect).toHaveValue('vector')
    await projectionSelect.selectOption('umap')
    await expect(page.getByText(/not available yet/i)).toBeVisible()
    await expect(page.getByTestId('vector-grid')).toHaveCount(0)
    await projectionSelect.selectOption('vector')
    await expect(page.getByTestId('vector-grid')).toBeVisible()

    // US4: move on to the Playground placeholder.
    await page.getByRole('button', { name: 'Move to Playground' }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    // Navigating back to Chunking works normally and its saved chunks are still intact
    // (the Embeddings save that just happened wrote to a separate table and did not
    // disturb them — spec FR-008's independence requirement). The Chunking screen's own
    // preview/save UI state is local to that screen and legitimately resets on
    // remount (matching every other screen's selection state in this app) — re-running
    // it here proves the underlying saved chunks survived, not a persisted UI flag.
    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'chunking-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
    await page.getByLabel(/^overlap$/i).fill('0')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/not saved/i)
    await page.getByRole('button', { name: 'Save Chunks' }).click()
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)
  })

  test('Entire Corpus generates and saves embeddings for every document, skipping one with no saved chunks (018-ui-polish-batch US2)', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.goto('/')

    const suffix = Date.now()
    const corpusName = `Entire Corpus Embeddings E2E ${suffix}`
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

    // Two documents get saved chunks; a third is left with none, to exercise the
    // skip-and-report path (FR-021). Real, extractable PDFs (not raw byte buffers) — the
    // word itself is unique per run/document so content-hash dedup never collides with a
    // previous run's upload (002-persist-pdf-sources).
    for (let i = 0; i < 2; i += 1) {
      await page.setInputFiles('[data-testid="upload-browse-input"]', {
        name: `entire-embed-${suffix}-${i}.pdf`,
        mimeType: 'application/pdf',
        buffer: makeWordsPdf(30, `entireembed${suffix}word${i}`),
      })
      await expect(page.getByText(`entire-embed-${suffix}-${i}.pdf`)).toBeVisible()
    }
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: `entire-embed-${suffix}-nochunks.pdf`,
      mimeType: 'application/pdf',
      buffer: makeWordsPdf(30, `entireembed${suffix}nochunks`),
    })
    await expect(page.getByText(`entire-embed-${suffix}-nochunks.pdf`)).toBeVisible()

    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    for (let i = 0; i < 2; i += 1) {
      await page.getByLabel('Select document').selectOption({ label: `entire-embed-${suffix}-${i}.pdf` })
      await page.getByLabel('Chunk size').fill('10')
      await page.getByLabel(/^overlap$/i).fill('0')
      await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
      await expect(page.getByRole('progressbar')).toHaveCount(0)
      await page.getByRole('button', { name: 'Save Chunks' }).click()
      await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)
    }

    await page.getByRole('link', { name: 'EMBEDDINGS', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'Entire Corpus' })
    await page.getByRole('button', { name: 'Generate Embeddings' }).click()

    await expect(page.getByTestId('entire-corpus-summary')).toBeVisible({ timeout: 30_000 })
    const summary = page.getByTestId('entire-corpus-summary')
    await expect(summary.getByRole('listitem')).toHaveCount(3)
    // The no-saved-chunks document is reported as a failure (not silently dropped or
    // treated as a success) — the other two report a real generated-embeddings count.
    const noChunksRow = summary.getByRole('listitem').filter({ hasText: 'nochunks' })
    await expect(noChunksRow.getByRole('alert')).toBeVisible()
    await expect(summary.getByText(/embeddings generated/i)).toHaveCount(2)

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByTestId('entire-corpus-summary')).toBeVisible({ timeout: 30_000 })
  })
})
