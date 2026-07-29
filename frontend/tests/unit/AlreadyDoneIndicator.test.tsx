import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AlreadyDoneIndicator } from '../../src/components/shared/AlreadyDoneIndicator'

describe('AlreadyDoneIndicator (022-chunk-preview-ui-fixes US3)', () => {
  it('renders a single line for a document scope using the given verb/noun', () => {
    render(<AlreadyDoneIndicator verb="Chunking" noun="chunks" scope="document" />)

    expect(screen.getByTestId('already-done-indicator')).toHaveTextContent(
      'Chunking already performed for this document — showing previously saved chunks.',
    )
  })

  it('renders a single line for a corpus scope with a different verb/noun', () => {
    render(<AlreadyDoneIndicator verb="Embedding generation" noun="embeddings" scope="corpus" />)

    expect(screen.getByTestId('already-done-indicator')).toHaveTextContent(
      'Embedding generation already performed for this corpus — showing previously saved embeddings.',
    )
  })
})
