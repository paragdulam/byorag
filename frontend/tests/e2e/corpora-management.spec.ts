import { test, expect } from '@playwright/test'

async function createCorpus(page: import('@playwright/test').Page, name: string) {
  const main = page.locator('main')
  await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
  await main.getByRole('button', { name: /new corpus/i }).click()
  await main.getByLabel(/new corpus name/i).fill(name)
  await main.getByRole('button', { name: /^create$/i }).click()
  await expect(main.getByTestId(/corpus-row-/).filter({ hasText: name })).toHaveAttribute(
    'aria-current',
    'page',
  )
}

async function openCorpusDropdown(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('active-corpus-dropdown-toggle')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
  }
  return page.getByTestId('active-corpus-dropdown-panel')
}

test.describe('Corpora management', () => {
  test('create two corpora and switch between them via the sidebar dropdown', async ({ page }) => {
    // Unique per run so re-running this spec never hits FR-014's
    // duplicate-name rejection against a corpus created by a previous run.
    const suffix = Date.now()
    const corpusAlpha = `Corpus Alpha ${suffix}`
    const corpusBeta = `Corpus Beta ${suffix}`

    await page.goto('/')

    // 010-corpora-dropdown-nav: creation now happens only on the dedicated
    // Corpora screen -- the sidebar dropdown no longer offers a create control.
    await createCorpus(page, corpusAlpha)
    await createCorpus(page, corpusBeta)

    // Creating Corpus Beta made it active.
    const toggle = page.getByTestId('active-corpus-dropdown-toggle')
    await expect(toggle).toHaveText(new RegExp(corpusBeta, 'i'))

    // Switching back to Corpus Alpha from the sidebar dropdown updates the
    // active corpus everywhere. 011-move-corpus-row-actions: switching is a
    // plain row click -- there is no "Make Active" button in the dropdown.
    const panel = await openCorpusDropdown(page)
    await expect(panel.getByRole('button', { name: /new corpus/i })).toHaveCount(0)
    await panel.getByTestId(/dropdown-corpus-row-/).filter({ hasText: corpusAlpha }).click()

    await expect(toggle).toHaveText(new RegExp(corpusAlpha, 'i'))
  })

  test('upload into one corpus, attach to another without re-uploading, then unlink from the first', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusA = `Attach Test A ${suffix}`
    const corpusB = `Attach Test B ${suffix}`
    // Unique content per run (not one of the shared fixture files) so
    // content-hash dedup (FR-005) never collides with another spec's upload
    // under parallel execution.
    const fileName = `unique-${suffix}.pdf`
    const fileContent = Buffer.from(`%PDF-1.4 unique contents ${suffix}`)

    await page.goto('/')

    await createCorpus(page, corpusA)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()

    // Upload a document while Corpus A is active (FR-005).
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: fileContent,
    })
    await expect(page.getByText(fileName)).toBeVisible()

    await createCorpus(page, corpusB)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()

    // Corpus B starts empty -- the document was never uploaded here.
    await expect(page.getByText(fileName)).toHaveCount(0)

    // Switch back to Corpus A via the sidebar dropdown and attach the
    // document to Corpus B without re-uploading (FR-006).
    let panel = await openCorpusDropdown(page)
    await panel.getByTestId(/dropdown-corpus-row-/).filter({ hasText: corpusA }).click()
    await expect(page.getByText(fileName)).toBeVisible()
    await page
      .getByRole('combobox', { name: new RegExp(`add ${fileName} to another corpus`, 'i') })
      .selectOption({ label: corpusB })

    // Switch to Corpus B: the document now appears there too, without a
    // duplicate copy (SC-004).
    panel = await openCorpusDropdown(page)
    await panel.getByTestId(/dropdown-corpus-row-/).filter({ hasText: corpusB }).click()
    await expect(page.getByText(fileName)).toBeVisible()

    // Unlink from Corpus A: the document survives (still linked to B).
    panel = await openCorpusDropdown(page)
    await panel.getByTestId(/dropdown-corpus-row-/).filter({ hasText: corpusA }).click()
    await expect(page.getByText(fileName)).toBeVisible()
    await page
      .getByRole('button', { name: new RegExp(`remove ${fileName} from this corpus`, 'i') })
      .click()
    await expect(page.getByText(fileName)).toHaveCount(0)

    panel = await openCorpusDropdown(page)
    await panel.getByTestId(/dropdown-corpus-row-/).filter({ hasText: corpusB }).click()
    await expect(page.getByText(fileName)).toBeVisible()
  })
})
