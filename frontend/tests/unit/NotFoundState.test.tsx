import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { NotFoundState } from '../../src/components/router/NotFoundState'

describe('NotFoundState (032-deep-linking FR-009)', () => {
  it('renders the given explanatory message', () => {
    render(
      <MemoryRouter>
        <NotFoundState message="This entry no longer exists." backHref="/golden-dataset/corpus-1" backLabel="Back to Golden Dataset" />
      </MemoryRouter>,
    )

    expect(screen.getByText('This entry no longer exists.')).toBeInTheDocument()
  })

  it('renders a link back to the given screen', () => {
    render(
      <MemoryRouter>
        <NotFoundState message="Not found." backHref="/corpora" backLabel="Back to Corpora" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Back to Corpora' })
    expect(link).toHaveAttribute('href', '/corpora')
  })

  it('uses an alert role so the message is announced', () => {
    render(
      <MemoryRouter>
        <NotFoundState message="Not found." backHref="/corpora" backLabel="Back to Corpora" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Not found.')
  })
})
