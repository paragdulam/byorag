import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EmbeddingsScreen } from '../../src/components/chunking/EmbeddingsScreen'

describe('EmbeddingsScreen', () => {
  it('renders within the standard navigation shell', () => {
    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    expect(screen.getByText('CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('SOURCES')).toBeInTheDocument()
  })

  it('shows a short "coming soon" style message and no functional controls in the main content area', () => {
    render(<EmbeddingsScreen onNavigate={vi.fn()} />)

    const message = screen.getByText(/coming soon/i)
    expect(message).toBeInTheDocument()

    // Scoped to <main> so we don't false-positive on the shared AppShell chrome
    // (TopBar's search/deploy buttons), which every screen renders regardless.
    const main = document.querySelector('main') as HTMLElement
    expect(main.querySelector('button')).not.toBeInTheDocument()
    expect(main.querySelector('input, select, textarea')).not.toBeInTheDocument()
  })
})
