import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

test.describe('Data Sources Screen', () => {
  test('full upload -> list -> export flow', async ({ page }) => {
    await page.goto('/')

    // 003-system-capacity-widget SC-001: the retired Vector Storage widget
    // never appears anywhere on the screen.
    await expect(page.getByText('VECTOR STORAGE')).toHaveCount(0)

    // 003-system-capacity-widget SC-002: real hardware info and a capacity
    // estimate are visible for the machine actually running the app. Exact
    // figures vary by machine, so only presence/shape is asserted here.
    await expect(page.getByText('SYSTEM CAPACITY')).toBeVisible()
    await expect(page.getByText(/PDFs \(estimated\)/)).toBeVisible()
    await expect(page.getByText(/GB total \(estimated\)/)).toBeVisible()

    // SC-001: uploaded file appears within 2 seconds, no full page reload
    const validPdf = path.join(FIXTURES_DIR, 'valid.pdf')
    const start = Date.now()
    await page.setInputFiles('[data-testid="upload-browse-input"]', validPdf)
    await expect(page.getByText('valid.pdf')).toBeVisible()
    expect(Date.now() - start).toBeLessThan(2000)

    // Rejected upload: non-PDF file never appears in the list
    const invalidFile = path.join(FIXTURES_DIR, 'notes.txt')
    await page.setInputFiles('[data-testid="upload-browse-input"]', invalidFile)
    await expect(page.getByText(/notes\.txt/)).toBeVisible()
    await expect(page.getByText(/not a PDF file/i)).toBeVisible()
    await expect(page.getByText('notes.txt', { exact: true })).toHaveCount(0)

    // 002-persist-pdf-sources: the upload is now backed by a real (fast,
    // synchronous) disk write, so the "Processing" placeholder may be
    // visible only too briefly to reliably assert on for a small fixture
    // file -- what matters is that it settles on "Processed".
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    // SC-005: CSV export completes in <= 2 clicks
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('source-documents.csv')

    // 002-persist-pdf-sources FR-005/US1: reloading the page no longer
    // resets the list -- the previously uploaded PDF is still shown because
    // it was persisted to the backend's pdfs directory.
    await page.reload()
    await expect(page.getByText('valid.pdf')).toBeVisible()

    // 004-delete-source-documents US1: deleting a document is permanent and
    // persisted -- it must not reappear after a reload.
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete valid.pdf' }).click()
    await expect(page.getByText('valid.pdf')).toHaveCount(0)

    await page.reload()
    await expect(page.getByText('valid.pdf')).toHaveCount(0)
  })
})
