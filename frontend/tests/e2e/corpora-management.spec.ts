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

// 029-corpora-nav-redesign: the sidebar's quick-switcher dropdown is gone -- switching the
// active corpus now happens only from the dedicated Corpora screen's "Make Active" button.
async function switchToCorpus(page: import('@playwright/test').Page, name: string) {
  const main = page.locator('main')
  await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
  await main.getByRole('button', { name: new RegExp(`make ${name} active`, 'i') }).click()
  await expect(main.getByTestId(/corpus-row-/).filter({ hasText: name })).toHaveAttribute(
    'aria-current',
    'page',
  )
}

test.describe('Corpora management', () => {
  test('create two corpora and switch between them via the Corpora screen', async ({ page }) => {
    // Unique per run so re-running this spec never hits FR-014's
    // duplicate-name rejection against a corpus created by a previous run.
    const suffix = Date.now()
    const corpusAlpha = `Corpus Alpha ${suffix}`
    const corpusBeta = `Corpus Beta ${suffix}`

    // Self-contained: this spec predates 024-user-authentication's login gate, so it signs up
    // its own user rather than assuming an already-authenticated session (matches the pattern
    // established by data-sources-screen.spec.ts's zoom-pan test and profile.spec.ts).
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`corpora-mgmt-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    // 010-corpora-dropdown-nav: creation happens only on the dedicated Corpora screen.
    await createCorpus(page, corpusAlpha)
    await createCorpus(page, corpusBeta)

    // Creating Corpus Beta made it active -- the sidebar's Corpora subtitle (029-corpora-nav-
    // redesign) reflects the active corpus on every screen.
    const sidebarActiveCorpus = page.getByTestId('corpora-nav-active-corpus')
    await expect(sidebarActiveCorpus).toHaveText(new RegExp(corpusBeta, 'i'))

    // Switching back to Corpus Alpha from the Corpora screen updates the active corpus
    // everywhere, reflected immediately in the sidebar subtitle without a page reload.
    await switchToCorpus(page, corpusAlpha)

    await expect(sidebarActiveCorpus).toHaveText(new RegExp(corpusAlpha, 'i'))
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

    // Wider than the Playwright default (1280x720): at the default width, DocumentList's
    // fixed-width table columns leave almost no room for the DOCUMENT NAME column, collapsing
    // it to a couple of pixels -- a pre-existing, unrelated DocumentList responsive-layout
    // issue (documented by other specs, e.g. data-sources-screen.spec.ts's zoom-pan test) that
    // would otherwise hide the uploaded file name this test asserts on.
    await page.setViewportSize({ width: 1600, height: 900 })

    // Self-contained: see the signup comment on the test above.
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`corpora-attach-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

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

    // Switch back to Corpus A via the Corpora screen and attach the document to Corpus B
    // without re-uploading (FR-006).
    await switchToCorpus(page, corpusA)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileName)).toBeVisible()
    await page
      .getByRole('combobox', { name: new RegExp(`add ${fileName} to another corpus`, 'i') })
      .selectOption({ label: corpusB })

    // Switch to Corpus B: the document now appears there too, without a
    // duplicate copy (SC-004).
    await switchToCorpus(page, corpusB)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileName)).toBeVisible()

    // Unlink from Corpus A: the document survives (still linked to B).
    await switchToCorpus(page, corpusA)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileName)).toBeVisible()
    await page
      .getByRole('button', { name: new RegExp(`remove ${fileName} from this corpus`, 'i') })
      .click()
    await expect(page.getByText(fileName)).toHaveCount(0)

    await switchToCorpus(page, corpusB)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileName)).toBeVisible()
  })
})
