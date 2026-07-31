import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TopBar } from '../../src/components/layout/TopBar'

describe('TopBar', () => {
  it('renders search icon, notifications icon, profile icon, and the Deploy Pipeline button', () => {
    render(<TopBar onNavigateToProfile={() => {}} />)

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.getByLabelText('Profile')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deploy Pipeline' })).toBeInTheDocument()
  })

  it('calls onNavigateToProfile when the profile icon is clicked', () => {
    const onNavigateToProfile = vi.fn()
    render(<TopBar onNavigateToProfile={onNavigateToProfile} />)

    fireEvent.click(screen.getByLabelText('Profile'))

    expect(onNavigateToProfile).toHaveBeenCalledOnce()
  })
})
