import type { PipelineSummary } from '../../types/metrics'

export interface ComparisonModalProps {
  pipelines: PipelineSummary[]
  onClose: () => void
}

function formatScore(value: number | undefined): string {
  return value === undefined ? '—' : value.toFixed(2)
}

function formatModel(value: string | null): string {
  return value ?? '—'
}

/** Side-by-side comparison of every technique/embedding-model pipeline for a corpus (spec
 * US3) — each pipeline as its own row so scores can be scanned across techniques at a glance. */
export function ComparisonModal({ pipelines, onClose }: ComparisonModalProps) {
  return (
    <div
      data-testid="comparison-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare pipelines"
        data-testid="comparison-modal"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[80vh] w-full max-w-4xl overflow-y-auto rounded bg-surface-container p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-on-surface">Compare Pipelines</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="text-on-surface-variant hover:text-on-surface"
          >
            Close
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-on-surface-variant">
                <th className="py-2 pr-4">Technique</th>
                <th className="py-2 pr-4">Embedding Model</th>
                <th className="py-2 pr-4">Retrieval Strategy</th>
                <th className="py-2 pr-4">Chunks</th>
                <th className="py-2 pr-4">Questions</th>
                <th className="py-2 pr-4">Answers</th>
                <th className="py-2 pr-4">Scope (Corpus/Doc)</th>
                <th className="py-2 pr-4">Context Precision</th>
                <th className="py-2 pr-4">Context Recall</th>
                <th className="py-2 pr-4">Generation LLM</th>
                <th className="py-2 pr-4">Response Relevancy</th>
                <th className="py-2 pr-4">Faithfulness</th>
                <th className="py-2 pr-4">Judge LLM</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((pipeline) => (
                <tr
                  key={`${pipeline.chunkingStrategy}-${pipeline.embeddingModel}`}
                  data-testid={`comparison-row-${pipeline.chunkingStrategy}`}
                  className="border-t border-outline-variant text-on-surface"
                >
                  <td className="py-2 pr-4">{pipeline.chunkingStrategy}</td>
                  <td className="py-2 pr-4">{pipeline.embeddingModel}</td>
                  <td className="py-2 pr-4">{pipeline.retrievalStrategy}</td>
                  <td className="py-2 pr-4">{pipeline.chunkCount}</td>
                  <td className="py-2 pr-4">{pipeline.questionCount}</td>
                  <td className="py-2 pr-4">{pipeline.answerCount}</td>
                  <td className="py-2 pr-4">
                    {pipeline.scopeBreakdown.corpus}/{pipeline.scopeBreakdown.document}
                  </td>
                  <td className="py-2 pr-4">{formatScore(pipeline.scores?.contextPrecision)}</td>
                  <td className="py-2 pr-4">{formatScore(pipeline.scores?.contextRecall)}</td>
                  <td className="py-2 pr-4">{formatModel(pipeline.generationLlm)}</td>
                  <td className="py-2 pr-4">{formatScore(pipeline.scores?.responseRelevancy)}</td>
                  <td className="py-2 pr-4">{formatScore(pipeline.scores?.faithfulness)}</td>
                  <td className="py-2 pr-4">{formatModel(pipeline.judgeLlm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
