import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TopBar } from '../../src/components/layout/TopBar'

describe('TopBar', () => {
  it('renders search icon, notifications icon, and the Deploy Pipeline button', () => {
    render(<TopBar />)

    expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deploy Pipeline' })).toBeInTheDocument()
  })
})
