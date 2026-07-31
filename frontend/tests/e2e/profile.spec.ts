import { test, expect } from '@playwright/test'

test.describe('Profile screen', () => {
  test('view account info and log out (US1)', async ({ page }) => {
    const suffix = Date.now()
    const email = `profile-${suffix}@example.com`

    await page.goto('/')

    // Self-contained: this suite predates 024-user-authentication's login gate, so unlike
    // the rest of tests/e2e/*, this spec signs up its own user rather than assuming an
    // already-authenticated session.
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()

    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByLabel('Profile').click()

    await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    await page.getByRole('button', { name: /log out/i }).click()

    // Back on the signed-out auth gate (Login or Signup — whichever the AuthGate's own
    // toggle state last landed on; the point here is only that the session ended and no
    // BYORAG screen is reachable, not which auth form happens to render).
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).not.toBeVisible()
  })

  test('adding then deleting a key gates Playground/Metrics accordingly (US2, US3)', async ({ page }) => {
    const suffix = Date.now()
    const email = `profile-key-${suffix}@example.com`

    // The real `PUT` validates the key live against Anthropic (research.md §2) — mocked
    // here so this e2e run doesn't depend on a real Anthropic API key, matching this
    // suite's existing route-interception convention for external-provider calls
    // (tests/e2e/playground.spec.ts). Tracks "saved" state itself so the subsequent
    // `GET` (AuthContext's `refreshAnthropicKeyStatus`) reflects the mocked `PUT`
    // instead of round-tripping to the real backend, which never actually received it.
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
      if (method === 'DELETE') {
        mockedHasKey = false
        await route.fulfill({ status: 204 })
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    const playgroundLink = page.getByRole('link', { name: 'PLAYGROUND', exact: true })
    const metricsLink = page.getByRole('link', { name: 'METRICS', exact: true })
    await expect(playgroundLink).toHaveAttribute('aria-disabled', 'true')
    await expect(metricsLink).toHaveAttribute('aria-disabled', 'true')

    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    await expect(playgroundLink).not.toHaveAttribute('aria-disabled', 'true')
    await expect(metricsLink).not.toHaveAttribute('aria-disabled', 'true')

    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: /delete/i }).click()
    await expect(page.getByLabel(/anthropic api key/i)).toBeVisible()

    await expect(playgroundLink).toHaveAttribute('aria-disabled', 'true')
    await expect(metricsLink).toHaveAttribute('aria-disabled', 'true')
  })
})
