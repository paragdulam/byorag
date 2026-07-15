import { test, expect } from '@playwright/test'

test.describe('Sidebar chevron indicator', () => {
  test('chevron appears only next to Chunking and rotates on expand/collapse', async ({ page }) => {
    await page.goto('/')

    const chunkingLink = page.getByRole('link', { name: 'CHUNKING', exact: true })
    const sourcesLink = page.getByRole('link', { name: 'SOURCES', exact: true })

    // FR-012 / SC-005: chevron present only on the expandable item.
    await expect(chunkingLink.getByTestId('chevron-icon')).toBeVisible()
    await expect(sourcesLink.getByTestId('chevron-icon')).toHaveCount(0)

    await expect(chunkingLink).toHaveAttribute('aria-expanded', 'false')
    await expect(chunkingLink.getByTestId('chevron-icon')).toHaveClass(/rotate-0/)

    await chunkingLink.click()

    await expect(chunkingLink).toHaveAttribute('aria-expanded', 'true')
    await expect(chunkingLink.getByTestId('chevron-icon')).toHaveClass(/rotate-90/)

    await chunkingLink.click()

    await expect(chunkingLink).toHaveAttribute('aria-expanded', 'false')
    await expect(chunkingLink.getByTestId('chevron-icon')).toHaveClass(/rotate-0/)
  })
})
