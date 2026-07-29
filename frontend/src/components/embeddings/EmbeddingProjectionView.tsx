import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { ProjectionPoint } from '../../types/embeddings'

export interface EmbeddingProjectionViewProps {
  points: ProjectionPoint[]
  groupByDocument: boolean
}

const SERIES_COLORS = ['#2563EB', '#DC2626', '#16A34A', '#D97706', '#7C3AED', '#DB2777']

function ProjectionTooltip({ payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as ProjectionPoint | undefined
  if (!point) {
    return null
  }
  return (
    <div
      data-testid="projection-tooltip"
      className="rounded border border-outline-variant bg-surface p-2 text-xs text-on-surface"
    >
      <div>Chunk: {point.chunkId}</div>
      <div>Document: {point.documentId}</div>
    </div>
  )
}

/**
 * 2D scatter plot of a computed embedding projection (021-sources-chunking-embeddings-refresh
 * User Story 4, research.md §7). One `Scatter` series per source document when `groupByDocument`
 * is true (Entire Corpus scope, spec FR-016); a single series otherwise.
 */
export function EmbeddingProjectionView({ points, groupByDocument }: EmbeddingProjectionViewProps) {
  const seriesEntries: [string, ProjectionPoint[]][] = groupByDocument
    ? Array.from(
        points.reduce((map, point) => {
          const list = map.get(point.documentId) ?? []
          list.push(point)
          map.set(point.documentId, list)
          return map
        }, new Map<string, ProjectionPoint[]>()),
      )
    : [['all', points]]

  return (
    <div data-testid="embedding-projection-view">
      <ScatterChart width={600} height={400}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name="x" />
        <YAxis type="number" dataKey="y" name="y" />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={ProjectionTooltip} />
        {seriesEntries.map(([documentId, seriesPoints], index) => (
          <Scatter
            key={documentId}
            name={documentId}
            data={seriesPoints}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
          />
        ))}
      </ScatterChart>
    </div>
  )
}
