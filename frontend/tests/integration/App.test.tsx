import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

// 032-deep-linking US1: the URL is expected to reflect the active screen/corpus after every
// navigation (FR-001–FR-003). The default fetch mock (tests/setup.ts) resolves a single corpus,
// id "default-corpus"; tests/setup.ts also resets window.history to "/" before every test.
describe('App navigation', () => {
  it('renders the Data Sources screen by default', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Data Sources' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.pathname).toBe('/sources/default-corpus'))
  })

  it('renders the Fixed Size Chunking screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(screen.getByRole('heading', { name: 'Fixed Size Chunking' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/fixed-size-chunking/default-corpus')
  })

  it('renders the Embeddings screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('CHUNKING'))
    await userEvent.click(screen.getByText('EMBEDDINGS'))

    expect(screen.getByRole('heading', { name: 'Embeddings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/embeddings/default-corpus')
  })

  it('renders the Vector View screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('VECTOR VIEW'))

    expect(screen.getByRole('heading', { name: 'Vector View' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/vector-view/default-corpus')
  })

  it('renders the Playground screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('PLAYGROUND'))

    expect(screen.getByRole('heading', { name: 'Playground' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/playground/default-corpus')
  })

  it('renders the Corpora screen (no corpus segment) after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('CORPORA'))

    expect(screen.getByRole('heading', { name: 'Corpora' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/corpora')
  })
})
