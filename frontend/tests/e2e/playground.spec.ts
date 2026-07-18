import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.join(__dirname, 'fixtures')

test.describe('Playground Split-Screen Chat Interface', () => {
  // Both tests below upload the same playground-sample.pdf fixture, which this app dedupes
  // to a single Document row by content hash across corpora (002-persist-pdf-sources) — run
  // serially so their chunk/embedding saves against that shared Document never race.
  test.describe.configure({ mode: 'serial' })

  test('save chunks -> generate+save embeddings -> ask a question -> retrieve chunks -> Generate reaches a terminal state', async ({
    page,
  }) => {
    test.setTimeout(90_000)

    // The Document these tests upload is deduped by content hash and conversation turns
    // persist indefinitely (spec FR-016) — across separate corpora *and* across separate
    // runs against the same dev database, so question text must be unique per run to avoid
    // matching leftover turns from earlier runs.
    const runId = Date.now()

    await page.goto('/')

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
    await page.getByRole('button', { name: 'Move to Playground' }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    // Context is visible without any interaction.
    const context = page.getByTestId('playground-context')
    await expect(context).toContainText('fixed-size')
    await expect(context).toContainText('bert')

    // US1: submit a question and see it retrieved (right panel's Generate control becomes
    // available once chunks are retrieved and persisted as a new conversation turn).
    const question = `What is this document about? (${runId})`
    await page.getByRole('textbox', { name: 'Question' }).fill(question)
    await page.getByRole('button', { name: 'Send' }).click()
    const generateButton = page.getByRole('button', { name: 'Generate' })
    await expect(generateButton).toBeEnabled({ timeout: 15_000 })

    // The question is now part of the conversation in the left panel.
    await expect(page.getByText(question)).toBeVisible()

    // Clicking Generate reaches a terminal state: either an answer bubble appears, or a
    // clear error + retry control appears (this environment may not have a configured LLM
    // provider key, so the failure path is an equally valid, deterministic outcome to assert
    // on — either way, no request hangs and no fabricated answer is silently shown). This
    // document's conversation persists across runs (spec FR-016), so scope to the newest
    // turn (appended last) rather than assuming there's only one match on screen.
    await generateButton.click()
    await expect(
      page.getByRole('alert').or(page.getByRole('button', { name: /^Answer to/ })).last(),
    ).toBeVisible({ timeout: 30_000 })

    // FR-011: an empty question performs no new send — Send stays disabled.
    await page.getByRole('textbox', { name: 'Question' }).fill('')
    await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  })

  test('US2: revisiting an earlier turn shows its own retrieved chunks in the right panel', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const runId = Date.now()

    // This environment has no configured LLM provider key, so Generate always fails —
    // stub it here to deterministically exercise the "click a past answer to revisit its
    // turn" flow (FR-018), which otherwise has nothing to click. Captures each turn's real
    // create-turn response first (so the stub can echo its actual chunks/question back),
    // then answers it on generate.
    const turnsById = new Map<string, Record<string, unknown>>()
    await page.route('**/api/playground/turns', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = (await response.json()) as { id: string }
      turnsById.set(body.id, body)
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
        answer: `Answer to: ${original?.question}`,
        error: null,
        answeredAt: new Date().toISOString(),
      }
      turnsById.set(turnId, answered)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answered) })
    })

    await page.goto('/')

    const corpusName = `Playground Revisit E2E Fixture Corpus ${runId}`
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
    await page.getByRole('button', { name: 'Move to Playground' }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    // Ask two questions and generate an answer for each.
    const generateButton = page.getByRole('button', { name: 'Generate' })
    const firstQuestion = `What is the first question about? (${runId})`
    const secondQuestion = `What is the second question about? (${runId})`

    await page.getByRole('textbox', { name: 'Question' }).fill(firstQuestion)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(generateButton).toBeEnabled({ timeout: 15_000 })
    await generateButton.click()
    await expect(page.getByRole('button', { name: `Answer to ${firstQuestion}` })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('textbox', { name: 'Question' }).fill(secondQuestion)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(generateButton).toBeEnabled({ timeout: 15_000 })
    await generateButton.click()
    await expect(page.getByRole('button', { name: `Answer to ${secondQuestion}` })).toBeVisible({
      timeout: 15_000,
    })

    // Defaults to showing the newest turn's retrieved chunks (exact selection-swap
    // behavior with genuinely distinct chunk sets is covered deterministically at the unit
    // level — PlaygroundScreen.test.tsx's US2 "selected turn" tests — since both questions
    // here share the same document and so retrieve the same two saved chunks).
    await expect(page.getByTestId('playground-chunk-list')).toBeVisible()

    // Clicking the older answer re-selects that turn without breaking the panel.
    await page.getByRole('button', { name: `Answer to ${firstQuestion}` }).click()
    await expect(page.getByTestId('playground-chunk-list')).toBeVisible()
  })

  test('US3: the conversation persists automatically and reloads after a page refresh', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const runId = Date.now()

    await page.goto('/')

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
    await page.getByRole('button', { name: 'Move to Playground' }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    // Ask two questions; every submitted question is persisted as it happens (spec FR-016),
    // independent of whether Generate is ever clicked.
    const generateButton = page.getByRole('button', { name: 'Generate' })
    const firstQuestion = `First persisted question? (${runId})`
    const secondQuestion = `Second persisted question? (${runId})`
    await page.getByRole('textbox', { name: 'Question' }).fill(firstQuestion)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(generateButton).toBeEnabled({ timeout: 15_000 })

    await page.getByRole('textbox', { name: 'Question' }).fill(secondQuestion)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(generateButton).toBeEnabled({ timeout: 15_000 })
    await expect(page.getByText(secondQuestion)).toBeVisible()

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

    // Stub Generate to deterministically return a Markdown-formatted answer — this
    // environment has no configured LLM provider key, so a real Generate call always fails
    // (see the "revisit" test above for the same reasoning).
    const turnsById = new Map<string, Record<string, unknown>>()
    await page.route('**/api/playground/turns', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      const response = await route.fetch()
      const body = (await response.json()) as { id: string }
      turnsById.set(body.id, body)
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

    await page.goto('/')

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
    await page.getByRole('button', { name: 'Move to Playground' }).click()
    await expect(page.getByRole('heading', { name: 'Playground' })).toBeVisible()

    const question = `Markdown question? (${runId})`
    await page.getByRole('textbox', { name: 'Question' }).fill(question)
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByRole('button', { name: 'Generate' })).toBeEnabled({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Generate' }).click()

    const answerBubble = page.getByRole('button', { name: `Answer to ${question}` })
    await expect(answerBubble).toBeVisible({ timeout: 15_000 })
    await expect(answerBubble.locator('li')).toHaveCount(2)
    await expect(answerBubble.locator('strong', { hasText: 'Key' }).first()).toBeVisible()
    await expect(answerBubble).not.toContainText('**Key**')
  })
})
