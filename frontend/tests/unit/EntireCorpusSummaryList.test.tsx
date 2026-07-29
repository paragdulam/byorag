import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EntireCorpusSummaryList } from '../../src/components/shared/EntireCorpusSummaryList'

interface FakeResult {
  count: number
}

describe('EntireCorpusSummaryList (022-chunk-preview-ui-fixes US3)', () => {
  it('renders one row per result, success rows using the caller-provided label formatter', () => {
    render(
      <EntireCorpusSummaryList<FakeResult>
        results={[
          { documentId: 'doc-a', documentName: 'a.pdf', status: 'success', result: { count: 8 } },
        ]}
        formatSuccessLabel={(result) => `${result.count} things`}
      />,
    )

    const summary = screen.getByTestId('entire-corpus-summary')
    expect(within(summary).getByText('a.pdf')).toBeInTheDocument()
    expect(within(summary).getByText('8 things')).toBeInTheDocument()
  })

  it('renders failure rows with the error message, identically regardless of caller', () => {
    render(
      <EntireCorpusSummaryList<FakeResult>
        results={[
          { documentId: 'doc-b', documentName: 'b.pdf', status: 'failed', errorMessage: 'Something failed' },
        ]}
        formatSuccessLabel={(result) => `${result.count} things`}
      />,
    )

    const summary = screen.getByTestId('entire-corpus-summary')
    expect(within(summary).getByText('b.pdf')).toBeInTheDocument()
    expect(within(summary).getByRole('alert')).toHaveTextContent('Something failed')
  })

  it('falls back to "Failed" when a failed result has no error message', () => {
    render(
      <EntireCorpusSummaryList<FakeResult>
        results={[{ documentId: 'doc-c', documentName: 'c.pdf', status: 'failed' }]}
        formatSuccessLabel={(result) => `${result.count} things`}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Failed')
  })
})
