import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

// 032-deep-linking US1: opening a previously generated/bookmarked URL (not just navigating to
// one from inside the app) must restore the same screen/corpus (FR-004), and an unresolvable
// route must render the shared not-found state instead of crashing (FR-009). The default fetch
// mock (tests/setup.ts) resolves a single corpus, id "default-corpus", and resets
// window.history to "/" before every test.
describe('App routing — restoring from a pasted/bookmarked URL', () => {
  it('restores the screen and corpus from an initial corpus-scoped URL', async () => {
    window.history.pushState({}, '', '/playground/default-corpus')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Playground' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/playground/default-corpus')
  })

  it('renders the not-found state for an unrecognized screen path', async () => {
    window.history.pushState({}, '', '/not-a-real-screen')

    render(<App />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })

  it('renders the not-found state for a corpus id that does not belong to the signed-in user', async () => {
    window.history.pushState({}, '', '/playground/some-other-users-corpus')

    render(<App />)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Playground' })).not.toBeInTheDocument()
  })
})
