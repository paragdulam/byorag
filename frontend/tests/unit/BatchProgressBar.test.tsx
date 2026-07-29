import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BatchProgressBar } from '../../src/components/shared/BatchProgressBar'

describe('BatchProgressBar (022-chunk-preview-ui-fixes US3)', () => {
  it('renders the combined percentage and "Processing document X of N (name)" label', () => {
    render(
      <BatchProgressBar
        progress={{ index: 2, total: 12, documentId: 'doc-x', documentName: 'name.pdf', documentPercent: 42 }}
      />,
    )

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByText(/processing document 3 of 12 \(name\.pdf\)/i)).toBeInTheDocument()
  })
})
