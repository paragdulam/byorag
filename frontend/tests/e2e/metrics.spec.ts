import { test, expect } from '@playwright/test'
import { makeWordsPdf } from './fixtures/makePdf'

// Covers 019-metrics-dashboard quickstart.md Scenarios 1 and 4, plus 020-metrics-stage-groups
// quickstart.md Scenarios 1-2, end-to-end through the real UI. The pipeline-list/comparison
// scenarios (019 Scenario 2/3, 020 Scenario 3) require a second registered chunking technique
// to exist — only "fixed-size" is registered in this product today (research.md/data-model.md),
// so those aren't reachable through a real user journey yet; their behavior is covered at the
// component level instead (ComparisonModal.test.tsx, tests/integration/MetricsScreen.test.tsx,
// all using constructed multi-pipeline fixtures).
test.describe('Metrics Dashboard (019-metrics-dashboard, 020-metrics-stage-groups)', () => {
  test('view pipeline scores for a corpus, then see the scope breakdown update after an entire-corpus question', async ({
    page,
  }) => {
    test.setTimeout(150_000)
    const suffix = Date.now()

    // Wider than the Playwright default (1280x720): at the default width, DocumentList's
    // fixed-width table columns leave almost no room for the DOCUMENT NAME column, collapsing
    // it to a couple of pixels — a pre-existing, unrelated DocumentList responsive-layout
    // issue (documented by other specs, e.g. data-sources-screen.spec.ts's zoom-pan test).
    await page.setViewportSize({ width: 1600, height: 900 })

    // Playground and Metrics are both gated behind a personal Anthropic key
    // (025-user-profile-anthropic-key). Saving a key normally live-validates it against
    // Anthropic (profile/service.py's validate_key) — this e2e environment has no real
    // Anthropic key, so, matching golden-dataset.spec.ts's established convention, the
    // save/status endpoint is stubbed rather than hitting Anthropic with a fake key.
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

    // Self-contained: this spec predates 024-user-authentication's login gate, so it signs up
    // its own user rather than assuming an already-authenticated session (matches the pattern
    // established by data-sources-screen.spec.ts's zoom-pan test and others in this suite).
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`metrics-e2e-${suffix}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()

    await page.getByLabel('Profile').click()
    await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText('...wxyz')).toBeVisible()

    const corpusName = `Metrics E2E Fixture Corpus ${suffix}`
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

    // Two documents with distinct content (avoids content-hash dedup — research.md §3) so an
    // "Entire Corpus" question genuinely has more than one document to draw from.
    const docNames = [`metrics-e2e-${suffix}-a.pdf`, `metrics-e2e-${suffix}-b.pdf`]
    for (const [i, name] of docNames.entries()) {
      await page.setInputFiles('[data-testid="upload-browse-input"]', {
        name,
        mimeType: 'application/pdf',
        buffer: makeWordsPdf(15, `metricse2e${suffix}word${i}`),
      })
      await expect(page.getByText(name)).toBeVisible()
    }

    for (const name of docNames) {
      await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
      await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
      await page.getByLabel('Select document').selectOption({ label: name })
      await page.getByLabel('Chunk size').fill('5')
      await page.getByLabel(/^overlap$/i).fill('0')
      await page.getByRole('button', { name: 'Re-Calculate Chunks' }).click()
      await expect(page.getByRole('progressbar')).toHaveCount(0)
      await page.getByRole('button', { name: 'Save Chunks' }).click()
      await expect(page.getByTestId('save-status-indicator')).toHaveText(/^saved$/i)

      await page.getByRole('link', { name: 'EMBEDDINGS', exact: true }).click()
      await page.getByLabel('Select document').selectOption({ label: name })
      await expect(page.getByText('CHUNK_0')).toBeVisible()
      await page.getByRole('button', { name: 'Generate Embeddings' }).click()
      await expect(page.getByText(/embeddings generated/i)).toBeVisible({ timeout: 30_000 })
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 30_000 })
    }

    // US1 setup — Metrics screen should already show the technique/embedding model/zero
    // counts before any question is asked (spec Scenario 1, FR-013 empty-scores state).
    // 031-playground-metrics-redesign FR-009: no in-screen corpus picker — the corpus created
    // above is already the active corpus app-wide, so Metrics reflects it immediately.
    await page.getByRole('link', { name: 'METRICS', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Metrics' })).toBeVisible()
    await expect(page.getByTestId('metrics-corpus-list')).toHaveCount(0)
    await expect(page.getByTestId('metrics-technique')).toHaveText('fixed-size')
    await expect(page.getByTestId('metrics-embedding-model')).toHaveText('bert')
    await expect(page.getByTestId('metrics-question-count')).toHaveText('0')
    await expect(page.getByTestId('metrics-no-scores')).toBeVisible()

    // 020-metrics-stage-groups US1/US2 — the pipeline detail view is grouped into "Retrieval"
    // and "Generation" sections, and the retrieval strategy is visible even before any
    // question has been asked (spec FR-001–FR-005).
    const retrievalSection = page.getByTestId('metrics-retrieval-section')
    const generationSection = page.getByTestId('metrics-generation-section')
    await expect(retrievalSection.getByRole('heading', { name: 'Retrieval' })).toBeVisible()
    await expect(generationSection.getByRole('heading', { name: 'Generation' })).toBeVisible()
    await expect(page.getByTestId('metrics-retrieval-strategy')).toHaveText('cosine-similarity')
    await expect(page.getByTestId('metrics-generation-llm')).toHaveText('Not available yet')
    await expect(page.getByTestId('metrics-judge-llm')).toHaveText('Not available yet')

    // US4 — ask one individual-document question and one entire-corpus question. Retrieval and
    // answer generation both happen automatically as soon as each is sent
    // (031-playground-metrics-redesign FR-005 — no manual Generate step). This environment may
    // not have a configured LLM provider key, so either a real answer or a clear error is an
    // equally valid terminal state (matching playground.spec.ts's existing precedent) — what
    // matters here is that both questions are persisted and counted regardless of whether
    // generation itself succeeds.
    await page.getByRole('link', { name: 'PLAYGROUND', exact: true }).click()
    const questionBox = page.getByRole('textbox', { name: 'Question' })
    const sendButton = page.getByRole('button', { name: 'Send' })
    const terminalState = page.getByRole('alert').or(page.locator('[data-testid$="-answer"]')).last()

    await page.getByLabel('Select document').selectOption({ label: docNames[0] })
    await questionBox.fill(`What is this document about? (${suffix})`)
    await sendButton.click()
    await expect(terminalState).toBeVisible({ timeout: 30_000 })

    await page.getByLabel('Select document').selectOption({ label: 'Entire Corpus' })
    await questionBox.fill(`What is the whole corpus about? (${suffix})`)
    await sendButton.click()
    await expect(terminalState).toBeVisible({ timeout: 30_000 })
    const secondQuestionAnswered = await page.locator('[data-testid$="-answer"]').last().isVisible()

    // Back on Metrics: both questions are counted, split correctly by scope (spec FR-006). No
    // corpus picker to click — still the same active corpus (FR-009).
    await page.getByRole('link', { name: 'METRICS', exact: true }).click()
    await expect(page.getByTestId('metrics-question-count')).toHaveText('2')
    await expect(page.getByTestId('metrics-scope-breakdown')).toContainText('1 entire corpus')
    await expect(page.getByTestId('metrics-scope-breakdown')).toContainText('1 individual document')

    // 020-metrics-stage-groups US2 — once an answer has actually been generated and scored,
    // the generation/judge LLM names replace their "Not available yet" placeholders.
    if (secondQuestionAnswered) {
      await expect(page.getByTestId('metrics-generation-llm')).not.toHaveText('Not available yet')
      await expect(page.getByTestId('metrics-judge-llm')).not.toHaveText('Not available yet', {
        timeout: 15_000,
      })
    }
  })
})
