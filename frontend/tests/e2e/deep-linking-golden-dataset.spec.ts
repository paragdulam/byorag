import { test, expect } from '@playwright/test'
import { makePdf } from './fixtures/makePdf'

// 032-deep-linking US2 (quickstart.md Scenario 2): copying a Golden Dataset entry's link and
// opening it lands directly on that entry; opening it signed-out routes through sign-in first;
// deleting the entry then reopening its link renders the not-found state.
test.describe('Deep linking — Golden Dataset entry links', () => {
  test('copy link, open signed-in, sign-out/reopen, then delete and reopen', async ({ page, context }) => {
    test.setTimeout(150_000)
    const suffix = Date.now()

    await page.setViewportSize({ width: 1600, height: 900 })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    let mockedHasKey = false
    await page.route('**/api/profile/anthropic-key', async (route) => {
      const method = route.request().method()
      if (method === 'PUT') {
        mockedHasKey = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ hasKey: true, maskedKey: '...wxyz' }),
        })
        return
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            mockedHasKey ? { hasKey: true, maskedKey: '...wxyz' } : { hasKey: false, maskedKey: null },
          ),
        })
        return
      }
      await route.continue()
    })

    const email = `deep-linking-gd-${suffix}@example.com`
    const password = 'hunter22'

    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Deep Linking GD E2E ${suffix}`
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
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: 'deep-linking-gd-source.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf(
        'Either party may terminate this agreement with thirty days written notice delivered by mail.',
      ),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'deep-linking-gd-source.pdf' })
    await page.getByLabel('Chunk size').fill('8')
    await page.getByLabel(/^overlap$/i).fill('0')
    await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0)
    await page.getByRole('button', { name: 'Save Chunks' }).click()
    await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)

    await page.getByRole('link', { name: 'EMBEDDINGS', exact: true }).click()
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    await page.getByRole('button', { name: 'Generate Embeddings' }).click()
    await expect(page.getByText(/embeddings generated/i)).toBeVisible({ timeout: 30_000 })
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })

    await page.getByRole('link', { name: 'GOLDEN DATASET', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Golden Dataset' })).toBeVisible()

    await page.getByRole('button', { name: 'Write Manually' }).click()
    await page.getByRole('textbox', { name: /^question$/i }).fill('What is the notice period?')
    await page.getByRole('textbox', { name: /preferred answer/i }).fill('Thirty days written notice.')
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 10000 })
    await page.getByRole('checkbox').first().check()
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('What is the notice period?')).toBeVisible()
    await expect(page.getByText('Approved').first()).toBeVisible()

    // Copy link, then open it in a new tab in the same signed-in session.
    await page.getByRole('button', { name: /copy link to what is the notice period/i }).click()
    const entryUrl = await page.evaluate(() => navigator.clipboard.readText())
    expect(new URL(entryUrl).pathname).toMatch(/^\/golden-dataset\/[^/]+\/[^/]+$/)

    const secondTab = await context.newPage()
    await secondTab.goto(entryUrl)
    await expect(secondTab.getByRole('heading', { name: 'Golden Dataset' })).toBeVisible()
    await expect(secondTab.getByText('Thirty days written notice.')).toBeVisible()
    await secondTab.close()

    // Sign out, then reopen the same entry link (a full page load, not client-side navigation)
    // — completes sign-in and lands on the entry.
    await page.getByLabel('Profile').click()
    await page.getByRole('button', { name: /^log out$/i }).click()

    await page.goto(entryUrl)
    await expect(page.getByRole('heading', { name: 'Log in to BYORAG' })).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page.getByRole('heading', { name: 'Golden Dataset' })).toBeVisible()
    // Generous timeout: this re-fetches the entry (getEntry) and auto-expands it fresh after
    // the sign-in redirect, competing with whatever else is happening in a full suite run.
    await expect(page.getByText('Thirty days written notice.')).toBeVisible({ timeout: 15_000 })
    expect(new URL(page.url()).pathname).toBe(new URL(entryUrl).pathname)

    // Delete the entry, then reopen its (now stale) link — renders the not-found state.
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /delete what is the notice period/i }).click()
    await expect(page.getByText('What is the notice period?')).toHaveCount(0)

    await page.goto(entryUrl)
    await expect(page.getByRole('alert')).toContainText(/no longer exists/i)
  })
})
