import type { PipelineSummary } from '../../types/metrics'

export interface PipelineSelectorProps {
  pipelines: PipelineSummary[]
  selectedIndex: number
  onSelect: (index: number) => void
}

/** A technique switcher for a corpus's pipelines (spec US2) — renders nothing when the corpus
 * has zero or one pipeline, since there is nothing to switch between (FR-003). */
export function PipelineSelector({ pipelines, selectedIndex, onSelect }: PipelineSelectorProps) {
  if (pipelines.length <= 1) {
    return null
  }

  return (
    <div
      data-testid="pipeline-selector"
      role="tablist"
      aria-label="Chunking technique"
      className="mb-4 flex gap-2"
    >
      {pipelines.map((pipeline, index) => {
        const isSelected = index === selectedIndex
        return (
          <button
            key={`${pipeline.chunkingStrategy}-${pipeline.embeddingModel}`}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-testid={`pipeline-selector-option-${index}`}
            onClick={() => onSelect(index)}
            className={
              'rounded px-3 py-1.5 text-sm ' +
              (isSelected
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:bg-surface-variant')
            }
          >
            {pipeline.chunkingStrategy}
          </button>
        )
      })}
    </div>
  )
}
