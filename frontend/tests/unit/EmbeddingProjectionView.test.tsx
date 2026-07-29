import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmbeddingProjectionView } from '../../src/components/embeddings/EmbeddingProjectionView'
import type { ProjectionPoint } from '../../src/types/embeddings'

function points(): ProjectionPoint[] {
  return [
    { chunkId: 'c1', documentId: 'doc-a', x: 0, y: 1 },
    { chunkId: 'c2', documentId: 'doc-a', x: 2, y: 3 },
    { chunkId: 'c3', documentId: 'doc-b', x: -1, y: -2 },
  ]
}

describe('EmbeddingProjectionView (021-sources-chunking-embeddings-refresh US4)', () => {
  it('renders the projection view container', () => {
    render(<EmbeddingProjectionView points={points()} groupByDocument={false} />)

    expect(screen.getByTestId('embedding-projection-view')).toBeInTheDocument()
  })

  it('renders one scatter point per input point', () => {
    const { container } = render(
      <EmbeddingProjectionView points={points()} groupByDocument={false} />,
    )

    const symbols = container.querySelectorAll('.recharts-scatter-symbol')
    expect(symbols).toHaveLength(3)
  })

  it('renders a separate series per document when grouped by document', () => {
    const { container } = render(
      <EmbeddingProjectionView points={points()} groupByDocument={true} />,
    )

    const series = container.querySelectorAll('.recharts-scatter')
    expect(series).toHaveLength(2)
  })

  it('renders a single series when not grouped by document', () => {
    const { container } = render(
      <EmbeddingProjectionView points={points()} groupByDocument={false} />,
    )

    const series = container.querySelectorAll('.recharts-scatter')
    expect(series).toHaveLength(1)
  })
})
