import { test, expect } from '@playwright/test'
import { makeWordsPdf } from './fixtures/makePdf'

test.describe('Vector View — Entire Corpus (018-ui-polish-batch US8)', () => {
  test('selecting Entire Corpus shows a grouped chunk list across documents, with per-chunk embedding selection', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const suffix = Date.now()

    await page.goto('/')

    const corpusName = `Vector View Entire Corpus E2E ${suffix}`
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

    const docNames = [`vv-entire-${suffix}-a.pdf`, `vv-entire-${suffix}-b.pdf`]
    for (const [i, name] of docNames.entries()) {
      await page.setInputFiles('[data-testid="upload-browse-input"]', {
        name,
        mimeType: 'application/pdf',
        buffer: makeWordsPdf(30, `vventire${suffix}word${i}`),
      })
      await expect(page.getByText(name)).toBeVisible()
    }

    // Save chunks and embeddings for both documents.
    for (const name of docNames) {
      await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
      await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
      await page.getByLabel('Select document').selectOption({ label: name })
      await page.getByLabel('Chunk size').fill('10')
      await page.getByLabel(/^overlap$/i).fill('0')
      await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
      await expect(page.getByRole('progressbar')).toHaveCount(0)
      await page.getByRole('button', { name: 'Save Chunks' }).click()
      await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)

      await page.getByRole('link', { name: 'EMBEDDINGS', exact: true }).click()
      await page.getByLabel('Select document').selectOption({ label: name })
      await expect(page.getByText('CHUNK_0')).toBeVisible()
      await page.getByRole('button', { name: 'Generate Embeddings' }).click()
      await expect(page.getByText(/embeddings generated/i)).toBeVisible({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    }

    await page.getByRole('link', { name: 'VECTOR VIEW', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vector View' })).toBeVisible()

    await page.getByLabel('Select document').selectOption({ label: 'Entire Corpus' })

    // Both documents' chunks appear, grouped — scoped to the chunk-list panel since the
    // document names also appear (hidden) as <option> text in the selector above it.
    const chunkList = page.getByTestId('vector-view-chunk-list')
    await expect(chunkList.getByText(docNames[0])).toBeVisible()
    await expect(chunkList.getByText(docNames[1])).toBeVisible()
    await expect(chunkList.getByText('CHUNK_0').first()).toBeVisible()

    // Selecting any chunk shows its own saved embedding as a vector grid.
    await page.getByLabel('Select chunk 0').first().click()
    await expect(page.getByTestId('vector-grid')).toBeVisible()
  })
})
