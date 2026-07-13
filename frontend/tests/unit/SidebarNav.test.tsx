import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SidebarNav } from '../../src/components/layout/SidebarNav'

describe('SidebarNav', () => {
  it('renders all five top-level sections, labeled "Chunking" (not "Experiments"), with Sources marked active by default', () => {
    render(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

    expect(screen.getByText('SOURCES')).toBeInTheDocument()
    expect(screen.getByText('CHUNKING')).toBeInTheDocument()
    expect(screen.queryByText('EXPERIMENTS')).not.toBeInTheDocument()
    expect(screen.getByText('PLAYGROUND')).toBeInTheDocument()
    expect(screen.getByText('VECTOR VIEW')).toBeInTheDocument()
    expect(screen.getByText('LOGS')).toBeInTheDocument()

    expect(screen.getByText('SOURCES')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('CHUNKING')).not.toHaveAttribute('aria-current')
  })

  it('reveals "Fixed Size Chunking" when Chunking is expanded', async () => {
    render(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

    expect(screen.queryByText('FIXED SIZE CHUNKING')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
  })

  it('calls onNavigate with the fixed-size-chunking screen id when its sub-option is selected', async () => {
    const onNavigate = vi.fn()
    render(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(onNavigate).toHaveBeenCalledWith('fixed-size-chunking')
  })

  it('marks the Fixed Size Chunking sub-option as active when it is the active screen', async () => {
    render(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('SOURCES')).not.toHaveAttribute('aria-current')
  })

  it('also lists "Embeddings" alongside "Fixed Size Chunking" when Chunking is expanded', async () => {
    render(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByText('CHUNKING'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
    expect(screen.getByText('EMBEDDINGS')).toBeInTheDocument()
  })

  it('calls onNavigate with the embeddings screen id when Embeddings is selected, regardless of run state', async () => {
    const onNavigate = vi.fn()
    render(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={onNavigate} />)

    await userEvent.click(screen.getByText('CHUNKING'))
    await userEvent.click(screen.getByText('EMBEDDINGS'))

    expect(onNavigate).toHaveBeenCalledWith('embeddings')
  })
})
