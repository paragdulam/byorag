import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('App navigation', () => {
  it('renders the Data Sources screen by default', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Data Sources' })).toBeInTheDocument()
  })

  it('renders the Fixed Size Chunking screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(screen.getByRole('heading', { name: 'Fixed Size Chunking' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })

  it('renders the Embeddings screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('CHUNKING'))
    await userEvent.click(screen.getByText('EMBEDDINGS'))

    expect(screen.getByRole('heading', { name: 'Embeddings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })

  it('renders the Vector View screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('VECTOR VIEW'))

    expect(screen.getByRole('heading', { name: 'Vector View' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })

  it('renders the Playground screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(await screen.findByText('PLAYGROUND'))

    expect(screen.getByRole('heading', { name: 'Playground' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })
})
