import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from '../../src/app/App'

describe('App navigation', () => {
  it('renders the Data Sources screen by default', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Data Sources' })).toBeInTheDocument()
  })

  it('renders the Fixed Size Chunking screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(screen.getByRole('heading', { name: 'Fixed Size Chunking' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Data Sources' })).not.toBeInTheDocument()
  })

  it('renders the Embeddings placeholder screen after navigating there from the sidebar', async () => {
    render(<App />)

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('EMBEDDINGS'))

    expect(screen.getByRole('heading', { name: 'Embeddings' })).toBeInTheDocument()
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
