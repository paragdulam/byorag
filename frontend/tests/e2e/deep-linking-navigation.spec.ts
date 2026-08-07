import { test, expect } from '@playwright/test'

// 032-deep-linking US1 (quickstart.md Scenario 1): the URL reflects screen+corpus as the user
// navigates, a copied URL reopens on the same screen/corpus in a fresh tab, reload persists the
// location, and Back/Forward move correctly between prior locations.
test.describe('Deep linking — address bar reflects navigation', () => {
  test('navigate, copy URL into a new tab, reload, and use Back/Forward', async ({ page }) => {
    const suffix = Date.now()

    // Self-contained: signs up its own user (024-user-authentication's login gate), matching
    // every other spec in this suite.
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`deep-linking-nav-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    // A brand-new account has no corpora yet — Sources renders with no corpus segment in the
    // URL at all (contracts/url-scheme.md: corpusId is optional, this is not a not-found state).
    expect(new URL(page.url()).pathname).toBe('/sources')

    // Creating a corpus is what gives corpus-scoped screens something to put in the URL.
    const corpusName = `Deep Linking Nav E2E ${suffix}`
    const main = page.locator('main')
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    expect(new URL(page.url()).pathname).toBe('/corpora')
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await page.getByRole('link', { name: 'VECTOR VIEW', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Vector View' })).toBeVisible()
    // The URL initially lands on "/vector-view" (no corpus segment yet); the corpus-sync effect
    // fills in the last-used corpus a tick later (research.md §3) — wait for that to settle
    // before treating the URL as final.
    await page.waitForURL(/\/vector-view\/[^/]+$/)
    const vectorViewUrl = page.url()

    // Copy the current URL and open it in a new tab, same signed-in session (localStorage-based
    // token — shared within the same browser context).
    const secondTab = await page.context().newPage()
    await secondTab.goto(vectorViewUrl)
    await expect(secondTab.getByRole('heading', { name: 'Vector View' })).toBeVisible()
    expect(new URL(secondTab.url()).pathname).toBe(new URL(vectorViewUrl).pathname)
    await secondTab.close()

    // Reload persists screen/corpus rather than resetting to the default screen.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Vector View' })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(new URL(vectorViewUrl).pathname)

    // Back/Forward move correctly between the previously visited locations.
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Corpora', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Corpora', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Vector View' })).toBeVisible()
  })
})
