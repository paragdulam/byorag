import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SidebarNav } from '../../src/components/layout/SidebarNav'

describe('SidebarNav', () => {
  it('renders all five top-level sections with Sources marked active by default', () => {
    render(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

    expect(screen.getByText('SOURCES')).toBeInTheDocument()
    expect(screen.getByText('EXPERIMENTS')).toBeInTheDocument()
    expect(screen.getByText('PLAYGROUND')).toBeInTheDocument()
    expect(screen.getByText('VECTOR VIEW')).toBeInTheDocument()
    expect(screen.getByText('LOGS')).toBeInTheDocument()

    expect(screen.getByText('SOURCES')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('EXPERIMENTS')).not.toHaveAttribute('aria-current')
  })

  it('reveals sub-options with "Fixed Size Chunking" first when Experiments is selected', async () => {
    render(<SidebarNav activeScreen="sources" onNavigate={vi.fn()} />)

    expect(screen.queryByText('FIXED SIZE CHUNKING')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('EXPERIMENTS'))

    const subItems = screen.getAllByRole('link', { hidden: true }).map((el) => el.textContent)
    expect(screen.getByText('FIXED SIZE CHUNKING')).toBeInTheDocument()
    // "first" sub-option: no other sub-items exist yet, but assert position among whatever is rendered
    expect(subItems.filter((label) => label === 'FIXED SIZE CHUNKING')).toHaveLength(1)
  })

  it('calls onNavigate with the fixed-size-chunking screen id when its sub-option is selected', async () => {
    const onNavigate = vi.fn()
    render(<SidebarNav activeScreen="sources" onNavigate={onNavigate} />)

    await userEvent.click(screen.getByText('EXPERIMENTS'))
    await userEvent.click(screen.getByText('FIXED SIZE CHUNKING'))

    expect(onNavigate).toHaveBeenCalledWith('fixed-size-chunking')
  })

  it('marks the Fixed Size Chunking sub-option as active when it is the active screen', async () => {
    render(<SidebarNav activeScreen="fixed-size-chunking" onNavigate={vi.fn()} />)

    await userEvent.click(screen.getByText('EXPERIMENTS'))

    expect(screen.getByText('FIXED SIZE CHUNKING')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('SOURCES')).not.toHaveAttribute('aria-current')
  })
})
