import { test, expect } from '@playwright/test'
import { makePdf, makeMultiPagePdf } from './fixtures/makePdf'

test.describe('Golden Dataset', () => {
  test('manual creation, single LLM generation + approval, and batch generation (026-golden-dataset)', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const suffix = Date.now()

    // Wider than the Playwright default: at the default 1280x720, DocumentList's fixed-width
    // table columns leave almost no room for the DOCUMENT NAME column, collapsing it to a
    // couple of pixels — a pre-existing, unrelated responsive-layout issue (026-pdf-preview-
    // zoom-pan's own e2e work hit and documented this) that would otherwise block selecting
    // any document at all here.
    await page.setViewportSize({ width: 1600, height: 900 })

    // The real PUT/generate/draft-answer calls all hit Anthropic live — none of this e2e
    // environment's test runs have a real Anthropic key configured (see playground.spec.ts's
    // own comment to the same effect), so every Anthropic-touching call is stubbed here,
    // matching this suite's established route-interception convention.
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

    // Fake entries created via /generate live only in this test process (the real backend
    // never sees that call, since it would otherwise need a real Anthropic key) — the LIST
    // interceptor below augments the *real* backend's real list response with these, so the
    // manually-created entry (which really is persisted) and the fake generated ones both show
    // up together, consistently, exactly as a curator would experience it.
    interface FakeEntry {
      id: string
      corpusId: string | null
      documentId: string | null
      question: string
      preferredAnswer: string
      status: string
      source: string
      chunks: { id: string; chunkId: string; documentId: string | null; chunkIndex: number; content: string }[]
      createdAt: string
      updatedAt: string
      reviewedAt: string | null
    }
    const fakeEntries = new Map<string, FakeEntry>()
    let generatedCount = 0

    await page.route('**/api/golden-dataset/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const idMatch = url.pathname.match(/\/api\/golden-dataset\/entries\/([^/]+)$/)

      if (url.pathname.endsWith('/api/golden-dataset/generate') && method === 'POST') {
        generatedCount += 1
        const now = new Date().toISOString()
        // 030-golden-dataset-entry-detail US1: the entry list now filters by documentId, so
        // this fake response must actually honor the requested scope like the real backend
        // does — a hardcoded `documentId: null` here would make a document-scoped "Generate
        // with LLM" entry silently vanish from a document-scoped list.
        const body = request.postDataJSON() as { corpusId: string; documentId: string | null }
        const fake: FakeEntry = {
          id: `generated-${generatedCount}`,
          corpusId: body.corpusId,
          documentId: body.documentId,
          question: `Generated question ${generatedCount}?`,
          preferredAnswer: `Generated answer ${generatedCount}.`,
          status: 'pending_review',
          source: 'llm_generated',
          chunks: [
            {
              id: `gec-${generatedCount}`,
              chunkId: `chunk-${generatedCount}`,
              documentId: null,
              chunkIndex: 0,
              content: 'Stubbed evidence content.',
            },
          ],
          createdAt: now,
          updatedAt: now,
          reviewedAt: null,
        }
        fakeEntries.set(fake.id, fake)
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(fake) })
        return
      }

      if (idMatch !== null) {
        const fake = fakeEntries.get(idMatch[1])
        if (fake !== undefined) {
          if (method === 'GET') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) })
            return
          }
          if (method === 'PATCH') {
            const patch = request.postDataJSON() as { status?: string }
            if (patch.status !== undefined) {
              fake.status = patch.status
              fake.reviewedAt = new Date().toISOString()
            }
            fake.updatedAt = new Date().toISOString()
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fake) })
            return
          }
        }
        await route.continue()
        return
      }

      if (url.pathname.endsWith('/api/golden-dataset/entries') && method === 'GET') {
        const response = await route.fetch()
        const real = (await response.json()) as { entries: unknown[] }
        const extra = [...fakeEntries.values()].map(({ preferredAnswer: _preferredAnswer, chunks: _chunks, ...summary }) => summary)
        await route.fulfill({ response, json: { entries: [...real.entries, ...extra] } })
        return
      }

      // /candidates (US1's manual-creation search) and the plain POST /entries create call
      // both pass through to the real backend untouched — neither needs Anthropic.
      await route.continue()
    })

    await page.goto('/')

    // Self-contained signup (this spec, like 026-pdf-preview-zoom-pan's own e2e work,
    // doesn't assume an already-authenticated session).
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`golden-dataset-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    // Golden Dataset is gated behind a personal Anthropic key, same as Playground/Metrics.
    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Golden Dataset E2E ${suffix}`
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
      name: 'golden-dataset-source.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf(
        'Either party may terminate this agreement with thirty days written notice delivered by mail.',
      ),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'golden-dataset-source.pdf' })
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
    await expect(page.getByRole('heading', { name: 'Golden Dataset', exact: true })).toBeVisible()

    // US1: manual creation.
    await page.getByRole('button', { name: 'Write Manually' }).click()
    await page.getByRole('textbox', { name: /^question$/i }).fill('What is the notice period?')
    await page.getByRole('textbox', { name: /preferred answer/i }).fill('Thirty days written notice.')
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 10000 })
    await page.getByRole('checkbox').first().check()
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('What is the notice period?')).toBeVisible()
    await expect(page.getByText('Approved').first()).toBeVisible()

    // US2: single LLM generation + review + approve.
    await page.getByRole('button', { name: 'Generate with LLM' }).click()
    // Shows up twice — the "Pending Review" section and the full entry list both render it.
    await expect(page.getByText('Generated question 1?').first()).toBeVisible()
    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page.getByRole('textbox', { name: /^question$/i })).toHaveValue('Generated question 1?')
    await expect(page.getByRole('textbox', { name: /preferred answer/i })).toHaveValue('Generated answer 1.')
    await page.getByRole('button', { name: /^approve$/i }).click()
    // Wait for the refetch to land first — the now-approved entry drops out of "Pending
    // Review" entirely (both the section and its editor unmount), leaving a single,
    // unambiguous match in the full entry list below.
    await expect(page.getByText('Pending Review')).toHaveCount(0)
    await expect(page.getByText('Generated question 1?')).toBeVisible()

    // US3: batch generation.
    await page.getByLabel('Batch size').fill('2')
    await page.getByRole('button', { name: 'Generate a Batch…' }).click()
    await expect(page.getByText(/entries generated successfully/i)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/pending review \(2\)/i)).toBeVisible()
  })

  test('splits the screen into a left pane and a right-side PDF preview whose width stays fixed while zooming (028-golden-dataset-split-view)', async ({
    page,
  }) => {
    const suffix = Date.now()

    // Same DocumentList responsive-layout workaround as the other e2e specs in this suite
    // (see the comment on the test above).
    await page.setViewportSize({ width: 1600, height: 900 })

    // Saving a key normally live-validates it against Anthropic (profile/service.py's
    // validate_key) — this e2e environment has no real Anthropic key, so, like the test above,
    // stub the save/status endpoint rather than hitting Anthropic with a fake key.
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

    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`golden-dataset-split-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    // Golden Dataset is gated behind a personal Anthropic key, same as Playground/Metrics —
    // no LLM calls are made in this test, but the nav entry itself requires a key on file.
    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Golden Dataset Split View E2E ${suffix}`
    const main = page.locator('main')
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // A real, parseable single-page PDF (600x800pt) — large enough that a few zoom-in clicks
    // exceed the pane's width, matching the equivalent Sources-screen zoom/pan e2e fixture.
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: 'golden-dataset-split-view-source.pdf',
      mimeType: 'application/pdf',
      buffer: makePdf('Split view zoom-width e2e fixture content, repeated for visible bulk.'),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'GOLDEN DATASET', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Golden Dataset', exact: true })).toBeVisible()

    // FR-001/US1: the screen is split into a left pane and a right pane, and the right pane
    // previews the document the scope dropdown defaults to (the corpus's only document).
    const leftPane = page.getByTestId('golden-dataset-left-pane')
    const rightPane = page.getByTestId('golden-dataset-right-pane')
    await expect(leftPane).toBeVisible()
    await expect(page.locator('.react-pdf__Page').first()).toBeVisible()

    const zoomLevel = page.getByTestId('source-preview-zoom-level')
    const zoomIn = page.getByTestId('source-preview-zoom-in')
    await expect(zoomLevel).toHaveText('100%')
    const leftWidthBefore = (await leftPane.boundingBox())?.width
    const rightWidthBefore = (await rightPane.boundingBox())?.width

    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await zoomIn.click()
    await expect(zoomLevel).toHaveText('200%')

    // FR-005/FR-006/SC-002: zooming the right-half preview to a high level must not change
    // either pane's outer width — this is the same fixed-width fix as the Sources screen
    // (research.md §1), applied here to the Golden Dataset screen's own panes.
    const leftWidthAfter = (await leftPane.boundingBox())?.width
    const rightWidthAfter = (await rightPane.boundingBox())?.width
    expect(rightWidthAfter).toBe(rightWidthBefore)
    expect(leftWidthAfter).toBe(leftWidthBefore)
  })

  test('the split-view preview shows a page indicator that tracks scroll position (029-pdf-preview-page-count)', async ({
    page,
  }) => {
    const suffix = Date.now()

    // Same DocumentList responsive-layout workaround as the other e2e specs in this suite.
    await page.setViewportSize({ width: 1600, height: 900 })

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

    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`golden-dataset-page-indicator-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Golden Dataset Page Indicator E2E ${suffix}`
    const main = page.locator('main')
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // A real, parseable 5-page PDF — enough pages to scroll through in the split-view preview.
    await page.getByRole('link', { name: 'SOURCES', exact: true }).click()
    await page.setInputFiles('[data-testid="upload-browse-input"]', {
      name: 'golden-dataset-page-indicator-source.pdf',
      mimeType: 'application/pdf',
      buffer: makeMultiPagePdf(5),
    })
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('link', { name: 'GOLDEN DATASET', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Golden Dataset', exact: true })).toBeVisible()
    await expect(page.locator('.react-pdf__Page').first()).toBeVisible()

    // FR-002: the shared preview's page indicator shows up here too, tracking scroll position
    // the same way it does on the Data Sources screen.
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

  test('the entry list respects the scope dropdown instead of always showing every entry (030-golden-dataset-entry-detail US1)', async ({
    page,
  }) => {
    const suffix = Date.now()

    await page.setViewportSize({ width: 1600, height: 900 })

    // Golden Dataset is gated behind a personal Anthropic key (025-user-profile-anthropic-key)
    // even though this test's own manual-creation path never calls Anthropic — stub the
    // save/status endpoint the same way the other tests in this suite do, since this e2e
    // environment has no real key configured.
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

    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`golden-dataset-scope-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Golden Dataset Scope E2E ${suffix}`
    const main = page.locator('main')
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Real corpus, real documents list, but a stubbed golden-dataset entries response — this
    // test is about the screen's own scope-filtering logic (US1), not a re-verification of
    // the full chunk/embed/manual-create pipeline the first test in this file already covers.
    await page.route('**/api/sources*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          documents: [
            { id: 'doc-a', name: 'scope-doc-a.pdf', sizeBytes: 100, uploadedAt: '2026-08-05T00:00:00Z', status: 'processed' },
            { id: 'doc-b', name: 'scope-doc-b.pdf', sizeBytes: 100, uploadedAt: '2026-08-05T00:05:00Z', status: 'processed' },
          ],
          rejections: [],
        }),
      })
    })
    await page.route('**/api/golden-dataset/entries*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [
            {
              id: 'entry-a',
              corpusId: 'ignored',
              documentId: 'doc-a',
              question: 'What is the deadline?',
              status: 'approved',
              source: 'manual',
              createdAt: '2026-08-05T00:10:00Z',
            },
            {
              id: 'entry-b',
              corpusId: 'ignored',
              documentId: 'doc-b',
              question: 'What is the fee?',
              status: 'approved',
              source: 'manual',
              createdAt: '2026-08-05T00:15:00Z',
            },
          ],
        }),
      })
    })

    await page.getByRole('link', { name: 'GOLDEN DATASET', exact: true }).click()
    // exact:true (032-deep-linking): this test's own corpus name ("Golden Dataset Scope E2E
    // ...") produces a "Documents in Golden Dataset Scope E2E ..." heading on the Corpora
    // screen whose accessible name contains "Golden Dataset" as a substring — a non-exact
    // match could resolve against that leftover heading while the real navigation (now an
    // async client-side route change, previously a synchronous state swap) is still in
    // flight, letting this assertion pass before the screen has actually changed.
    await expect(page.getByRole('heading', { name: 'Golden Dataset', exact: true })).toBeVisible()

    // US1 FR-002: "Entire Corpus" shows every entry across both documents.
    await page.getByLabel(/scope/i).selectOption('Entire Corpus')
    await expect(page.getByText('What is the deadline?')).toBeVisible()
    await expect(page.getByText('What is the fee?')).toBeVisible()

    // US1 FR-003: selecting one document shows only that document's entry.
    await page.getByLabel(/scope/i).selectOption({ label: 'scope-doc-a.pdf' })
    await expect(page.getByText('What is the deadline?')).toBeVisible()
    await expect(page.getByText('What is the fee?')).toHaveCount(0)

    await page.getByLabel(/scope/i).selectOption({ label: 'scope-doc-b.pdf' })
    await expect(page.getByText('What is the fee?')).toBeVisible()
    await expect(page.getByText('What is the deadline?')).toHaveCount(0)
  })

  test('clicking an approved entry shows its answer read-only; other entries and delete are unaffected (030-golden-dataset-entry-detail US2)', async ({
    page,
  }) => {
    const suffix = Date.now()

    await page.setViewportSize({ width: 1600, height: 900 })

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

    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`golden-dataset-detail-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Golden Dataset Detail E2E ${suffix}`
    const main = page.locator('main')
    await page.getByRole('link', { name: 'CORPORA', exact: true }).click()
    await main.getByRole('button', { name: /new corpus/i }).click()
    await main.getByLabel(/new corpus name/i).fill(corpusName)
    await main.getByRole('button', { name: /^create$/i }).click()
    await expect(main.getByTestId(/corpus-row-/).filter({ hasText: corpusName })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // This test is about the read-only detail view (US2), not a re-verification of the
    // creation pipeline — stub the entries list/detail/delete endpoints directly, the same
    // lightweight approach as the scope-filtering test above.
    let deleted = false
    await page.route('**/api/golden-dataset/**', async (route) => {
      const method = route.request().method()
      const url = route.request().url()
      if (method === 'GET' && /\/entries\/approved-1$/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'approved-1',
            corpusId: 'ignored',
            documentId: null,
            question: 'What is the notice period?',
            preferredAnswer: 'Thirty days written notice.',
            status: 'approved',
            source: 'manual',
            chunks: [
              {
                id: 'gec-1',
                chunkId: 'chunk-1',
                documentId: null,
                chunkIndex: 0,
                content: 'Either party may terminate this agreement with thirty days written notice.',
              },
            ],
            createdAt: '2026-08-05T00:00:00Z',
            updatedAt: '2026-08-05T00:00:00Z',
            reviewedAt: '2026-08-05T00:01:00Z',
          }),
        })
        return
      }
      if (method === 'DELETE') {
        deleted = true
        await route.fulfill({ status: 204 })
        return
      }
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            entries: deleted
              ? [
                  {
                    id: 'pending-1',
                    corpusId: 'ignored',
                    documentId: null,
                    question: 'A pending question needing review?',
                    status: 'pending_review',
                    source: 'llm_generated',
                    createdAt: '2026-08-05T00:02:00Z',
                  },
                ]
              : [
                  {
                    id: 'approved-1',
                    corpusId: 'ignored',
                    documentId: null,
                    question: 'What is the notice period?',
                    status: 'approved',
                    source: 'manual',
                    createdAt: '2026-08-05T00:00:00Z',
                  },
                  {
                    id: 'pending-1',
                    corpusId: 'ignored',
                    documentId: null,
                    question: 'A pending question needing review?',
                    status: 'pending_review',
                    source: 'llm_generated',
                    createdAt: '2026-08-05T00:02:00Z',
                  },
                ],
          }),
        })
        return
      }
      await route.continue()
    })

    await page.getByRole('link', { name: 'GOLDEN DATASET', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Golden Dataset', exact: true })).toBeVisible()
    await page.getByLabel(/scope/i).selectOption('Entire Corpus')

    // FR-005/FR-006: clicking an approved entry's question shows its full answer, read-only.
    await expect(page.getByText('What is the notice period?')).toBeVisible()
    await page.getByRole('button', { name: 'What is the notice period?', exact: true }).click()
    await expect(page.getByText('Thirty days written notice.', { exact: true })).toBeVisible()
    const approvedRow = page.getByTestId('golden-entry-approved-1')
    await expect(approvedRow.locator('input, textarea')).toHaveCount(0)
    await expect(approvedRow.getByRole('button', { name: /^save$/i })).toHaveCount(0)

    // Evidence chunk list: shows the chunk's name and, on "Show more", its full content.
    await expect(page.getByText('CHUNK_0')).toBeVisible()
    const chunkText = page.getByText(
      'Either party may terminate this agreement with thirty days written notice.',
    )
    await expect(chunkText).toHaveClass(/line-clamp-2/)
    await page.getByRole('button', { name: /^show more$/i }).click()
    await expect(chunkText).not.toHaveClass(/line-clamp-2/)
    await page.getByRole('button', { name: /^show less$/i }).click()
    await expect(chunkText).toHaveClass(/line-clamp-2/)

    // FR-007: clicking a pending-review entry's question opens nothing new.
    await page.getByRole('button', { name: 'A pending question needing review?', exact: true }).click()
    await expect(page.getByLabel(/^question$/i)).toHaveCount(0)

    // FR-009: deleting the expanded entry removes both it and its answer view together.
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete What is the notice period?' }).click()
    await expect(page.getByText('What is the notice period?')).toHaveCount(0)
    await expect(page.getByText('Thirty days written notice.')).toHaveCount(0)
  })
})
