import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

// A turn reaches a terminal state once it either has an answer or a failure+retry alert
// (031-playground-metrics-redesign FR-005/FR-008) — asking is now the only manual step, so
// every test that used to wait for a "Generate" button to become enabled now waits for this
// instead, matching whichever real outcome an unconfigured/real Anthropic call produces.
function terminalState(page: Page) {
  return page.getByRole('alert').or(page.locator('[data-testid$="-answer"]')).last()
}

// Playground is gated behind a personal Anthropic key (025-user-profile-anthropic-key).
// Saving a key normally live-validates it against Anthropic (profile/service.py's
// validate_key) — this e2e environment has no real Anthropic key, so, matching
// golden-dataset.spec.ts's/metrics.spec.ts's established convention, the save/status endpoint
// is stubbed rather than hitting Anthropic with a fake key.
async function stubAnthropicKey(page: Page) {
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
}

async function saveAnthropicKey(page: Page) {
  await page.getByLabel('Profile').click()
  await page.getByLabel(/anthropic api key/i).fill('sk-ant-testwxyz')
  await page.getByRole('button', { name: /^save$/i }).click()
  await expect(page.getByText('...wxyz')).toBeVisible()
}

test.describe('Playground Sequential Flow', () => {
  // Both tests below upload the same playground-sample.pdf fixture, which this app dedupes
  // to a single Document row by content hash across corpora (002-persist-pdf-sources) — run
  // serially so their chunk/embedding saves against that shared Document never race.
  test.describe.configure({ mode: 'serial' })

  test('save chunks -> generate+save embeddings -> ask a question -> answer generates automatically, reaching a terminal state', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    // The Document these tests upload is deduped by content hash and conversation turns
    // persist indefinitely (spec FR-016) — across separate corpora *and* across separate
    // runs against the same dev database, so question text must be unique per run to avoid
    // matching leftover turns from earlier runs.
    const runId = Date.now()

    // Wider than the Playwright default (1280x720): at the default width, DocumentList's
    // fixed-width table columns leave almost no room for the DOCUMENT NAME column, collapsing
    // it to a couple of pixels — a pre-existing, unrelated DocumentList responsive-layout
    // issue (documented by other specs, e.g. data-sources-screen.spec.ts's zoom-pan test).
    await page.setViewportSize({ width: 1600, height: 900 })
    await stubAnthropicKey(page)

    // Self-contained: this spec predates 024-user-authentication's login gate, so it signs up
    // its own user rather than assuming an already-authenticated session (matches the pattern
    // established by data-sources-screen.spec.ts's zoom-pan test and others in this suite).
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`playground-e2e-${runId}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
    await saveAnthropicKey(page)

    const corpusName = `Playground E2E Fixture Corpus ${runId}`
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

    // A dedicated fixture with content distinct from chunking-sample.pdf — that file is
    // shared by embeddings.spec.ts and fixed-size-chunking.spec.ts, and this app dedupes
    // uploads by content hash across corpora (002-persist-pdf-sources), so reusing it here
    // would make this test's saves land on the exact same Chunk rows as those specs when
    // run concurrently, corrupting their embedding-count assertions.
    const playgroundPdf = path.join(FIXTURES_DIR, 'playground-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', playgroundPdf)
    await expect(page.getByText('playground-sample.pdf').first()).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'playground-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
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
    await expect(page.getByRole('button', { name: 'Move to Vector View' })).toBeEnabled()

    await page.getByRole('button', { name: 'Move to Vector View' }).click()
    await page.getByRole('link', { name: 'PLAYGROUND', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    // Context is visible without any interaction.
    const context = page.getByTestId('playground-context')
    await expect(context).toContainText('fixed-size')
    await expect(context).toContainText('bert')

    // No "Generate" button exists anywhere (FR-005).
    await expect(page.getByRole('button', { name: /^generate$/i })).toHaveCount(0)

    // US1: submit a question — retrieval and answer generation both happen automatically,
    // with no manual step in between.
    const question = `What is this document about? (${runId})`
    await page.getByRole('textbox', { name: 'Question' }).fill(question)
    await page.getByRole('button', { name: 'Send' }).click()

    // The question is now part of the sequential flow.
    await expect(page.getByText(question)).toBeVisible()

    // Reaches a terminal state automatically: either an answer block appears, or a clear
    // error + retry control appears (this environment may not have a configured LLM
    // provider key, so the failure path is an equally valid, deterministic outcome to assert
    // on — either way, no request hangs and no fabricated answer is silently shown).
    await expect(terminalState(page)).toBeVisible({ timeout: 30_000 })

    // FR-011: an empty question performs no new send — Send stays disabled.
    await page.getByRole('textbox', { name: 'Question' }).fill('')
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  test('US3: the conversation persists automatically and reloads after a page refresh', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const runId = Date.now()

    // Same DocumentList responsive-layout workaround as the test above.
    await page.setViewportSize({ width: 1600, height: 900 })
    await stubAnthropicKey(page)

    // Self-contained: see the signup comment on the test above.
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`playground-reload-e2e-${runId}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
    await saveAnthropicKey(page)

    const corpusName = `Playground Reload E2E Fixture Corpus ${runId}`
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

    const playgroundPdf = path.join(FIXTURES_DIR, 'playground-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', playgroundPdf)
    await expect(page.getByText('playground-sample.pdf').first()).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'playground-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
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
    await expect(page.getByRole('button', { name: 'Move to Vector View' })).toBeEnabled()

    await page.getByRole('button', { name: 'Move to Vector View' }).click()
    await page.getByRole('link', { name: 'PLAYGROUND', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    // Ask two questions; every submitted question is persisted as it happens (spec FR-016).
    // Send stays disabled while a turn is in flight, so wait for each to reach a terminal
    // state before asking the next.
    const firstQuestion = `First persisted question? (${runId})`
    const secondQuestion = `Second persisted question? (${runId})`
    await page.getByRole('textbox', { name: 'Question' }).fill(firstQuestion)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(firstQuestion)).toBeVisible()
    await expect(terminalState(page)).toBeVisible({ timeout: 30_000 })

    await page.getByRole('textbox', { name: 'Question' }).fill(secondQuestion)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(secondQuestion)).toBeVisible()
    await expect(terminalState(page)).toBeVisible({ timeout: 30_000 })

    // Reloading resets this SPA's in-memory screen navigation back to its default screen
    // (navigation isn't URL-routed), so re-navigate to Playground afterward — the point
    // being tested is that the *conversation* automatically restores (spec FR-017) without
    // needing to be re-typed, not that the client-side route survives a hard refresh.
    await page.reload()
    await page.getByRole('link', { name: 'PLAYGROUND', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()
    await expect(page.getByText(firstQuestion)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(secondQuestion)).toBeVisible()
  })

  test('a Markdown-formatted answer renders with real formatting, not literal syntax (018-ui-polish-batch US6)', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const runId = Date.now()

    // Same DocumentList responsive-layout workaround as the first test in this file.
    await page.setViewportSize({ width: 1600, height: 900 })
    await stubAnthropicKey(page)

    // Stub answer generation to deterministically return a Markdown-formatted answer — this
    // environment has no configured LLM provider key, so a real generation call always fails.
    // Since generation is now automatic (fires right after the turn is created), capture the
    // real turn id from the create-turn response so the test can locate its answer block.
    let capturedTurnId: string | null = null
    const turnsById = new Map<string, Record<string, unknown>>()
    await page.route('**/api/playground/turns', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = (await response.json()) as { id: string }
      turnsById.set(body.id, body)
      capturedTurnId = body.id
      await route.fulfill({ response, json: body })
    })
    await page.route('**/api/playground/turns/*/generate', async (route) => {
      const turnId = new URL(route.request().url()).pathname.split('/').slice(-2, -1)[0]
      const original = turnsById.get(turnId)
      const answered = {
        ...original,
        llmProvider: 'test-provider',
        llmModel: 'test-model',
        prompt: 'test prompt',
        answer: 'Here is a summary:\n\n- **Key** point one\n- Key point two',
        error: null,
        answeredAt: new Date().toISOString(),
      }
      turnsById.set(turnId, answered)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answered) })
    })

    // Self-contained: see the signup comment on the first test in this file.
    await page.goto('/')
    await page.getByRole('button', { name: /sign up/i }).click()
    await page.getByLabel('Email').fill(`playground-markdown-e2e-${runId}@example.com`)
    await page.getByLabel('Password').fill('hunter22')
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('heading', { name: 'Data Sources' })).toBeVisible()
    await saveAnthropicKey(page)

    const corpusName = `Playground Markdown E2E Fixture Corpus ${runId}`
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

    const playgroundPdf = path.join(FIXTURES_DIR, 'playground-sample.pdf')
    await page.setInputFiles('[data-testid="upload-browse-input"]', playgroundPdf)
    await expect(page.getByText('playground-sample.pdf').first()).toBeVisible()
    await expect(page.getByText('PROCESSED').first()).toBeVisible({ timeout: 3000 })

    await page.getByRole('link', { name: 'CHUNKING', exact: true }).click()
    await page.getByRole('link', { name: 'FIXED SIZE CHUNKING', exact: true }).click()
    await page.getByLabel('Select document').selectOption({ label: 'playground-sample.pdf' })
    await page.getByLabel('Chunk size').fill('10')
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
    await expect(page.getByRole('button', { name: 'Move to Vector View' })).toBeEnabled()

    await page.getByRole('button', { name: 'Move to Vector View' }).click()
    await page.getByRole('link', { name: 'PLAYGROUND', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    const question = `Markdown question? (${runId})`
    await page.getByRole('textbox', { name: 'Question' }).fill(question)
    await page.getByRole('button', { name: 'Send' }).click()

    await expect.poll(() => capturedTurnId, { timeout: 15_000 }).not.toBeNull()
    const answerBlock = page.getByTestId(`turn-${capturedTurnId}-answer`)
    await expect(answerBlock).toBeVisible({ timeout: 15_000 })
    await expect(answerBlock.locator('li')).toHaveCount(2)
    await expect(answerBlock.locator('strong', { hasText: 'Key' }).first()).toBeVisible()
    await expect(answerBlock).not.toContainText('**Key**')
  })
})
