import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { makePdf, makeMultiPagePdf } from './fixtures/makePdf'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

test.describe('Data Sources Screen', () => {
  test('full upload -> list -> export flow', async ({ page }) => {
    await page.goto('/')

    // 008-corpora-management: create and use a dedicated corpus so this test
    // never races with other specs over a shared default corpus under
    // parallel execution.
    // 010-corpora-dropdown-nav: corpus creation now lives only on the
    // dedicated Corpora screen, not the sidebar.
    const corpusName = `Upload Flow Test ${Date.now()}`
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

    // 003-system-capacity-widget SC-001: the retired Vector Storage widget
    // never appears anywhere on the screen.
    await expect(page.getByText('VECTOR STORAGE')).toHaveCount(0)

    // System Capacity widget is temporarily not rendered on this screen (kept in the
    // codebase for future re-introduction).
    await expect(page.getByText('SYSTEM CAPACITY')).toHaveCount(0)

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

  test('a long, unbroken-token document name wraps instead of forcing horizontal scrolling (018-ui-polish-batch US3)', async ({
    page,
  }) => {
    await page.goto('/')

    const corpusName = `Long Name Wrap Test ${Date.now()}`
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

    const longName = 'a-very-long-unbroken-token-file-name-with-no-spaces-whatsoever-anywhere-in-it.pdf'
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: longName,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 long name test'),
    })
    await expect(page.getByText(longName)).toBeVisible()

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })

  test('zoom in, pan, and zoom out/reset the PDF preview, in both normal and fullscreen layouts (026-pdf-preview-zoom-pan)', async ({
    page,
  }) => {
    const suffix = Date.now()
    // Wider than the Playwright default (1280x720): at the default width, DocumentList's
    // fixed-width table columns (Select/Size/Date/Status/Actions ≈ 464px) leave almost no room
    // for the DOCUMENT NAME column in the ~50%-width left pane, collapsing it to a couple of
    // pixels — a pre-existing, unrelated DocumentList responsive-layout issue (not reproducible
    // on a normal-width monitor) that would otherwise block clicking any row at all here.
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')

    // Self-contained: this spec predates 024-user-authentication's login gate at the
    // describe-block level (see the other tests in this file), so — like profile.spec.ts —
    // this test signs up its own user rather than assuming an already-authenticated session.
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`zoom-pan-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    const corpusName = `Zoom Pan Test ${suffix}`
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

    // A real, parseable single-page PDF (600x800pt) — large enough that a few zoom-in clicks
    // exceed the default viewport in both directions, giving pan something real to do.
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: 'zoom-pan-source.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf('Zoom and pan e2e fixture content, repeated for visible bulk.'),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    const docButton = page.getByRole('button', { name: 'zoom-pan-source.pdf', exact: true })
    await expect(docButton).toBeVisible()
    await docButton.click()
    await expect(page.locator('.react-pdf__Page').first()).toBeVisible()

    const zoomLevel = page.getByTestId('source-preview-zoom-level')
    const zoomIn = page.getByTestId('source-preview-zoom-in')
    const zoomOut = page.getByTestId('source-preview-zoom-out')
    const reset = page.getByTestId('source-preview-zoom-reset')
    const scrollArea = page.getByTestId('source-preview-scroll-area')
    const rightPane = page.getByTestId('sources-right-pane')

    // US1: zoom in enlarges the page and updates the indicator.
    await expect(zoomLevel).toHaveText('100%')
    const widthBeforeZoom = (await rightPane.boundingBox())?.width
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await expect(zoomLevel).toHaveText('200%')

    // 028-golden-dataset-split-view US2/FR-005/SC-002: zooming in must not change the preview
    // pane's own outer width — only the scrollable content inside it grows. Previously this pane
    // (and its sibling, the left pane) would widen because the flex chain down to the scroll area
    // lacked `min-width: 0`, so the browser refused to let it shrink below the zoomed page's
    // intrinsic content width (research.md §1).
    const widthAfterZoom = (await rightPane.boundingBox())?.width
    expect(widthAfterZoom).toBe(widthBeforeZoom)

    // react-pdf re-renders the canvas at the new scale asynchronously (a pdf.js render task,
    // not synchronous with the React state update the zoom buttons trigger), so wait for the
    // scroll container to actually overflow before driving the drag off of its dimensions.
    await expect(async () => {
      const overflowing = await scrollArea.evaluate(
        (el) => el.scrollWidth > el.clientWidth && el.scrollHeight > el.clientHeight,
      )
      expect(overflowing).toBe(true)
    }).toPass({ timeout: 5000 })
    const scrollBox = await scrollArea.boundingBox()
    if (!scrollBox) throw new Error('scroll area not visible')
    const centerX = scrollBox.x + scrollBox.width / 2
    const centerY = scrollBox.y + scrollBox.height / 2
    const beforeScroll = await scrollArea.evaluate((el) => ({
      left: el.scrollLeft,
      top: el.scrollTop,
    }))
    await page.mouse.move(centerX, centerY)
    await page.mouse.down()
    await page.mouse.move(centerX - 80, centerY - 80, { steps: 8 })
    await page.mouse.up()
    const afterScroll = await scrollArea.evaluate((el) => ({
      left: el.scrollLeft,
      top: el.scrollTop,
    }))
    expect(afterScroll.left).toBeGreaterThan(beforeScroll.left)
    expect(afterScroll.top).toBeGreaterThan(beforeScroll.top)

    // US3: zoom out then reset return to the default view.
    await zoomOut.click()
    await expect(zoomLevel).toHaveText('175%')
    await reset.click()
    await expect(zoomLevel).toHaveText('100%')

    // Zoom controls keep working the same way after switching into fullscreen, and the
    // fullscreen toggle itself does not reset the zoom level.
    await zoomIn.click()
    await expect(zoomLevel).toHaveText('125%')
    await page.getByTestId('source-preview-fullscreen-toggle').click()
    await expect(zoomLevel).toHaveText('125%')
    await zoomIn.click()
    await expect(zoomLevel).toHaveText('150%')
  })

  test('the page indicator shows current/total pages and tracks scroll position (029-pdf-preview-page-count)', async ({
    page,
  }) => {
    const suffix = Date.now()
    // Same DocumentList responsive-layout workaround as the zoom/pan test above.
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')

    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`page-indicator-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    const corpusName = `Page Indicator Test ${suffix}`
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

    // A real, parseable 5-page PDF — enough pages to scroll through and observe the page
    // indicator advance and retreat.
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: 'page-indicator-source.pdf',
      mimeType: 'application/pdf',
      buffer: makeMultiPagePdf(5),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    const docButton = page.getByRole('button', { name: 'page-indicator-source.pdf', exact: true })
    await expect(docButton).toBeVisible()
    await docButton.click()
    await expect(page.locator('.react-pdf__Page').first()).toBeVisible()

    const indicator = page.getByTestId('source-preview-page-indicator')
    await expect(indicator).toHaveText('Page 1 of 5')

    const scrollArea = page.getByTestId('source-preview-scroll-area')
    await page.locator('[data-preview-page="5"]').scrollIntoViewIfNeeded()
    await expect(indicator).toHaveText('Page 5 of 5', { timeout: 5000 })

    await scrollArea.evaluate((el) => {
      el.scrollTop = 0
    })
    await expect(indicator).toHaveText('Page 1 of 5', { timeout: 5000 })
  })

  test('the page indicator stays correct while zooming in and out (029-pdf-preview-page-count US2)', async ({
    page,
  }) => {
    const suffix = Date.now()
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/')

    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`page-indicator-zoom-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    const corpusName = `Page Indicator Zoom Test ${suffix}`
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
      name: 'page-indicator-zoom-source.pdf',
      mimeType: 'application/pdf',
      buffer: makeMultiPagePdf(5),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    const docButton = page.getByRole('button', { name: 'page-indicator-zoom-source.pdf', exact: true })
    await expect(docButton).toBeVisible()
    await docButton.click()
    await expect(page.locator('.react-pdf__Page').first()).toBeVisible()

    const indicator = page.getByTestId('source-preview-page-indicator')
    await page.locator('[data-preview-page="3"]').scrollIntoViewIfNeeded()
    await expect(indicator).toHaveText('Page 3 of 5', { timeout: 5000 })

    const zoomIn = page.getByTestId('source-preview-zoom-in')
    const zoomOut = page.getByTestId('source-preview-zoom-out')

    // US2: zooming in/out must not itself change which page the indicator reports.
    await zoomIn.click()
    await zoomIn.click()
    await expect(indicator).toHaveText('Page 3 of 5')

    await zoomOut.click()
    await zoomOut.click()
    await expect(indicator).toHaveText('Page 3 of 5')
  })
})
