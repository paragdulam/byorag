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

test.describe('Corpora dropdown in the sidebar (010-corpora-dropdown-nav, simplified in 011-move-corpus-row-actions)', () => {
  test('starts closed, opens on click, reflects the active corpus, and closes on a second click', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusName = `Dropdown Basics ${suffix}`

    await page.goto('/')
    await createCorpus(page, corpusName)

    const toggle = page.getByTestId('active-corpus-dropdown-toggle')
    await expect(toggle).toHaveText(new RegExp(corpusName, 'i'))
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('active-corpus-dropdown-panel')).toHaveCount(0)

    await toggle.click()
    const panel = page.getByTestId('active-corpus-dropdown-panel')
    await expect(panel).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    // 010-corpora-dropdown-nav FR-003 (amended): no create control in the
    // open panel -- creation only happens from the dedicated Corpora screen.
    await expect(panel.getByRole('button', { name: /new corpus/i })).toHaveCount(0)
    await expect(panel.getByLabel(/new corpus name/i)).toHaveCount(0)

    // 011-move-corpus-row-actions FR-008: no "Make Active"/"Delete" buttons
    // either -- those actions now live only on the dedicated Corpora screen.
    await expect(panel.getByRole('button', { name: /make .* active/i })).toHaveCount(0)
    await expect(panel.getByRole('button', { name: /^delete/i })).toHaveCount(0)

    await toggle.click()
    await expect(page.getByTestId('active-corpus-dropdown-panel')).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('closes when clicking outside the panel', async ({ page }) => {
    const suffix = Date.now()
    const corpusName = `Dropdown Outside Click ${suffix}`

    await page.goto('/')
    await createCorpus(page, corpusName)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()

    const toggle = page.getByTestId('active-corpus-dropdown-toggle')
    await toggle.click()
    await expect(page.getByTestId('active-corpus-dropdown-panel')).toBeVisible()

    await page.locator('main').click()
    await expect(page.getByTestId('active-corpus-dropdown-panel')).toHaveCount(0)
  })

  test('clicking a non-active corpus\'s row in the dropdown updates Sources immediately, no reload', async ({
    page,
  }) => {
    const suffix = Date.now()
    const corpusA = `Dropdown Switch A ${suffix}`
    const corpusB = `Dropdown Switch B ${suffix}`
    const fileName = `dropdown-switch-${suffix}.pdf`

    await page.goto('/')

    await createCorpus(page, corpusA)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: fileName,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 dropdown switch ${suffix}`),
    })
    await expect(page.getByText(fileName)).toBeVisible()

    await createCorpus(page, corpusB)
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await expect(page.getByText(fileName)).toHaveCount(0)

    const toggle = page.getByTestId('active-corpus-dropdown-toggle')
    await toggle.click()
    const panel = page.getByTestId('active-corpus-dropdown-panel')
    await panel.getByTestId(/dropdown-corpus-row-/).filter({ hasText: corpusA }).click()

    // The Sources screen behind the (now closed) dropdown reflects the
    // switch with no page reload.
    await expect(toggle).toHaveText(new RegExp(corpusA, 'i'))
    await expect(page.getByText(fileName)).toBeVisible()
  })
})
