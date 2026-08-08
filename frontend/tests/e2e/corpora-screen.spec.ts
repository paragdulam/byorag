import { test, expect } from '@playwright/test'

test.describe('Corpora screen', () => {
  test('navigate to the Corpora screen, create a corpus, and select it as active', async ({ page }) => {
    const suffix = Date.now()
    const corpusName = `Screen Test ${suffix}`

    await page.goto('/')

    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Corpora', exact: true })).toBeVisible()

    // Scoped to <main> so this exercises the new screen's own create form, not
    // the sidebar's pre-existing quick-switcher control (both are visible at
    // once and are functionally equivalent, but this test targets the screen).
    const main = page.locator('main')
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()

    const row = main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute('aria-current', 'page')
  })

  test('switching the active corpus from the Corpora screen updates Sources and Chunking (US2)', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusA = `Scoping A ${suffix}`
    const corpusB = `Scoping B ${suffix}`
    const fileA = { name: `doc-a-${suffix}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 a ${suffix}`) }
    const fileB = { name: `doc-b-${suffix}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4 b ${suffix}`) }

    await page.goto('/')
    const main = page.locator('main')

    // Create Corpus A (becomes active) and upload its document from Sources.
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusA)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusA })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await page.setInputFiles('[data-testid="upload-browse-input"]', fileA)
    await expect(page.getByText(fileA.name)).toBeVisible()

    // Create Corpus B (becomes active) and upload its own, distinct document.
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusB)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusB })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileA.name)).toHaveCount(0)
    await page.setInputFiles('[data-testid="upload-browse-input"]', fileB)
    await expect(page.getByText(fileB.name)).toBeVisible()

    // Chunking's document picker also reflects only Corpus B's document.
    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    const picker = page.getByLabel('Select document')
    await expect(picker.locator('option', { hasText: fileB.name })).toHaveCount(1)
    await expect(picker.locator('option', { hasText: fileA.name })).toHaveCount(0)

    // Switching back to Corpus A restores its own scoped view everywhere. Row clicks no
    // longer switch the active corpus (018-ui-polish-batch US5) — only the row's own
    // explicit "Make Active" button does.
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main
      .getByTestId(/corpus-row-/)
      .filter({ hasText: corpusA })
      .getByRole('button', { name: new RegExp(`make ${corpusA} active`, 'i') })
      .click()

    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileA.name)).toBeVisible()
    await expect(page.getByText(fileB.name)).toHaveCount(0)
  })

  test('manage a corpus\'s documents from the Corpora screen (033-ui-ux-polish US1)', async ({ page }) => {
    const suffix = Date.now()
    const corpusName = `Docs Manage ${suffix}`
    const fileName = `managed-${suffix}.pdf`

    await page.goto('/')
    const main = page.locator('main')

    // Create the corpus (active) and upload a document into it via Sources.
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    const row = main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })
    await expect(row).toHaveAttribute('aria-current', 'page')
    // The row's own document preview -- there is no separate "Documents in X" panel
    // (033-ui-ux-polish: hyperlink + delete styling lives directly under the corpus row).
    const docsList = row.getByTestId(/-documents$/)

    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 managed ${suffix}`),
    })
    await expect(page.getByText(fileName)).toBeVisible()

    // The document's name is a hyperlink back to the Sources screen with it opened
    // (033-ui-ux-polish US1's document deep link).
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await docsList.getByRole('link', { name: fileName }).click()
    await expect(page).toHaveURL(/\/sources\/[^/]+\/[^/]+$/)
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    // Deleting it from the Corpora screen (via the delete icon + confirmation) removes it from
    // the system entirely — a document now belongs to exactly one corpus for its whole
    // lifetime, so there is no separate "remove from this corpus" vs. "delete" distinction.
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: new RegExp(`delete ${fileName}`, 'i') }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(docsList.getByText(fileName)).toHaveCount(0)

    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileName)).toHaveCount(0)
  })

  test('deleting a corpus from its row is blocked while non-empty, then succeeds once empty (US4, relocated in 011-move-corpus-row-actions)', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusName = `Delete Test ${suffix}`
    const fileName = `to-delete-${suffix}.pdf`

    await page.goto('/')
    const main = page.locator('main')

    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    const row = main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })
    await expect(row).toHaveAttribute('aria-current', 'page')
    const deleteButton = row.getByRole('button', { name: new RegExp(`delete ${corpusName}`, 'i') })
    const docsList = row.getByTestId(/-documents$/)

    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 delete-me ${suffix}`),
    })
    await expect(page.getByText(fileName)).toBeVisible()

    // Deletion is blocked while the corpus still has this document.
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    page.once('dialog', (dialog) => dialog.accept())
    await deleteButton.click()
    await expect(main.getByRole('alert')).toContainText(/still associated/i)
    await expect(row).toBeVisible()

    // Delete the document (via its delete icon + confirmation), then corpus deletion succeeds.
    await main.getByRole('button', { name: new RegExp(`delete ${fileName}`, 'i') }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(docsList.getByText(fileName)).toHaveCount(0)

    page.once('dialog', (dialog) => dialog.accept())
    await deleteButton.click()
    await expect(row).toHaveCount(0)
  })

  test('making a non-active corpus active from its row (011-move-corpus-row-actions US1)', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusA = `Row Active A ${suffix}`
    const corpusB = `Row Active B ${suffix}`

    await page.goto('/')
    const main = page.locator('main')

    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusA)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusA })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusB)
    await main.getByRole('button', { name: /^create$/i }).click()

    // Corpus B is now active (just created); switch back to Corpus A via its
    // row's own "Make Active" button.
    const rowA = main.getByTestId(/corpus-row-/).filter({ hasText: corpusA })
    await rowA.getByRole('button', { name: new RegExp(`make ${corpusA} active`, 'i') }).click()

    await expect(rowA).toHaveAttribute('aria-current', 'page')
    await expect(rowA.getByText(/^active$/i)).toBeVisible()
    const rowB = main.getByTestId(/corpus-row-/).filter({ hasText: corpusB })
    await expect(rowB).not.toHaveAttribute('aria-current')
    await expect(rowB.getByRole('button', { name: new RegExp(`make ${corpusB} active`, 'i') })).toBeVisible()
  })

  test('clicking a corpus row never changes the active corpus; only its "Make Active" button does (018-ui-polish-batch US5)', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusA = `Click Vs Button A ${suffix}`
    const corpusB = `Click Vs Button B ${suffix}`

    await page.goto('/')
    const main = page.locator('main')

    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusA)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusA })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusB)
    await main.getByRole('button', { name: /^create$/i }).click()
    const rowA = main.getByTestId(/corpus-row-/).filter({ hasText: corpusA })
    const rowB = main.getByTestId(/corpus-row-/).filter({ hasText: corpusB })
    await expect(rowB).toHaveAttribute('aria-current', 'page')

    // Clicking row A anywhere but its "Make Active" button leaves B active.
    await rowA.click({ position: { x: 10, y: 10 } })
    await expect(rowB).toHaveAttribute('aria-current', 'page')
    await expect(rowA).not.toHaveAttribute('aria-current')

    // Only the explicit button switches it.
    await rowA.getByRole('button', { name: new RegExp(`make ${corpusA} active`, 'i') }).click()
    await expect(rowA).toHaveAttribute('aria-current', 'page')
    await expect(rowB).not.toHaveAttribute('aria-current')
  })

  test('previews each corpus\'s documents in its own row, with a Show more toggle past 5 (018-ui-polish-batch US7)', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusName = `Row Preview ${suffix}`

    await page.goto('/')
    const main = page.locator('main')

    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    const row = main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })
    await expect(row).toHaveAttribute('aria-current', 'page')

    // A freshly-created, empty corpus shows an empty-state message in its row preview.
    await expect(row.getByText(/no documents in this corpus yet/i)).toBeVisible()

    // Upload 6 documents into it — more than the 5-item preview limit.
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    for (let i = 0; i < 6; i += 1) {
      await page.setInputFiles('[data-testid="upload-browse-input"]', {
        name: `preview-doc-${suffix}-${i}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from(`%PDF-1.4 preview ${suffix} ${i}`),
      })
      await expect(page.getByText(`preview-doc-${suffix}-${i}.pdf`)).toBeVisible()
    }

    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await expect(row.getByRole('listitem')).toHaveCount(5)
    const showMore = row.getByRole('button', { name: /show more/i })
    await expect(showMore).toBeVisible()

    await showMore.click()
    await expect(row.getByRole('listitem')).toHaveCount(6)
    await expect(row.getByRole('button', { name: /show less/i })).toBeVisible()
  })
})
